import type { FC, ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import { ClipboardListIcon, Trash2Icon } from "lucide-react";
import { PromDateField, PromFieldInput, PromFieldSelect, PromFieldTextArea } from "@/features/lib/form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DAY_OPTIONS, SUBJ_TYPE_OPTIONS } from "./schedule-collect.schema";
import type { ScheduleCollectEntry } from "./schedule-collect.schema";
import { useScheduleCollect } from "./schedule-collect.fn";

const FIELD_CLASS = "border rounded-lg p-2 w-full bg-background text-sm";

const Section: FC<{ title: string; description?: string; children: ReactNode }> = ({ title, description, children }) => (
    <Card className="p-5">
        <CardHeader className="px-0 pt-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="px-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        </CardContent>
    </Card>
);

type Collect = ReturnType<typeof useScheduleCollect>;

const ScheduleCollectForm: FC<{ collect: Collect }> = ({ collect }) => {
    const { form, handleSubmit, submitting } = collect;

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Section title="Занятие" description="Время и место проведения — день недели определится по дате.">
                    <PromFieldInput name="les" label="Номер занятия (пары)" placeholder="1" allowedPattern={/^\d*$/} className={FIELD_CLASS} />
                    <PromFieldInput name="aud" label="Аудитория" placeholder="312" className={FIELD_CLASS} />
                    <PromDateField name="date" label="Дата занятия" />
                    <PromFieldInput name="group" label="Группа" className={FIELD_CLASS} />
                </Section>

                <Section title="Преподаватель и дисциплина" description="Кто ведёт занятие и по какому предмету.">
                    <PromFieldInput name="namePosition" label="Должность преподавателя" placeholder="доцент" className={FIELD_CLASS} />
                    <PromFieldInput name="nameLastName" label="Фамилия преподавателя" placeholder="Иванов" className={FIELD_CLASS} />
                    <PromFieldInput name="nameFirstName" label="Имя преподавателя" placeholder="Иван" className={FIELD_CLASS} />
                    <PromFieldInput name="nameMiddleName" label="Отчество преподавателя" placeholder="Иванович" className={FIELD_CLASS} />
                    <PromFieldInput name="subject" label="Дисциплина" placeholder="Анатомия" className={FIELD_CLASS} />
                    <PromFieldSelect name="subjType" label="Вид занятия" options={SUBJ_TYPE_OPTIONS} placeholder="" className={FIELD_CLASS} />
                    <PromFieldTextArea name="themas" label="Тема занятия" placeholder="Необязательно" className="sm:col-span-2 lg:col-span-3 border rounded-lg p-2 w-full resize-y text-sm" rows={2} />
                </Section>

                <Section title="Замена преподавателя" description="Заполняйте только если занятие проводит замещающий преподаватель.">
                    <PromFieldInput name="substitutionPosition" label="Должность замещающего" placeholder="Необязательно" className={FIELD_CLASS} />
                    <PromFieldInput name="substitutionLastName" label="Фамилия замещающего" placeholder="Необязательно" className={FIELD_CLASS} />
                    <PromFieldInput name="substitutionFirstName" label="Имя замещающего" placeholder="Необязательно" className={FIELD_CLASS} />
                    <PromFieldInput name="substitutionMiddleName" label="Отчество замещающего" placeholder="Необязательно" className={FIELD_CLASS} />
                    <PromFieldInput name="substitutionSubject" label="Дисциплина замены" placeholder="Необязательно" className={FIELD_CLASS} />
                    <PromFieldSelect
                        name="substitutionSubjType"
                        label="Вид занятия замены"
                        options={SUBJ_TYPE_OPTIONS}
                        placeholder="Необязательно"
                        className={FIELD_CLASS}
                    />
                    <PromFieldTextArea name="substitutionThemas" label="Тема занятия замены" placeholder="Необязательно" className="sm:col-span-2 lg:col-span-3 border rounded-lg p-2 w-full resize-y text-sm" rows={2} />
                </Section>

                <div className="flex justify-end">
                    <Button type="submit" disabled={submitting}>
                        {submitting ? "Отправка…" : "Отправить сведения"}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
};

const dayLabel = (day: number) => DAY_OPTIONS.find((option) => option.value === day)?.label ?? day;

const SubmittedRow: FC<{ entry: ScheduleCollectEntry; onRemove: () => void }> = ({ entry, onRemove }) => (
    <TableRow>
        <TableCell className="font-medium">{entry.date}</TableCell>
        <TableCell>{dayLabel(entry.day)}</TableCell>
        <TableCell>{entry.group}</TableCell>
        <TableCell>{entry.les}</TableCell>
        <TableCell>{entry.aud}</TableCell>
        <TableCell>{entry.subject}</TableCell>
        <TableCell>{entry.subjType}</TableCell>
        <TableCell>{entry.name}</TableCell>
        <TableCell>
            {entry.substitutionName ? <Badge variant="secondary">{entry.substitutionName}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
            <button
                type="button"
                aria-label="Скрыть из списка этого сеанса"
                title="Скрыть из списка этого сеанса"
                onClick={onRemove}
                className="icon-inline size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
                <Trash2Icon className="size-4" />
            </button>
        </TableCell>
    </TableRow>
);

const ScheduleCollectSubmissions: FC<{ collect: Collect }> = ({ collect }) => {
    const { submitted, removeSubmitted, clearSubmitted } = collect;

    return (
        <Card className="p-5">
            <CardHeader className="px-0 pt-0 flex-row items-center justify-between gap-3">
                <div>
                    <CardTitle>Заполнено в этом сеансе</CardTitle>
                    <CardDescription>Список того, что вы уже отправили — для проверки перед закрытием страницы.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">{submitted.length}</Badge>
                    {submitted.length > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={clearSubmitted}>
                            Скрыть все
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-0">
                {submitted.length === 0 ? (
                    <Empty className="rounded-xl border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ClipboardListIcon />
                            </EmptyMedia>
                            <EmptyTitle>Пока ничего не отправлено</EmptyTitle>
                            <EmptyDescription>Заполните форму и нажмите «Отправить сведения».</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>День</TableHead>
                                <TableHead>Группа</TableHead>
                                <TableHead>Пара</TableHead>
                                <TableHead>Аудитория</TableHead>
                                <TableHead>Дисциплина</TableHead>
                                <TableHead>Вид</TableHead>
                                <TableHead>Преподаватель</TableHead>
                                <TableHead>Замена</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submitted.map((entry) => (
                                <SubmittedRow key={entry.id} entry={entry} onRemove={() => removeSubmitted(entry.id)} />
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
};

const ScheduleCollectPanel: FC<{ userId: string }> = ({ userId }) => {
    const collect = useScheduleCollect(userId);

    return (
        <div className="flex flex-col gap-6">
            <ScheduleCollectForm collect={collect} />
            <ScheduleCollectSubmissions collect={collect} />
        </div>
    );
};

export { ScheduleCollectPanel, ScheduleCollectForm, ScheduleCollectSubmissions };
