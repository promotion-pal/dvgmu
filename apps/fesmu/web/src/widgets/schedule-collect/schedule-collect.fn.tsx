import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { scheduleCollectApi } from "./schedule-collect.api";
import { EMPTY_SCHEDULE_COLLECT_ENTRY, scheduleCollectEntrySchema } from "./schedule-collect.schema";
import type { ScheduleCollectEntry, ScheduleCollectEntryInput } from "./schedule-collect.schema";

const SESSION_KEY = "schedule-collect:submitted";

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const readSession = (): ScheduleCollectEntry[] => {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as ScheduleCollectEntry[]) : [];
    } catch {
        return [];
    }
};

const writeSession = (list: ScheduleCollectEntry[]) => {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(list));
    } catch {
        // Best-effort only: a full or blocked storage must not break submitting.
    }
};

/** Fields worth carrying into the next row: a teacher usually enters several
 * lessons in a row for themselves, on the same day. */
const carryOver = (values: ScheduleCollectEntryInput): ScheduleCollectEntryInput => ({
    ...EMPTY_SCHEDULE_COLLECT_ENTRY,
    date: values.date,
    namePosition: values.namePosition,
    nameLastName: values.nameLastName,
    nameFirstName: values.nameFirstName,
    nameMiddleName: values.nameMiddleName,
});

/** State of the collector page: one form for the row being entered, and the
 * list of rows already sent this session, so it's visible what was filled in. */
const useScheduleCollect = () => {
    const [submitted, setSubmitted] = useState<ScheduleCollectEntry[]>(() => readSession());
    const [submitting, setSubmitting] = useState(false);

    const form = useForm({
        resolver: zodResolver(scheduleCollectEntrySchema),
        defaultValues: EMPTY_SCHEDULE_COLLECT_ENTRY,
    });

    const handleSubmit = form.handleSubmit(async (values: ScheduleCollectEntryInput) => {
        setSubmitting(true);
        try {
            const entry = await scheduleCollectApi.create(values);
            setSubmitted((current) => {
                const next = [entry, ...current];
                writeSession(next);
                return next;
            });
            form.reset(carryOver(values));
            toast.success("Запись добавлена в расписание");
        } catch (error) {
            console.error("Ошибка при добавлении записи расписания:", error);
            toast.error(errorMessage(error, "Не удалось сохранить запись"));
        } finally {
            setSubmitting(false);
        }
    });

    const removeSubmitted = (id: string) =>
        setSubmitted((current) => {
            const next = current.filter((entry) => entry.id !== id);
            writeSession(next);
            return next;
        });

    const clearSubmitted = () => {
        setSubmitted([]);
        writeSession([]);
    };

    return { form, handleSubmit, submitting, submitted, removeSubmitted, clearSubmitted };
};

export { useScheduleCollect };
