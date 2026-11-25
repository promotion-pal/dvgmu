import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorText, libraryApi } from "@/features/library";
import type { Manual, ManualCard } from "@/features/library";

export const emptyCard = (discipline = ""): ManualCard => ({
    discipline,
    title: "",
    specialty: "",
    course: 0,
    semester: 0,
    authors: "",
    annotation: "",
});

export const cardOf = (m: ManualCard): ManualCard => ({
    discipline: m.discipline,
    title: m.title,
    specialty: m.specialty,
    course: m.course,
    semester: m.semester,
    authors: m.authors,
    annotation: m.annotation,
});

/** Методички: список по дисциплинам, поиск, создание. На открытой странице
 *  (open) — только опубликованные, без входа: дисциплины берутся из списка. */
export function useManualList({ open = false }: { open?: boolean } = {}) {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [disciplines, setDisciplines] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");
    const [discipline, setDiscipline] = useState<string>();
    const [createOpen, setCreateOpen] = useState(false);
    const [card, setCard] = useState<ManualCard>(emptyCard);
    const [saving, setSaving] = useState(false);

    // Состояние ставится только в колбэках ответа — и при открытии, и при обновлении.
    const fetch = useCallback(
        () =>
            Promise.all([libraryApi.manuals(), open ? undefined : libraryApi.disciplines()]).then(
                ([list, names]) => {
                    setManuals(list);
                    setDisciplines(names ?? [...new Set(list.map((m) => m.discipline))].sort((a, b) => a.localeCompare(b, "ru")));
                    setError(false);
                    setLoading(false);
                },
                () => {
                    setError(true);
                    setLoading(false);
                },
            ),
        [open],
    );

    useEffect(() => {
        fetch();
    }, [fetch]);

    /** Отфильтрованные методички, сгруппированные по дисциплине. */
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const byDiscipline = new Map<string, Manual[]>();
        for (const m of manuals) {
            if (discipline && m.discipline !== discipline) continue;
            if (q && !`${m.title} ${m.authors} ${m.annotation} ${m.specialty}`.toLowerCase().includes(q)) continue;
            byDiscipline.set(m.discipline, [...(byDiscipline.get(m.discipline) ?? []), m]);
        }
        return [...byDiscipline.entries()].sort(([a], [b]) => a.localeCompare(b, "ru"));
    }, [manuals, query, discipline]);

    const openCreate = () => {
        setCard(emptyCard(discipline));
        setCreateOpen(true);
    };

    /** Создаёт методичку и отдаёт её id — страница сразу ведёт в редактор. */
    const create = async (): Promise<string | undefined> => {
        setSaving(true);
        try {
            const id = await libraryApi.manualCreate(card);
            setCreateOpen(false);
            return id;
        } catch (e) {
            toast.error(errorText(e, "Не удалось создать методичку"));
        } finally {
            setSaving(false);
        }
    };

    return {
        manuals, groups, disciplines, loading, error, fetch,
        query, setQuery, discipline, setDiscipline,
        createForm: { open: createOpen, setOpen: setCreateOpen, card, setCard, saving },
        openCreate, create,
        count: groups.reduce((n, [, list]) => n + list.length, 0),
    };
}

export type ManualListState = ReturnType<typeof useManualList>;
