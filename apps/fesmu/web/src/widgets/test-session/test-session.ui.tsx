import { Fragment, useState } from "react";
import type { FC, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    CheckCircle2Icon,
    ChevronDownIcon,
    ChevronRightIcon,
    CircleIcon,
    ClockIcon,
    ExternalLinkIcon,
    FileDownIcon,
    LockIcon,
    LockOpenIcon,
    RefreshCwIcon,
    TimerIcon,
    TrashIcon,
    UsersIcon,
    XCircleIcon,
} from "lucide-react";
import { FormProvider, useWatch } from "react-hook-form";
import { PromFieldInput, PromFieldSwitch } from "@/features/lib/form";
import { CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { CommonPopover } from "@/shared/components/menu";
import { Can, useCan } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonModal } from "@/shared/components/modal";
import { CommonQrButton, CommonQrCode, CommonShareLink } from "@/shared/components/share";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { useTestSessionCreate, useTestSessionResults, useTestSessionSheet, useTestSessions } from "./test-session.fn";
import { ATTEMPT_STATUS_LABEL, ATTEMPT_STATUS_TONE, attemptPercent, formatDay, sessionNotOpenYet, sessionOpen, testTakeUrl } from "./test-session.schema";
import type { TestAttempt, TestSession, TestSessionForm, TestSessionQuestion } from "./test-session.schema";

type SessionCreate = ReturnType<typeof useTestSessionCreate>;
type Sessions = ReturnType<typeof useTestSessions>;
type SessionResults = ReturnType<typeof useTestSessionResults>;

const FIELD_CLASS = "border rounded-lg p-2 w-full bg-background";

const formatDateTime = (date?: Date) =>
    date ? date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** "12:05" — minutes and seconds between two moments. */
