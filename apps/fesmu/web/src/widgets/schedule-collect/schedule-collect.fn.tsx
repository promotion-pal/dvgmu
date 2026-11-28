import { useRef, useState } from "react";
import { Code, ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { scheduleCollectApi } from "./schedule-collect.api";
import { EMPTY_SCHEDULE_COLLECT_ENTRY, scheduleCollectEntrySchema } from "./schedule-collect.schema";
import type { ScheduleCollectEntry, ScheduleCollectEntryInput } from "./schedule-collect.schema";

const SESSION_KEY = "schedule-collect:submitted";
const MAX_BATCH_ROWS = 50;

type Batch = { id: string; rows: ScheduleCollectEntryInput[]; awaitingResult?: boolean; conflict?: boolean };

const readSession = <T,>(key: string, fallback: T): T => {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const writeSession = (key: string, value: unknown) => {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Best-effort only: a full or blocked storage must not break submitting.
    }
};

/** Fields worth carrying into the next row: a teacher usually enters several
 * lessons in a row for themselves, on the same day. */
const carryOver = (values: Pick<ScheduleCollectEntryInput, "date" | "namePosition" | "nameLastName" | "nameFirstName"> & { nameMiddleName?: string }): ScheduleCollectEntryInput => ({
    ...EMPTY_SCHEDULE_COLLECT_ENTRY,
    date: values.date,
    namePosition: values.namePosition,
    nameLastName: values.nameLastName,
    nameFirstName: values.nameFirstName,
    nameMiddleName: values.nameMiddleName ?? "",
});

const useScheduleCollect = (userId: string) => {
    const key = `${SESSION_KEY}:${userId}`;
    const draftKey = `${key}:draft`;
    const [submitted, setSubmitted] = useState<ScheduleCollectEntry[]>(() => readSession(key, []));
    const [batch, setBatch] = useState(() => readSession<Batch | null>(draftKey, null));
    const [editing, setEditing] = useState<number>();
    const [submitting, setSubmitting] = useState(false);
    const [batchError, setBatchError] = useState("");
    const [tableInput, setTableInput] = useState("");
    const requestInFlight = useRef(false);

    const form = useForm({
        resolver: zodResolver(scheduleCollectEntrySchema),
        defaultValues: EMPTY_SCHEDULE_COLLECT_ENTRY,
    });

    const updateBatch = (next: Batch | null) => {
        writeSession(draftKey, next);
        setBatch(next);
    };

    const appendRows = (incoming: ScheduleCollectEntryInput[]) => {
        const rows = batch?.rows ?? [];
        if (batch?.awaitingResult || submitting || rows.length + incoming.length > MAX_BATCH_ROWS) return;
        setBatchError("");
        updateBatch({ id: batch?.id ?? crypto.randomUUID(), rows: [...rows, ...incoming] });
    };

    const handleSubmit = form.handleSubmit((values: ScheduleCollectEntryInput) => {
        if (batch?.awaitingResult || submitting) return;
        const rows = batch?.rows ?? [];
        if (editing === undefined && rows.length >= MAX_BATCH_ROWS) return;
        if (editing === undefined) appendRows([values]);
        else if (batch) {
            setBatchError("");
            updateBatch({ ...batch, rows: rows.map((row, index) => index === editing ? values : row) });
        }
        setEditing(undefined);
        form.reset(carryOver(values), { keepFieldsRef: true });
    });

    const editRow = (index: number) => {
        if (!batch || batch.awaitingResult) return;
        setEditing(index);
        form.reset(batch.rows[index], { keepFieldsRef: true });
    };

    const cancelEdit = () => {
        setEditing(undefined);
        form.reset(carryOver(form.getValues()), { keepFieldsRef: true });
    };

    const removeRow = (index: number) => {
        if (!batch || batch.awaitingResult || editing !== undefined) return;
        const rows = batch.rows.filter((_, position) => position !== index);
        setBatchError("");
        updateBatch(rows.length ? { ...batch, rows } : null);
    };

    const reopenBatch = () => {
        if (!batch?.conflict) return;
        setBatchError("");
        updateBatch({ id: crypto.randomUUID(), rows: batch.rows });
    };

    const sendBatch = async () => {
        if (!batch || batch.conflict || editing !== undefined || requestInFlight.current) return;
        if (form.formState.isDirty || tableInput.trim()) {
            setBatchError("Добавьте заполненное занятие и строки таблицы в пакет или очистите поля ввода");
            return;
        }
        requestInFlight.current = true;
        setBatchError("");
        updateBatch({ ...batch, awaitingResult: true });
        setSubmitting(true);
        try {
            const entries = await scheduleCollectApi.createBatch(batch.id, batch.rows);
            setSubmitted((current) => {
                const next = [...entries, ...current.filter((entry) => entry.batchId !== batch.id)];
                writeSession(key, next);
                return next;
            });
            updateBatch(null);
            toast.success("Сведения отправлены");
        } catch (error) {
            const problem = ConnectError.from(error);
            if (problem.code === Code.InvalidArgument) {
                updateBatch({ ...batch, awaitingResult: false });
                setBatchError(problem.rawMessage);
            } else if (problem.code === Code.AlreadyExists) {
                updateBatch({ ...batch, awaitingResult: true, conflict: true });
            } else {
                setBatchError(problem.code === Code.PermissionDenied
                    ? "Отправка недоступна с текущими правами."
                    : "Не удалось подтвердить отправку. Повторите её для этого пакета.");
            }
        } finally {
            requestInFlight.current = false;
            setSubmitting(false);
        }
    };

    const removeSubmitted = (id: string) =>
        setSubmitted((current) => {
            const next = current.filter((entry) => entry.id !== id);
            writeSession(key, next);
            return next;
        });

    const clearSubmitted = () => {
        setSubmitted([]);
        writeSession(key, []);
    };

    return { form, handleSubmit, submitting, submitted, removeSubmitted, clearSubmitted, batch, editing, editRow, cancelEdit, removeRow, appendRows, sendBatch, reopenBatch, batchError, tableInput, setTableInput, maxRows: MAX_BATCH_ROWS };
};

export { useScheduleCollect };
