import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorText, libraryApi } from "@/features/library";
import type { LibraryItem, LibraryItemInput, ReaderProgress } from "@/features/library";

export const emptyItemInput = (): LibraryItemInput => ({
    kind: "file",
    title: "",
    authors: "",
    year: 0,
    publisher: "",
    description: "",
    discipline: "",
    url: "",
});

const toInput = (it: LibraryItem): LibraryItemInput => ({
    kind: it.kind,
    title: it.title,
    authors: it.authors,
    year: it.year,
    publisher: it.publisher,
    description: it.description,
    discipline: it.discipline,
    url: it.url,
});

/** Каталог: издания, поиск, фильтр по дисциплине, добавление и правка. */
export function useLibraryCatalog() {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [disciplines, setDisciplines] = useState<string[]>([]);
    const [recent, setRecent] = useState<ReaderProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");
    const [discipline, setDiscipline] = useState<string>();

    // Форма издания: undefined — закрыта; editing — правка существующего.
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<LibraryItem>();
    const [input, setInput] = useState<LibraryItemInput>(emptyItemInput);
    const [file, setFile] = useState<File>();
    const [saving, setSaving] = useState(false);

    // Состояние ставится только в колбэках ответа — и при открытии, и при обновлении.
    const fetch = useCallback(
        () =>
            Promise.all([libraryApi.items(), libraryApi.disciplines(), libraryApi.progress().catch(() => [])]).then(
                ([list, names, progress]) => {
                    setItems(list);
                    setDisciplines(names);
                    setRecent(progress);
                    setError(false);
                    setLoading(false);
                },
                () => {
                    setError(true);
                    setLoading(false);
                },
            ),
        [],
    );

    useEffect(() => {
        fetch();
    }, [fetch]);

    // Поиск — на странице: каталог вуза невелик, а ответ мгновенный.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter(
            (it) =>
                (!discipline || it.discipline === discipline) &&
                (!q || `${it.title} ${it.authors} ${it.description} ${it.publisher}`.toLowerCase().includes(q)),
        );
    }, [items, query, discipline]);

    const openCreate = () => {
        setEditing(undefined);
        setInput({ ...emptyItemInput(), discipline: discipline ?? "" });
        setFile(undefined);
        setFormOpen(true);
    };

    const openEdit = (it: LibraryItem) => {
        setEditing(it);
        setInput(toInput(it));
        setFile(undefined);
        setFormOpen(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            if (editing) await libraryApi.itemUpdate(editing.id, input, file);
            else await libraryApi.itemCreate(input, file);
            toast.success(editing ? "Издание сохранено" : "Издание добавлено");
            setFormOpen(false);
            await fetch();
        } catch (e) {
            toast.error(errorText(e, "Не удалось сохранить издание"));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (it: LibraryItem) => {
        if (!window.confirm(`Удалить «${it.title}» из каталога?`)) return;
        try {
            await libraryApi.itemDelete(it.id);
            toast.success("Издание удалено");
            await fetch();
        } catch (e) {
            toast.error(errorText(e, "Не удалось удалить издание"));
        }
    };

    return {
        items, visible, disciplines, recent, loading, error, fetch,
        query, setQuery, discipline, setDiscipline,
        form: { open: formOpen, setOpen: setFormOpen, editing, input, setInput, file, setFile, saving, save },
        openCreate, openEdit, remove,
    };
}

export type LibraryCatalogState = ReturnType<typeof useLibraryCatalog>;