const formatSpent = (from?: Date, to?: Date) => {
    if (!from || !to) return "—";
    const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const sessionResultsPath = (id: string) => ROUTE.TESTS.SESSION_RESULTS.replace(":id", id);

const questionsAsked = (session: TestSession) =>
    (session.questionCount ? `${session.questionCount} из ${session.totalQuestions} вопросов` : `${session.totalQuestions} вопросов`) +
    (session.optionCount ? `, по ${session.optionCount} вариантов` : "");

/* ───────────── create ───────────── */

const FieldDateTime: FC<{ form: SessionCreate["form"]; name: "opensAt" | "closesAt"; label: string; hint: string }> = ({ form, name, label, hint }) => {
    const error = form.formState.errors[name]?.message;
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={name} className="font-medium">
                {label}
            </label>
            <input id={name} type="datetime-local" {...form.register(name)} className={FIELD_CLASS} />
            <span className="text-xs text-muted-foreground">{hint}</span>
            {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
    );
};

/** The student link with a copy button, shown once the session is made. */
const SessionLink: FC<{ session: TestSession }> = ({ session }) => {
    const url = testTakeUrl(session.token);
    return (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
                Ссылка для студентов — по ней тест проходится без входа в систему. QR-код можно показать на экране: студенты отсканируют его
                телефоном.
            </p>
            <CommonQrCode url={url} fileName={`QR ${session.topic}`} size={220} className="self-center" />
            <code className="break-all rounded-md bg-background px-3 py-2 text-sm">{url}</code>
            <div className="flex flex-wrap gap-2">
                <CommonShareLink url={url} />
                <Button asChild variant="outline" size="sm">
                    <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon className="size-4" />
                        Открыть
                    </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                    <Link to={sessionResultsPath(session.id)}>
                        <UsersIcon className="size-4" />
                        Результаты
                    </Link>
                </Button>
            </div>
        </div>
    );
};

/** What each student gets: their own random set of questions without
 * repeats; in a V2 test also their own mix of right and wrong answers. */
const QuestionPickHint: FC<{ form: SessionCreate["form"]; total: number; mixed: boolean }> = ({ form, total, mixed }) => {
    const asked = Number(useWatch({ control: form.control, name: "questionCount" }) || 0);
    const options = Number(useWatch({ control: form.control, name: "optionCount" }) || 0);
    const shuffle = useWatch({ control: form.control, name: "shuffle" });

    return (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {asked > 0 && asked < total && `Каждый студент получит свои ${asked} случайных вопросов из ${total} — наборы у всех разные. `}
            Вопросы в попытке не повторяются. {shuffle && "Вопросы и варианты ответа перемешиваются. "}
            {mixed
                ? `${options > 0 ? `В каждом вопросе — ${options} ответов: случайная смесь верных и неверных, у каждого студента своя. ` : ""}Студент может отметить несколько ответов, засчитывается только точное совпадение со всеми верными.`
                : "Варианты ответа показываются как записаны: при одном верном — выбор одного, при нескольких — нескольких."}
        </p>
    );
};

/** Staff: hand a test out — time limit and options — then copy the link. */
const TestSessionCreateModal: FC<{ state: SessionCreate }> = ({ state }) => {
    const { form, target, created, handleSubmit } = state;

    return (
        <CommonModal
            open={state.modal.open}
            onOpenChange={state.modal.onOpenChange}
            title={created ? "Сессия создана" : "Новая сессия тестирования"}
            description={target ? `«${target.topic}» — ${target.questionCount} вопросов в тесте` : undefined}
            className="sm:max-w-xl"
        >
            {created ? (
                <SessionLink session={created} />
            ) : (
                <FormProvider {...form}>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <PromFieldInput<TestSessionForm>
                                name="durationMinutes"
                                label="Время на прохождение, мин"
                                placeholder="30"
                                allowedPattern={/^\d{0,3}$/}
                                className={FIELD_CLASS}
                            />
                            <PromFieldInput<TestSessionForm>
                                name="questionCount"
                                label="Вопросов в попытке"
                                placeholder={`Все (${target?.questionCount ?? 0})`}
                                allowedPattern={/^\d{0,3}$/}
                                className={FIELD_CLASS}
                            />
                        </div>
                        {target?.mixed && (
                            <div className="flex flex-col gap-1">
                                <PromFieldInput<TestSessionForm>
                                    name="optionCount"
                                    label="Ответов в вопросе (V2)"
                                    placeholder="Все"
                                    allowedPattern={/^\d{0,2}$/}
                                    className={FIELD_CLASS}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Сколько ответов видит студент: случайная смесь верных и неверных из списков вопроса. Пусто — все.
                                </p>
                            </div>
                        )}
                        <PromFieldInput<TestSessionForm>
                            name="note"
                            label="Комментарий"
                            placeholder="Например: группа Л-101, зачёт"
                            maxLength={255}
                            className={FIELD_CLASS}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FieldDateTime
                                form={form}
                                name="opensAt"
                                label="Открытие теста"
                                hint="Необязательно: до этого момента начать тест нельзя."
                            />
                            <FieldDateTime
                                form={form}
                                name="closesAt"
                                label="Закрытие теста"
                                hint="Необязательно: после этого момента начать тест нельзя."
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <PromFieldSwitch<TestSessionForm> name="shuffle" label="Перемешивать вопросы и варианты ответа" />
                            <PromFieldSwitch<TestSessionForm> name="showResult" label="Показать студенту результат после завершения" />
                        </div>
                        <QuestionPickHint form={form} total={target?.questionCount ?? 0} mixed={Boolean(target?.mixed)} />
                        <p className="text-xs text-muted-foreground">
                            Вопросы копируются в сессию: правка теста потом не изменит уже выданный тест и результаты.
                        </p>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Создание…" : "Создать сессию"}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            )}
        </CommonModal>
    );
};

/* ───────────── list ───────────── */

const OpenBadge: FC<{ session: TestSession }> = ({ session }) =>
    sessionOpen(session) ? (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Открыта</Badge>
    ) : session.isOpen && sessionNotOpenYet(session) ? (
        <Badge className="bg-amber-500 text-white hover:bg-amber-500">Ещё не открыта</Badge>
    ) : (
        <Badge variant="secondary">Закрыта</Badge>
    );

/** "с 16.10 10:00 до 16.10 12:00" — the session's window, when set. */
const sessionWindow = (session: TestSession) =>
    [session.opensAt && `с ${formatDateTime(session.opensAt)}`, session.closesAt && `до ${formatDateTime(session.closesAt)}`].filter(Boolean).join(" ");

const TestSessionFilters: FC<{ state: Sessions }> = ({ state }) => (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <CommonSearchInput value={state.search} onChange={state.setSearch} placeholder="Тема или комментарий" />
        <CommonFilterSelect
            label="Приём ответов"
            value={state.onlyOpen ? "open" : undefined}
            onChange={(value) => state.setOnlyOpen(value === "open")}
            options={[{ value: "open", label: "Только открытые" }]}
            allLabel="Все сессии"
        />
    </div>
);

const SessionRow: FC<{ session: TestSession; state: Sessions }> = ({ session, state }) => {
    const canEdit = useCan(PermissionSection.TESTS);
    const navigate = useNavigate();
    return (
    <TableRow>
        <TableCell className="min-w-64 max-w-md whitespace-normal">
            <div className="flex items-start gap-2">
                <Link to={sessionResultsPath(session.id)} className="min-w-0 font-medium break-words hover:underline">
                    {session.topic}
                </Link>
                <Badge variant="outline" className={cn("mt-0.5 shrink-0 text-[10px]", session.mixed && "border-primary/40 text-primary")}>
                    {session.mixed ? "V2" : "V1"}
                </Badge>
            </div>
            <div className="text-xs break-words text-muted-foreground">{[session.department, session.note].filter(Boolean).join(" · ")}</div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
            <div className="flex items-center gap-1">
                <TimerIcon className="size-3.5 text-muted-foreground" />
                {session.durationMinutes} мин
            </div>
            <div className="text-xs text-muted-foreground">{questionsAsked(session)}</div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
            {formatDateTime(session.createdAt)}
            {sessionWindow(session) && <div className="text-xs text-muted-foreground">приём {sessionWindow(session)}</div>}
        </TableCell>
        <TableCell>
            <OpenBadge session={session} />
        </TableCell>
        <TableCell className="text-center">
            <Badge variant="outline">{session.attemptCount}</Badge>
        </TableCell>
        <TableCell>
            <div className="flex items-center justify-end gap-2">
                <CommonShareLink url={testTakeUrl(session.token)} label="Ссылка" />
                <CommonQrButton url={testTakeUrl(session.token)} title={session.topic} subtitle="Отсканируйте и пройдите тест" emoji="📝" fileName={`QR ${session.topic}`} label="QR" />
                <CommonPopover
                    items={[
                        {
                            label: "Результаты",
                            icon: <UsersIcon className="h-3.5 w-3.5" />,
                            onClick: () => navigate(sessionResultsPath(session.id)),
                        },
                        // Opening, closing and deleting need the right to change tests.
                        ...(canEdit
                            ? [
                                  session.isOpen
                                      ? { label: "Закрыть приём", icon: <LockIcon className="h-3.5 w-3.5" />, onClick: () => state.setOpen(session, false) }
                                      : { label: "Открыть приём", icon: <LockOpenIcon className="h-3.5 w-3.5" />, onClick: () => state.setOpen(session, true) },
                                  {
                                      label: "Удалить",
                                      icon: <TrashIcon className="h-3.5 w-3.5" />,
                                      style: "text-destructive hover:text-destructive",
                                      onClick: () => state.remove(session),
                                  },
                              ]
                            : []),
                    ]}
                />
            </div>
        </TableCell>
    </TableRow>
    );
};

const NoSessions: FC<{ title: string; description: string }> = ({ title, description }) => (
    <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
            <EmptyMedia variant="icon">
                <ClockIcon />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
    </Empty>
);

const TestSessionList: FC<{ state: Sessions }> = ({ state }) => {
    if (state.visible.length === 0) {
        return (
            <NoSessions
                title="Сессий нет"
                description={
                    state.empty
                        ? "Создайте сессию в конструкторе тестов: меню теста → «Выдать студентам»."
                        : "По выбранным фильтрам ничего не найдено."
                }
            />
        );
    }

    return (
        <Card className="py-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Тест</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Создана</TableHead>
                        <TableHead>Приём</TableHead>
                        <TableHead className="text-center">Попыток</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {state.visible.map((session) => (
                        <SessionRow key={session.id} session={session} state={state} />
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
};

/* ───────────── results ───────────── */

const Stat: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
);

/** The session's link, settings and the counts above the results table. */
const TestSessionResultsHeader: FC<{ state: SessionResults }> = ({ state }) => {
    const session = state.results?.session;
    if (!session) return null;
    const open = sessionOpen(session);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <OpenBadge session={session} />
                <span>{session.durationMinutes} мин</span>
                <span>·</span>
                <span>{questionsAsked(session)}</span>
                {session.shuffle && (
                    <>
                        <span>·</span>
                        <span>вопросы перемешиваются</span>
                    </>
                )}
                <span>·</span>
                <span>{session.showResult ? "студент видит результат" : "результат студенту не показывается"}</span>
                {sessionWindow(session) && (
                    <>
                        <span>·</span>
                        <span>приём {sessionWindow(session)}</span>
                    </>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <CommonShareLink url={testTakeUrl(session.token)} label="Скопировать ссылку для студентов" />
                <CommonQrButton url={testTakeUrl(session.token)} title={session.topic} subtitle="Отсканируйте и пройдите тест" emoji="📝" fileName={`QR ${session.topic}`} />
                <Can section={PermissionSection.TESTS}>
                    <Button variant="outline" size="sm" onClick={() => state.setOpen(!session.isOpen)}>
                        {session.isOpen ? <LockIcon className="size-4" /> : <LockOpenIcon className="size-4" />}
                        {session.isOpen ? "Закрыть приём" : "Открыть приём"}
                    </Button>
                </Can>
                <Button variant="ghost" size="sm" onClick={() => state.fetch()}>
                    <RefreshCwIcon className="size-4" />
                    Обновить
                </Button>
                {!open && session.isOpen && (
                    <span className="text-xs text-muted-foreground">
                        {sessionNotOpenYet(session)
                            ? `Тест откроется ${formatDateTime(session.opensAt)} — до этого начать его нельзя.`
                            : "Дата закрытия прошла — новые попытки не принимаются."}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Попыток" value={state.stats.total} />
                <Stat label="Завершено" value={state.stats.done} />
                <Stat label="Проходят сейчас" value={state.stats.running} />
                <Stat label="Средний результат" value={state.stats.average === undefined ? "—" : `${Math.round(state.stats.average * 100)}%`} />
            </div>
        </div>
    );
};

const ScoreCell: FC<{ attempt: TestAttempt }> = ({ attempt }) => {
    const value = attemptPercent(attempt);
    return (
        <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">
                {attempt.score}/{attempt.total}
            </span>
            <span
                className={cn(
                    "text-xs tabular-nums",
                    value >= 70 ? "text-emerald-700 dark:text-emerald-400" : value >= 50 ? "text-amber-700 dark:text-amber-400" : "text-red-600",
                )}
            >
                {value}%
            </span>
        </div>
    );
};

/** What one student picked in each question, the correct options marked. */
const AttemptAnswers: FC<{ attempt: TestAttempt; questions: Map<string, TestSessionQuestion> }> = ({ attempt, questions }) => (
    <ol className="flex flex-col gap-4 py-2">
        {attempt.answers.map((answer, index) => {
            const question = questions.get(answer.questionId);
            if (!question) return null;
            return (
                <li key={answer.questionId} className="flex flex-col gap-1.5">
                    <p className="flex items-start gap-2 font-medium whitespace-pre-line">
                        {answer.isCorrect ? (
                            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Верно" />
                        ) : (
                            <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Неверно" />
                        )}
                        <span>
                            {index + 1}. {question.text}
                            {answer.answerIds.length === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">(нет ответа)</span>}
                        </span>
                    </p>
                    <ul className="flex flex-col gap-0.5 pl-6 text-sm">
                        {question.answers.map((option) => {
                            const picked = answer.answerIds.includes(option.id);
                            return (
                                <li
                                    key={option.id}
                                    className={cn(
                                        "flex items-start gap-2",
                                        option.isCorrect ? "text-emerald-700 dark:text-emerald-400" : picked ? "text-red-600" : "text-muted-foreground",
                                    )}
                                >
                                    {picked ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" /> : <CircleIcon className="mt-0.5 size-3.5 shrink-0" />}
                                    <span className="whitespace-pre-line">
                                        {option.text}
                                        {picked && <span className="ml-1 text-xs">— выбран</span>}
                                        {option.isCorrect && <span className="ml-1 text-xs">— верный</span>}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </li>
            );
        })}
    </ol>
);

/** Every attempt at the session; a row unfolds into the student's answers. */
const TestSessionResultsTable: FC<{ state: SessionResults }> = ({ state }) => {
    const [expanded, setExpanded] = useState<string>();
    const questions = new Map((state.results?.questions ?? []).map((question) => [question.id, question]));

    if (!state.results?.attempts.length) {
        return <NoSessions title="Пока никто не проходил" description="Результаты появятся здесь, как только студенты начнут тест по ссылке." />;
    }

    return (
        <div className="flex flex-col gap-3">
            <CommonSearchInput value={state.search} onChange={state.setSearch} placeholder="ФИО или группа" />
            <Card className="py-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>ФИО</TableHead>
                            <TableHead>Группа</TableHead>
                            <TableHead>Начало</TableHead>
                            <TableHead>Затрачено</TableHead>
                            <TableHead>Результат</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {state.attempts.map((attempt) => {
                            const open = expanded === attempt.id;
                            return (
                                <Fragment key={attempt.id}>
                                    <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? undefined : attempt.id)}>
                                        <TableCell>
                                            {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                                        </TableCell>
                                        <TableCell className="font-medium">{attempt.fullName}</TableCell>
                                        <TableCell>{attempt.studentGroup}</TableCell>
                                        <TableCell className="whitespace-nowrap">{formatDateTime(attempt.startedAt)}</TableCell>
                                        <TableCell className="tabular-nums">{formatSpent(attempt.startedAt, attempt.finishedAt)}</TableCell>
                                        <TableCell>{attempt.finishedAt ? <ScoreCell attempt={attempt} /> : "—"}</TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-2 whitespace-nowrap text-sm">
                                                <span className={cn("size-2 shrink-0 rounded-full", ATTEMPT_STATUS_TONE[attempt.status])} aria-hidden />
                                                {ATTEMPT_STATUS_LABEL[attempt.status]}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Can section={PermissionSection.TESTS}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 text-muted-foreground hover:text-destructive"
                                                    aria-label="Удалить результат"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        state.removeAttempt(attempt);
                                                    }}
                                                >
                                                    <TrashIcon className="size-4" />
                                                </Button>
                                            </Can>
                                        </TableCell>
                                    </TableRow>
                                    {open && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell />
                                            <TableCell colSpan={7} className="whitespace-normal">
                                                <AttemptAnswers attempt={attempt} questions={questions} />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
};

export { TestSessionCreateModal, TestSessionFilters, TestSessionList, TestSessionResultsHeader, TestSessionResultsTable };

/* ───────────── grade sheet ───────────── */

type SessionSheet = ReturnType<typeof useTestSessionSheet>;

/** Pick the days, then untick students if needed, and download the sheet. */
const TestSessionSheetModal: FC<{ sheet: SessionSheet }> = ({ sheet }) => {
    const allChecked = sheet.onDays.length > 0 && sheet.onDays.every((attempt) => !sheet.excluded.has(attempt.id));

    return (
        <CommonModal
            open={sheet.modal.open}
            onOpenChange={sheet.modal.onOpenChange}
            title="Ведомость (Word, .doc)"
            description="Выберите дни тестирования, затем при необходимости снимите отметку с отдельных студентов. Столбцы: группа, ФИО, правильно, оценка, рейтинг."
            className="sm:max-w-2xl"
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Дни</p>
                    <div className="flex flex-wrap gap-2">
                        {sheet.dayOptions.map(({ day, count }) => (
                            <Button
                                key={day}
                                type="button"
                                size="sm"
                                variant={sheet.days.has(day) ? "default" : "outline"}
                                onClick={() => sheet.toggleDay(day)}
                            >
                                {formatDay(day)}
                                <Badge variant="secondary" className="ml-1">
                                    {count}
                                </Badge>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                            Студенты: {sheet.selected.length} из {sheet.onDays.length}
                        </p>
                        {sheet.onDays.length > 0 && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox checked={allChecked} onCheckedChange={(checked) => sheet.setAll(checked === true)} />
                                Все
                            </label>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-xl border">
                        {sheet.onDays.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">Выберите хотя бы один день.</p>
                        ) : (
                            sheet.onDays.map((attempt) => (
                                <label
                                    key={attempt.id}
                                    className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                                >
                                    <Checkbox checked={!sheet.excluded.has(attempt.id)} onCheckedChange={() => sheet.toggleAttempt(attempt.id)} />
                                    <span className="w-24 shrink-0 text-muted-foreground">{attempt.studentGroup}</span>
                                    <span className="min-w-0 flex-1 truncate">{attempt.fullName}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {attempt.score}/{attempt.total} · {attemptPercent(attempt)}%
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={sheet.download} disabled={sheet.selected.length === 0 || sheet.exporting}>
                        <FileDownIcon className="size-4" />
                        {sheet.exporting ? "Формирование…" : "Скачать ведомость"}
                    </Button>
                </div>
            </div>
        </CommonModal>
    );
};

export { TestSessionSheetModal };
