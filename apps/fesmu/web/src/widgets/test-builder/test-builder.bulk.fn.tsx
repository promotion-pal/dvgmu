import { useEffect, useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { testBuilderApi } from "./test-builder.api";
import type { TestBuilderApi } from "./test-builder.api";
import type { TestImportDraft } from "./test-builder.api";
import { bulkImportSchema, TestVersion } from "./test-builder.schema";
import type { BulkImportForm, Test } from "./test-builder.schema";
import { byFileName, nextTopicNumber } from "./test-builder.utils";

export type BulkItemStatus = "reading" | "ready" | "unreadable" | "creating" | "created" | "failed";

/** One file of a bulk import: read into a draft, then created as a test. */
export interface BulkItem {
    file: File;
    status: BulkItemStatus;
    draft?: TestImportDraft;
    /** Why reading or creating failed, in the server's words. */
    error?: string;
}

const errorText = (error: unknown, fallback: string) => (error instanceof ConnectError ? error.rawMessage || fallback : fallback);

const fileStem = (file: File) => file.name.replace(/\.[^.]+$/, "").trim();

/** Bulk import: several .docx/.txt files at once, all into one department and
 * discipline. With a topic, the tests are named "<topic> N", numbered on from
 * the tests already there; without one, each keeps its file's name. */
export const useBulkImport = (tests: Test[], onDone: () => Promise<void>, version: BulkImportForm["version"] = TestVersion.V1, api: TestBuilderApi = testBuilderApi, exam = false) => {
    const modal = useCommonModal();
    const [items, setItems] = useState<BulkItem[]>([]);
    const [running, setRunning] = useState(false);
    const form = useForm<BulkImportForm>({
        resolver: zodResolver(bulkImportSchema.superRefine((values, ctx) => {
            if (exam && !/^([1-9]|1[0-2])$/.test(values.semester)) ctx.addIssue({ code: "custom", path: ["semester"], message: "Укажите семестр от 1 до 12" });
        })),
        defaultValues: { department: "", discipline: "", semester: "", version, topic: "", start: "1" },
    });
    const topic = useWatch({ control: form.control, name: "topic" });
    const start = Number(useWatch({ control: form.control, name: "start" })) || 1;

    const patch = (file: File, change: Partial<BulkItem>) =>
        setItems((current) => current.map((item) => (item.file === file ? { ...item, ...change } : item)));

    /** Reads the files one by one; each shows its questions and warnings as it comes. */
    const read = async (files: File[]) => {
        for (const file of files) {
            try {
                patch(file, { status: "ready", draft: await api.importParse(file) });
            } catch (error) {
                patch(file, { status: "unreadable", error: errorText(error, "Не удалось прочитать файл") });
            }
        }
    };

    const addFiles = async (files: File[], already: BulkItem[] = items) => {
        const known = new Set(already.map((item) => `${item.file.name}/${item.file.size}`));
        const fresh = files.filter((file) => !known.has(`${file.name}/${file.size}`));
        if (fresh.length === 0) return;
        setItems((current) => [...current, ...fresh.map((file) => ({ file, status: "reading" as const }))].sort((a, b) => byFileName(a.file, b.file)));
        setRunning(true);
        await read(fresh);
        setRunning(false);
    };

    const open = (files: File[]) => {
        setItems([]);
        form.reset({ department: "", discipline: "", semester: "", version, topic: "", start: "1" });
        modal.openModal("create");
        void addFiles(files, []);
    };

    const removeItem = (file: File) => setItems((current) => current.filter((item) => item.file !== file));

    /** The topic each file's test gets, in file-name order (unreadable files skipped). */
    const names = useMemo(() => {
        const base = topic.trim();
        const map = new Map<File, string>();
        let n = start;
        for (const item of items) {
            if (item.status === "unreadable") continue;
            map.set(item.file, base ? `${base} ${n++}` : fileStem(item.file));
        }
        return map;
    }, [items, topic, start]);

    // Typing a topic suggests numbering on from the tests already named so;
    // the number can still be changed by hand afterwards.
    useEffect(() => {
        form.setValue("start", String(nextTopicNumber(tests, topic)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topic]);

    const pending = items.filter((item) => item.status === "ready" || item.status === "failed");

    const create = form.handleSubmit(async (values) => {
        setRunning(true);
        let created = 0;
        for (const item of pending) {
            if (!item.draft) continue;
            patch(item.file, { status: "creating", error: undefined });
            try {
                await api.create({
                    ...item.draft.form,
                    department: values.department,
                    discipline: values.discipline,
                    semester: String(Number(values.semester) || ""),
                    version: values.version,
                    topic: names.get(item.file) ?? fileStem(item.file),
                });
                patch(item.file, { status: "created" });
                created++;
            } catch (error) {
                patch(item.file, { status: "failed", error: errorText(error, "Не удалось создать тест") });
            }
        }
        setRunning(false);
        if (created > 0) {
            toast.success(`Создано тестов: ${created}`);
            await onDone();
        }
        if (created < pending.length) toast.error("Не все тесты созданы — причина указана в строке файла");
    });

    return {
        modal,
        form,
        items,
        names,
        running,
        pending,
        open,
        addFiles,
        removeItem,
        create,
        reading: items.some((item) => item.status === "reading"),
        done: items.length > 0 && items.every((item) => item.status === "created" || item.status === "unreadable"),
        api,
    };
};
