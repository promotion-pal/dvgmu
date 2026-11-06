import { useRef } from "react";
import type { FC } from "react";
import { CheckCircle2Icon, FilePlusIcon, LoaderCircleIcon, TriangleAlertIcon, XCircleIcon, XIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { PromFieldInput } from "@/features/lib/form";
import { CommonModal } from "@/shared/components/modal";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { BulkItem, BulkItemStatus, useBulkImport } from "./test-builder.bulk.fn";
import { TestVersion } from "./test-builder.schema";
import type { BulkImportForm } from "./test-builder.schema";

type BulkImport = ReturnType<typeof useBulkImport>;

export const IMPORT_ACCEPT = ".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const STATUS: Record<BulkItemStatus, { label: string; tone: string }> = {
    reading: { label: "Чтение…", tone: "text-muted-foreground" },
    ready: { label: "Готов", tone: "text-foreground" },
    unreadable: { label: "Не прочитан", tone: "text-destructive" },
    creating: { label: "Создание…", tone: "text-muted-foreground" },
    created: { label: "Создан", tone: "text-emerald-700 dark:text-emerald-400" },
    failed: { label: "Ошибка", tone: "text-destructive" },
};

const StatusIcon: FC<{ status: BulkItemStatus }> = ({ status }) => {
    if (status === "reading" || status === "creating") return <LoaderCircleIcon className="size-4 animate-spin" />;
    if (status === "created") return <CheckCircle2Icon className="size-4" />;
    if (status === "unreadable" || status === "failed") return <XCircleIcon className="size-4" />;
    return null;
};

const ItemRow: FC<{ item: BulkItem; name?: string; state: BulkImport }> = ({ item, name, state }) => {
    const warnings = item.draft?.warnings ?? [];
    const status = STATUS[item.status];
    const removable = !state.running && item.status !== "created";

    return (
        <TableRow>
            <TableCell className="max-w-48 whitespace-normal break-all text-xs text-muted-foreground">{item.file.name}</TableCell>
            <TableCell className="max-w-64 whitespace-normal font-medium">{name ?? "—"}</TableCell>
            <TableCell className="text-center">{item.draft?.form.questions.length ?? "—"}</TableCell>
            <TableCell className="max-w-72 whitespace-normal text-xs">
                {item.error && <span className="text-destructive">{item.error}</span>}
                {!item.error && warnings.length > 0 && (
                    <details>
                        <summary className="flex cursor-pointer items-center gap-1 text-amber-700 dark:text-amber-400">
                            <TriangleAlertIcon className="size-3.5 shrink-0" />
                            Проверить: {warnings.length}
                        </summary>
                        <ul className="ml-4 mt-1 list-disc">
                            {warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </TableCell>
            <TableCell className={cn("whitespace-nowrap text-sm", status.tone)}>
                <span className="flex items-center gap-1.5">
                    <StatusIcon status={item.status} />
                    {status.label}
                </span>
            </TableCell>
            <TableCell>
                {removable && (
                    <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Убрать файл" onClick={() => state.removeItem(item.file)}>
                        <XIcon className="size-4" />
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
};

interface TestBuilderBulkImportModalProps {
    state: BulkImport;
    departmentSuggestions: string[];
    disciplineSuggestions: string[];
    exam?: boolean;
}

/** Bulk import: many files into one department and discipline; with a topic
 * the tests are numbered "<topic> N". Files are read first and shown with their
 * warnings; the tests are created only on the button. */
export const TestBuilderBulkImportModal: FC<TestBuilderBulkImportModalProps> = ({ state, departmentSuggestions, disciplineSuggestions, exam = false }) => {
    const input = useRef<HTMLInputElement>(null);
    const FieldInput = PromFieldInput<BulkImportForm>;
    const count = state.pending.length;

    return (
        <CommonModal
            open={state.modal.open}
            onOpenChange={(open) => !state.running && state.modal.onOpenChange(open)}
            title={`Массовый импорт тестов ${state.form.getValues("version") === TestVersion.V2 ? "V2" : "V1"}`}
            description="Каждый файл .docx или .txt — отдельный тест: вопрос, варианты ответа, «@» перед верными. Без проверки каждого теста в форме — проверьте предупреждения в таблице."
            className="sm:max-w-5xl"
        >
            <FormProvider {...state.form}>
                <form onSubmit={state.create} className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {exam && <FieldInput name="semester" label="Семестр (1–12)" placeholder="Например: 3" maxLength={2} />}
                        <FieldInput name="department" label={exam ? "Направление обучения (факультет)" : "Кафедра"} placeholder={exam ? "Например: Педиатрический факультет" : "Например: Кафедра анатомии"} maxLength={255} suggestions={departmentSuggestions} />
                        <FieldInput name="discipline" label={exam ? "Предмет" : "Дисциплина"} placeholder="Например: Анатомия человека" maxLength={255} suggestions={disciplineSuggestions} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                        <FieldInput name="topic" label="Тема" placeholder="Необязательно, например: Токсикология" maxLength={240} />
                        <FieldInput name="start" label="Нумерация с" allowedPattern={/^\d{0,4}$/} />
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground">
                        С темой тесты называются «Тема 1», «Тема 2»… по порядку имён файлов; номер продолжает уже существующие тесты с такой темой. Без
                        темы каждый тест называется по имени файла.
                    </p>

                    <div className="overflow-x-auto rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Файл</TableHead>
                                    <TableHead>Тест</TableHead>
                                    <TableHead className="text-center">Вопросов</TableHead>
                                    <TableHead>Предупреждения</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {state.items.map((item) => (
                                    <ItemRow key={`${item.file.name}/${item.file.size}`} item={item} name={state.names.get(item.file)} state={state} />
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button type="button" variant="outline" size="sm" disabled={state.running} onClick={() => input.current?.click()}>
                            <FilePlusIcon className="size-4" />
                            Добавить файлы
                        </Button>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            accept={IMPORT_ACCEPT}
                            className="hidden"
                            onChange={(event) => {
                                const files = [...(event.target.files ?? [])];
                                event.target.value = "";
                                void state.addFiles(files);
                            }}
                        />
                        {state.done ? (
                            <Button type="button" onClick={() => state.modal.closeModal()}>
                                Готово
                            </Button>
                        ) : (
                            <Button type="submit" disabled={state.running || state.reading || count === 0}>
                                {state.running && !state.reading ? "Создание…" : `Создать тестов: ${count}`}
                            </Button>
                        )}
                    </div>
                </form>
            </FormProvider>
        </CommonModal>
    );
};
