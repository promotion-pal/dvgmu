import { useEffect, useRef } from "react";
import type { FC } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CircleAlertIcon, ClockIcon, CloudOffIcon, ListChecksIcon, LockIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { PromFieldInput } from "@/features/lib/form";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";
import type { useTestTake } from "./test-take.fn";
import { CommonImage } from "@/shared/components/image";
import { testImageUrl } from "@/shared/lib/test-image";
import { TestAttemptStatus } from "./test-take.schema";
import type { TestTakeStartForm } from "./test-take.schema";

/** "16 октября, 10:00" in the student's own time zone. */
const formatWhen = (date: Date) => date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

type TestTake = ReturnType<typeof useTestTake>;

// 16px text: smaller makes iOS zoom the page in when the field is focused.
const FIELD_CLASS = "border rounded-lg p-2.5 w-full bg-background text-base";

/** "04:59", or "1:04:59" past an hour. */
const formatRemaining = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${String(minutes).padStart(2, "0")}:${seconds}`;
};

const Message: FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
            <EmptyMedia variant="icon">{icon}</EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
    </Empty>
);

/* ───────────── intro ───────────── */

const TestTakeIntro: FC<{ take: TestTake }> = ({ take }) => {
    const { info, form, start } = take;
    if (!info) return null;

    return (
        <Card className="mx-auto w-full max-w-xl">
            <CardHeader>
                <CardTitle className="text-xl">{info.topic}</CardTitle>
                {info.description && <CardDescription className="whitespace-pre-line">{info.description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <ClockIcon className="size-4 text-muted-foreground" />
                        {info.durationMinutes} мин
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <ListChecksIcon className="size-4 text-muted-foreground" />
                        {info.questionCount} вопросов
                    </div>
                </div>

                {info.isOpen ? (
                    <FormProvider {...form}>
                        <form onSubmit={start} className="flex flex-col gap-4">
                            <PromFieldInput<TestTakeStartForm> name="fullName" label="ФИО" placeholder="Иванов Иван Иванович" maxLength={255} className={FIELD_CLASS} />
                            <PromFieldInput<TestTakeStartForm> name="studentGroup" label="Группа" placeholder="Например: Л-101" maxLength={64} className={FIELD_CLASS} />
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                <li>Время пойдёт сразу после нажатия «Начать тест».</li>
                                <li>Каждый ответ сохраняется сразу — если страница закроется, откройте ссылку снова в этом же браузере.</li>
                                <li>Когда время выйдет, тест завершится сам с сохранёнными ответами.</li>
                            </ul>
                            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Запуск…" : "Начать тест"}
                            </Button>
                        </form>
                    </FormProvider>
                ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <LockIcon className="size-4 shrink-0" />
                        {info.opensAt && info.opensAt > new Date()
                            ? `Тест откроется ${formatWhen(info.opensAt)}. Обновите страницу в это время.`
                            : "Приём ответов по этой ссылке закрыт."}
                    </div>
                )}
                {info.isOpen && info.closesAt && (
                    <p className="text-center text-xs text-muted-foreground">Начать тест можно до {formatWhen(info.closesAt)}.</p>
                )}
            </CardContent>
        </Card>
    );
};

/* ───────────── running ───────────── */

const Timer: FC<{ ms: number }> = ({ ms }) => (
    <div
        className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-lg tabular-nums",
            ms <= 60_000 ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : ms <= 300_000 && "border-amber-300 text-amber-700 dark:text-amber-300",
        )}
        aria-label="Осталось времени"
    >
        <ClockIcon className="size-4" />
        {formatRemaining(ms)}
    </div>
);

/** Numbered squares: filled when answered, ringed when current. */
const QuestionNav: FC<{ take: TestTake }> = ({ take }) => {
    const { state, current, setCurrent, unsaved } = take;
    if (!state) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {state.questions.map((question, index) => {
                const answered = Boolean(state.picked[question.id]?.length);
                return (
                    <button
                        key={question.id}
                        type="button"
                        onClick={() => setCurrent(index)}
                        className={cn(
                            "flex size-9 touch-manipulation items-center justify-center rounded-md border text-sm tabular-nums transition-colors",
                            answered ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                            index === current && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                            unsaved.has(question.id) && "border-dashed opacity-70",
                        )}
                        aria-label={`Вопрос ${index + 1}${answered ? ", есть ответ" : ""}`}
                        aria-current={index === current}
                    >
                        {index + 1}
                    </button>
                );
            })}
        </div>
    );
};

const TestTakeQuestions: FC<{ take: TestTake }> = ({ take }) => {
    const { state, current, setCurrent, pick, remainingMs, answered, unsaved, finishing, confirmFinish } = take;
    const questionTop = useRef<HTMLDivElement>(null);

    // Another question: bring its start into view (below the sticky header) —
    // otherwise a phone stays scrolled down where the previous, longer one ended.
    useEffect(() => {
        const card = questionTop.current;
        // 96px — the sticky header with the timer (matches scroll-mt-24).
        if (card && card.getBoundingClientRect().top < 96) card.scrollIntoView({ block: "start" });
    }, [current]);

    if (!state) return null;
    const question = state.questions[current];
    if (!question) return null;
    const picked = state.picked[question.id] ?? [];
    const last = current === state.questions.length - 1;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {/* One row of fixed height on any phone: nothing in it may wrap or
                appear/disappear, or the whole page jumps on every answer. */}
            <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:mx-0 sm:rounded-xl sm:border sm:bg-background/95 sm:backdrop-blur">
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{state.topic}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        отвечено {answered} из {state.questions.length} · {state.fullName}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className={cn("text-muted-foreground", unsaved.size === 0 && "invisible")}
                        title="Ответ ещё не дошёл до сервера"
                        aria-live="polite"
                    >
                        <CloudOffIcon className="size-4" aria-hidden />
                        <span className="sr-only">{unsaved.size > 0 ? "сохранение…" : ""}</span>
                    </span>
                    <Timer ms={remainingMs} />
                </div>
            </div>

            <QuestionNav take={take} />

            <Card ref={questionTop} className="scroll-mt-24">
                <CardHeader>
                    <CardDescription>
                        Вопрос {current + 1} из {state.questions.length}
                        {question.multiple && " · выберите все верные варианты"}
                    </CardDescription>
                    <CardTitle className="text-lg leading-snug whitespace-pre-line">{question.text}</CardTitle>
                    {question.image && (
                        // Opens full size in a new tab — readings on a small screen may need a closer look.
                        <a href={testImageUrl(question.image.hash)} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                            <CommonImage
                                src={testImageUrl(question.image.hash)}
                                alt="Картинка к вопросу"
                                width={question.image.width}
                                height={question.image.height}
                            />
                        </a>
                    )}
                </CardHeader>
                <CardContent>
                    <div role={question.multiple ? "group" : "radiogroup"} className="flex flex-col gap-2">
                        {question.answers.map((answer) => {
                            const checked = picked.includes(answer.id);
                            return (
                                <button
                                    key={answer.id}
                                    type="button"
                                    role={question.multiple ? "checkbox" : "radio"}
                                    aria-checked={checked}
                                    onClick={() => pick(question.id, answer.id)}
                                    className={cn(
                                        "flex touch-manipulation items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-5 shrink-0 items-center justify-center border-2",
                                            question.multiple ? "rounded" : "rounded-full",
                                            checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                                        )}
                                        aria-hidden
                                    >
                                        {checked && (question.multiple ? <CheckCircle2Icon className="size-3.5" /> : <span className="size-2 rounded-full bg-primary-foreground" />)}
                                    </span>
                                    <span className="whitespace-pre-line">{answer.text}</span>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* On a phone the buttons stay at the bottom of the screen, so they
                don't move under the finger when the next question is longer. */}
            <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <Button variant="outline" onClick={() => setCurrent(current - 1)} disabled={current === 0}>
                    <ArrowLeftIcon className="size-4" />
                    Назад
                </Button>
                <div className="flex gap-2">
                    {!last && (
                        <Button variant="outline" onClick={() => setCurrent(current + 1)}>
                            Далее
                            <ArrowRightIcon className="size-4" />
                        </Button>
                    )}
                    <Button onClick={confirmFinish} disabled={finishing} variant={last ? "default" : "secondary"}>
                        {finishing ? "Завершение…" : (
                            <>
                                Завершить<span className="hidden sm:inline"> тест</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

/* ───────────── done ───────────── */

const TestTakeResult: FC<{ take: TestTake }> = ({ take }) => {
    const { state } = take;
    if (!state) return null;
    const expired = state.status === TestAttemptStatus.EXPIRED;
    const percent = state.total ? Math.round((state.score / state.total) * 100) : 0;

    return (
        <Card className="mx-auto w-full max-w-xl text-center">
            <CardHeader className="items-center">
                <CheckCircle2Icon className="mx-auto size-12 text-emerald-600" />
                <CardTitle className="text-xl">{expired ? "Время вышло — тест завершён" : "Тест завершён"}</CardTitle>
                <CardDescription>
                    {state.topic} · {state.fullName}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
                {state.showResult ? (
                    <>
                        <p className="text-4xl font-semibold tabular-nums">
                            {state.score} / {state.total}
                        </p>
                        <p className="text-muted-foreground">верных ответов — {percent}%</p>
                    </>
                ) : (
                    <p className="text-muted-foreground">Ваши ответы сохранены. Результат сообщит преподаватель.</p>
                )}
            </CardContent>
        </Card>
    );
};

/** The whole student page, by phase. */
const TestTakePanel: FC<{ take: TestTake }> = ({ take }) => {
    switch (take.phase) {
        case "loading":
            return (
                <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-40 w-full" />
                </div>
            );
        case "missing":
            return <Message icon={<CircleAlertIcon />} title="Тест не найден" description="Проверьте ссылку или обратитесь к преподавателю." />;
        case "intro":
            return <TestTakeIntro take={take} />;
        case "running":
            return <TestTakeQuestions take={take} />;
        case "done":
            return <TestTakeResult take={take} />;
    }
};

export { TestTakePanel };
