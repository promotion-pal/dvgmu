import { useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { computerClassApi } from "./computer-class.api";
import { COMPUTER_CLASS_KIND_SLUGS, COMPUTER_CLASS_KIND_LABEL, KIND_BY_SLUG, computerClassSessionSchema } from "./computer-class.schema";
import type { ComputerClassFilters, ComputerClassSession, ComputerClassSessionForm, ComputerClassSessionFormInput } from "./computer-class.schema";
import { useComputerClassUrlFilters } from "./computer-class.url";
import { buildAgenda, filterSessions, findConflicts, roomTones, roomsOf, todayIso } from "./computer-class.utils";

/** The server's own wording without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

const emptyForm = (date: string): ComputerClassSessionFormInput => ({
    date,
    timeStart: "",
    timeEnd: "",
    room: "",
    kind: "",
    title: "",
    groups: "",
    note: "",
});

/** The create/edit form of one session. */
const useComputerClassForm = (today: string, onSaved: () => Promise<void>) => {
    const [editing, setEditing] = useState<ComputerClassSession>();
    const form = useForm<ComputerClassSessionFormInput, unknown, ComputerClassSessionForm>({
        resolver: zodResolver(computerClassSessionSchema),
        defaultValues: emptyForm(today),
    });

    const handleSubmit = form.handleSubmit(async (values) => {
        try {
            if (editing) await computerClassApi.update(editing.id, values);
            else await computerClassApi.create(values);
            toast.success(editing ? "Запись обновлена" : "Запись добавлена");
            await onSaved();
        } catch (error) {
            console.error("Ошибка при сохранении записи компьютерного класса:", error);
            toast.error(errorText(error, "Не удалось сохранить запись"));
        }
    });

    return { form, handleSubmit, editing, setEditing };
};

interface UseComputerClassProps {
    /** Staff may add, edit and delete; the public page only reads. */
    editable?: boolean;
}

/** State of the computer classes' timetable: the sessions, the filters (kept
 * in the URL, so a link opens on the same room and dates) and, for staff,
 * adding/editing/deleting. */
const useComputerClass = ({ editable = false }: UseComputerClassProps = {}) => {
    const [sessions, setSessions] = useState<ComputerClassSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [today] = useState(todayIso);
    const [filters, setFilters] = useComputerClassUrlFilters();

    const fetch = async () => {
        setLoading(true);
        setError(false);
        try {
            setSessions(await computerClassApi.fetch());
            // A bare link shows what's ahead; past testing is a date filter away.
            setFilters((current) => (current.dateFrom || current.dateTo ? current : { ...current, dateFrom: today }));
        } catch (err) {
            console.error("Ошибка при получении расписания компьютерных классов:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const modal = useCommonModal();
    const formState = useComputerClassForm(today, async () => {
        modal.closeModal();
        await fetch();
    });

    const openCreate = () => {
        formState.setEditing(undefined);
        formState.form.reset({ ...emptyForm(filters.dateFrom ?? today), room: filters.room ?? "" });
        modal.openModal("create");
    };

    const openEdit = (session: ComputerClassSession) => {
        formState.setEditing(session);
        formState.form.reset({
            date: session.date,
            timeStart: session.timeStart,
            timeEnd: session.timeEnd,
            room: session.room,
            kind: session.kind,
            title: session.title,
            groups: session.groups ?? "",
            note: session.note ?? "",
        });
        modal.openModal("update");
    };

    const remove = async (session: ComputerClassSession) => {
        if (!confirm(`Удалить «${session.title}» (${session.room})?`)) return;
        try {
            await computerClassApi.remove(session.id);
            toast.success("Запись удалена");
            await fetch();
        } catch (err) {
            console.error("Ошибка при удалении записи компьютерного класса:", err);
            toast.error(errorText(err, "Не удалось удалить запись"));
        }
    };

    const rooms = useMemo(() => roomsOf(sessions), [sessions]);
    const tones = useMemo(() => roomTones(rooms), [rooms]);
    // Clashes are for those who can fix them; the public page shows the timetable as is.
    // Found over every session, not just the visible ones: a clash with a filtered-out kind is still a clash.
    const conflicts = useMemo(() => (editable ? findConflicts(sessions) : new Map<string, ComputerClassSession[]>()), [editable, sessions]);
    const visible = useMemo(() => filterSessions(sessions, filters, conflicts), [sessions, filters, conflicts]);
    const agenda = useMemo(() => buildAgenda(visible, tones, conflicts), [visible, tones, conflicts]);
    // Clashes within the chosen dates and room, whatever the kind and clash filters say.
    const conflictCount = useMemo(
        () => filterSessions(sessions, { ...filters, kind: undefined, conflicts: "only" }, conflicts).length,
        [sessions, filters, conflicts],
    );

    const changeFilters = (change: Partial<ComputerClassFilters>) => setFilters((current) => ({ ...current, ...change }));
    const resetFilters = () => setFilters({});

    return {
        fetch,
        loading,
        error,
        empty: sessions.length === 0,
        editable,
        filters,
        changeFilters,
        resetFilters,
        hasActiveFilters: Boolean(filters.room || filters.kind || filters.conflicts || filters.dateFrom || filters.dateTo),
        roomOptions: rooms.map((room) => ({ value: room, label: room })),
        kindOptions: COMPUTER_CLASS_KIND_SLUGS.map((slug) => ({ value: slug, label: COMPUTER_CLASS_KIND_LABEL[KIND_BY_SLUG[slug]] })),
        tones,
        conflicts,
        conflictCount,
        visible,
        agenda,
        modal,
        formState,
        openCreate,
        openEdit,
        remove,
    };
};

export { useComputerClass };
