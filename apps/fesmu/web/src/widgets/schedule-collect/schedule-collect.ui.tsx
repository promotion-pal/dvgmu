import { useState } from "react";
import type { FC, ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import { ClipboardListIcon, Trash2Icon } from "lucide-react";
import { PromFieldInput, PromFieldSelect, PromFieldTextArea } from "@/features/lib/form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DAY_OPTIONS, SUBJ_TYPE_OPTIONS } from "./schedule-collect.schema";
import type { ScheduleCollectEntry } from "./schedule-collect.schema";
import { useScheduleCollect } from "./schedule-collect.fn";
import { maxScheduleCollectTableSize, parseScheduleCollectTable, scheduleCollectTableHeader } from "./schedule-collect.table";

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
    const { form, handleSubmit, editing, cancelEdit, batch, maxRows } = collect;

    return (
        <FormProvider {...form}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Section title={editing === undefined ? "Занятие" : `Редактирование строки ${editing + 1}`}>
                    <PromFieldInput name="les" label="Номер занятия (пары)" placeholder="1" allowedPattern={/^\d*$/} className={FIELD_CLASS} />
                    <PromFieldInput name="aud" label="Аудитория" placeholder="312" className={FIELD_CLASS} />
                    <PromFieldInput name="date" label="Дата занятия" type="date" className={FIELD_CLASS} />
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

                <div className="flex flex-wrap justify-end gap-2">
                    {(editing !== undefined || form.formState.isDirty) && (
                        <Button type="button" variant="ghost" onClick={cancelEdit}>
                            {editing === undefined ? "Очистить форму" : "Отмена"}
                        </Button>
                    )}
                    <Button type="submit" disabled={editing === undefined && (batch?.rows.length ?? 0) >= maxRows}>
                        {editing === undefined ? "Добавить в пакет" : "Сохранить строку"}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
};

const dayLabel = (day: number) => DAY_OPTIONS.find((option) => option.value === day)?.label ?? day;

const ScheduleCollectTableInput: FC<{ collect: Collect }> = ({ collect }) => {
    const { tableInput: input, setTableInput: setInput } = collect;
    const [error, setError] = useState("");
    const blocked = collect.editing !== undefined || collect.form.formState.isDirty;
    const available = collect.maxRows - (collect.batch?.rows.length ?? 0);

    const addRows = () => {
        try {
            collect.appendRows(parseScheduleCollectTable(input, available));
            setInput("");
            setError("");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Не удалось прочитать таблицу");
        }
    };

    return (
        <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">Добавить из таблицы</summary>
            <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Вставьте таблицу с заголовком или загрузите CSV/TSV в UTF-8. Добавленные строки можно проверить и изменить перед отправкой.</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">{scheduleCollectTableHeader}</pre>
                <p className="text-xs text-muted-foreground">Для даты используйте ГГГГ-ММ-ДД. В столбце «Вид» укажите {SUBJ_TYPE_OPTIONS.map(({ value }) => value).join(" / ")}.</p>
                <label className="block text-sm" htmlFor="schedule-collect-file">Файл с занятиями</label>
                <input
                    id="schedule-collect-file"
                    type="file"
                    className={FIELD_CLASS}
                    accept=".csv,.tsv,text/csv,text/tab-separated-values"
                    onChange={async (event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        if (file.size > maxScheduleCollectTableSize) {
                            setError("Таблица превышает 512 КБ");
                            return;
                        }
                        try {
                            setInput(await file.text());
                            setError("");
                        } catch {
                            setError("Не удалось прочитать файл");
                        }
                    }}
                />
                <label className="block text-sm" htmlFor="schedule-collect-table">Таблица с занятиями</label>
                <textarea id="schedule-collect-table" className={FIELD_CLASS} rows={4} value={input} onChange={(event) => {
                    setInput(event.target.value);
                    setError("");
                }} />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {blocked && <p className="text-sm text-muted-foreground">Сначала сохраните или очистите текущую строку формы.</p>}
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={blocked || !input.trim() || !available} onClick={addRows}>Добавить строки в пакет</Button>
                    {input && <Button type="button" variant="ghost" onClick={() => { setInput(""); setError(""); }}>Очистить таблицу</Button>}
                </div>
            </div>
        </details>
    );
};

const ScheduleCollectBatch: FC<{ collect: Collect }> = ({ collect }) => {
    const { batch, editing, editRow, removeRow, sendBatch, reopenBatch, batchError, submitting, maxRows, form } = collect;
    if (!batch) return null;

    return (
        <Card className="p-5">
            <CardHeader className="px-0 pt-0">
                <CardTitle>Пакет к отправке</CardTitle>
                <CardDescription aria-live="polite">
                    {`${batch.rows.length} из ${maxRows} строк`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0">
                <ol className="divide-y">
                    {batch.rows.map((row, index) => (
                        <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0 break-words text-sm">
                                <p className="font-medium">{index + 1}. {row.subject} · {row.subjType}</p>
                                <p className="text-muted-foreground">{row.date} · группа {row.group} · пара {row.les} · ауд. {row.aud}</p>
                            </div>
                            {!batch.awaitingResult && (
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" disabled={editing !== undefined || form.formState.isDirty} onClick={() => editRow(index)} aria-label={`Изменить строку ${index + 1}`}>Изменить</Button>
                                    <Button type="button" size="sm" variant="ghost" disabled={editing !== undefined} onClick={() => removeRow(index)} aria-label={`Убрать строку ${index + 1}`}>Убрать</Button>
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
                {batchError && <p role="alert" className="text-sm text-destructive">{batchError}</p>}
                {batch.conflict && (
                    <p role="alert" className="text-sm text-destructive">Пакет с этим номером уже отправлен с другим составом. Перед новой отправкой уберите повторяющиеся строки.</p>
                )}
                <div className="flex justify-end">
                    {batch.conflict
                        ? <Button type="button" variant="outline" onClick={reopenBatch}>Подготовить новый пакет</Button>
                        : <Button type="button" disabled={submitting || editing !== undefined} onClick={() => void sendBatch()}>
                            {submitting ? "Отправка…" : batch.awaitingResult ? "Повторить отправку" : "Отправить пакет"}
                        </Button>}
                </div>
            </CardContent>
        </Card>
    );
};

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
                            <EmptyDescription>Добавьте занятия в пакет и отправьте его.</EmptyDescription>
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
            {!collect.batch?.awaitingResult && (
                <>
                    <ScheduleCollectTableInput collect={collect} />
                    <ScheduleCollectForm collect={collect} />
                </>
            )}
            <ScheduleCollectBatch collect={collect} />
            <ScheduleCollectSubmissions collect={collect} />
        </div>
    );
};

export { ScheduleCollectPanel, ScheduleCollectForm, ScheduleCollectSubmissions };
