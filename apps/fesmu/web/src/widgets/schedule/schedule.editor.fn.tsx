import { useEffect, useMemo, useState } from "react";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ROUTE } from "@/shared/config/path";
import { scheduleApi } from "./schedule.api";
import {
    emptyEntry,
    emptySubject,
    emptyTimetable,
    entriesUsing,
    findConflicts,
    newId,
    parseGroupInput,
    programIdFor,
    validateTimetable,
    withoutGroup,
} from "./schedule.editor.utils";
import type { ScheduleEditorSection } from "./schedule.editor.utils";
import { EMPTY_SCHEDULE_FILTERS } from "./schedule.schema";
import type { ScheduleEntry, SchedulePeriod, ScheduleSlot, ScheduleSubject, ScheduleTimetable } from "./schedule.schema";
import { buildScheduleView, todayIso } from "./schedule.utils";

type EditorTab = ScheduleEditorSection | "preview";
type ListKey = "exams" | "credits" | "agreedBy";
type ItemKey = "slots" | "subjects" | "entries" | "periods";
type ItemOf<K extends ItemKey> = K extends "slots" ? ScheduleSlot : K extends "subjects" ? ScheduleSubject : K extends "entries" ? ScheduleEntry : SchedulePeriod;

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** State of the timetable editor: one draft of the whole timetable, edited
 * section by section, checked live and written to the API in one piece. */
const useScheduleEditor = (id?: string) => {
    const navigate = useNavigate();
    const [draft, setDraft] = useState<ScheduleTimetable>(emptyTimetable);
    const [updatedAt, setUpdatedAt] = useState<Timestamp>();
    const [loading, setLoading] = useState(Boolean(id));
    const [error, setError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<EditorTab>("general");
    const [today] = useState(todayIso);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        scheduleApi
            .byId(id)
            .then((result) => {
                if (cancelled) return;
                if (result) {
                    setDraft(result.timetable);
                    setUpdatedAt(result.updatedAt);
                } else setError(true);
            })
            .catch((cause) => {
                console.error("Ошибка при загрузке расписания:", cause);
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    const issues = useMemo(() => validateTimetable(draft), [draft]);
    const conflicts = useMemo(() => findConflicts(draft), [draft]);
    const previewView = useMemo(
        () => (issues.length === 0 ? buildScheduleView(draft, EMPTY_SCHEDULE_FILTERS, today) : undefined),
        [draft, issues, today],
    );

    const patch = (change: Partial<ScheduleTimetable>) => setDraft((current) => ({ ...current, ...change }));

    const setProgram = (change: Partial<ScheduleTimetable["program"]>) =>
        setDraft((current) => ({ ...current, program: { ...current.program, ...change } }));

    const setSemester = (change: Partial<ScheduleTimetable["semester"]>) =>
        setDraft((current) => ({ ...current, semester: { ...current.semester, ...change } }));

    const setLines = (key: ListKey, lines: string[]) => patch({ [key]: lines });

    const addGroups = (input: string) =>
        setDraft((current) => ({ ...current, groups: [...new Set([...current.groups, ...parseGroupInput(input)])] }));

    const removeGroup = (group: string) => {
        const used = entriesUsing(draft, { group }).length;
        if (used > 0 && !confirm(`Группа ${group} есть в занятиях (${used}). Убрать её оттуда? Занятия только для этой группы будут удалены.`)) return;
        setDraft((current) => withoutGroup(current, group));
    };

    const addItem = <K extends ItemKey>(key: K, item: ItemOf<K>) =>
        setDraft((current) => ({ ...current, [key]: [...current[key], item] }));

    const updateItem = <K extends ItemKey>(key: K, itemId: string, change: Partial<ItemOf<K>>) =>
        setDraft((current) => ({
            ...current,
            [key]: (current[key] as { id: string }[]).map((item) => (item.id === itemId ? { ...item, ...change } : item)),
        }));

    const removeItem = (key: ItemKey, itemId: string) =>
        setDraft((current) => ({ ...current, [key]: (current[key] as { id: string }[]).filter((item) => item.id !== itemId) }));

    const addSlot = () => {
        const last = draft.slots[draft.slots.length - 1];
        addItem("slots", { id: newId("s"), start: last?.end ?? "08:30", end: "" });
    };

    // A slot or a subject that lessons refer to can't just vanish: the author has to move those lessons first.
    const removeSlot = (slotId: string) => {
        const used = entriesUsing(draft, { slotId }).length;
        if (used > 0) return toast.error(`Пара используется в занятиях (${used}) — сначала перенесите их`);
        removeItem("slots", slotId);
    };

    const removeSubject = (subjectId: string) => {
        const used = entriesUsing(draft, { subjectId }).length;
        if (used > 0) return toast.error(`Предмет используется в занятиях (${used}) — сначала удалите их`);
        removeItem("subjects", subjectId);
    };

    const addSubject = () => addItem("subjects", emptySubject(draft.subjects));
    const addEntry = (weekday?: number) => {
        const entry = emptyEntry(draft, weekday);
        addItem("entries", entry);
        return entry.id;
    };
    const duplicateEntry = (entry: ScheduleEntry) => addItem("entries", { ...entry, id: newId("e") });
    const addPeriod = () => addItem("periods", { id: newId("p"), kind: "study", label: "", from: "", to: "" });

    const save = async () => {
        if (issues.length > 0) {
            toast.error(issues[0].message);
            setTab(issues[0].section);
            return;
        }

        const timetable: ScheduleTimetable = {
            ...draft,
            program: { ...draft.program, id: programIdFor(draft.program.code, draft.program.id) },
            stream: draft.stream?.trim() || undefined,
        };

        setSaving(true);
        try {
            if (timetable.id) await scheduleApi.update(timetable, updatedAt);
            else await scheduleApi.create(timetable);
            toast.success(timetable.id ? "Расписание сохранено" : "Расписание создано");
            navigate(ROUTE.STUDY.SCHEDULE);
        } catch (cause) {
            console.error("Ошибка при сохранении расписания:", cause);
            toast.error(errorMessage(cause, "Не удалось сохранить расписание"));
        } finally {
            setSaving(false);
        }
    };

    return {
        draft,
        isEditing: Boolean(id),
        loading,
        error,
        saving,
        tab,
        setTab,
        issues,
        conflicts,
        previewView,
        patch,
        setProgram,
        setSemester,
        setLines,
        addGroups,
        removeGroup,
        addSlot,
        addSubject,
        addEntry,
        addPeriod,
        duplicateEntry,
        updateItem,
        removeItem,
        removeSlot,
        removeSubject,
        save,
    };
};

type ScheduleEditor = ReturnType<typeof useScheduleEditor>;

export { useScheduleEditor };
export type { EditorTab, ScheduleEditor };
