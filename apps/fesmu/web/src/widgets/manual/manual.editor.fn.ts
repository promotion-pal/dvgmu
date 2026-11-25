import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText, libraryApi } from "@/features/library";
import type { Manual, ManualCard } from "@/features/library";
import type { Block, BlockKind, Section } from "@/shared/blocks";
import { BLOCKS, newId } from "@/shared/blocks";
import { cardOf } from "./manual.fn";

const move = <T,>(list: T[], from: number, to: number) => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
};

/* Редактор методички: черновик целиком в памяти страницы, «Сохранить»
 * отправляет карточку и темы одним вызовом. Публикация сначала сохраняет. */
export function useManualEditor(id: string) {
    const [manual, setManual] = useState<Manual>();
    const [card, setCardState] = useState<ManualCard>();
    const [sections, setSectionsState] = useState<Section[]>([]);
    const [activeId, setActiveId] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const dirtyRef = useRef(false);
    useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);

    // Состояние ставится только в колбэках ответа — и при открытии, и после публикации.
    const load = useCallback(
        () =>
            libraryApi.manual(id, true).then(
                ({ manual: m }) => {
                    setError(false);
                    setManual(m);
                    setCardState(cardOf(m));
                    setSectionsState(m.sections);
                    setActiveId((current) => current ?? m.sections[0]?.id);
                    setDirty(false);
                    setLoading(false);
                },
                () => {
                    setError(true);
                    setLoading(false);
                },
            ),
        [id],
    );

    useEffect(() => {
        load();
    }, [load]);

    // Не потерять правки при закрытии вкладки.
    useEffect(() => {
        const onLeave = (e: BeforeUnloadEvent) => {
            if (dirtyRef.current) e.preventDefault();
        };
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, []);

    const setSections = (fn: (list: Section[]) => Section[]) => {
        setSectionsState(fn);
        setDirty(true);
    };
    const setCard = (next: ManualCard) => {
        setCardState(next);
        setDirty(true);
    };
    const updateSection = (sid: string, fn: (s: Section) => Section) => setSections((list) => list.map((s) => (s.id === sid ? fn(s) : s)));

    const active = sections.find((s) => s.id === activeId);

    const sectionOps = {
        add: () => {
            const s: Section = { id: newId(), title: `Тема ${sections.length + 1}`, blocks: [BLOCKS.text.create()] };
            setSections((list) => [...list, s]);
            setActiveId(s.id);
        },
        rename: (sid: string, title: string) => updateSection(sid, (s) => ({ ...s, title })),
        move: (sid: string, delta: number) =>
            setSections((list) => {
                const i = list.findIndex((s) => s.id === sid);
                return move(list, i, i + delta);
            }),
        remove: (sid: string) => {
            const s = sections.find((x) => x.id === sid);
            if (s && s.blocks.length > 0 && !window.confirm(`Удалить тему «${s.title}» со всеми блоками?`)) return;
            const rest = sections.filter((x) => x.id !== sid);
            setSections(() => rest);
            if (activeId === sid) setActiveId(rest[0]?.id);
        },
    };

    const blockOps = {
        insert: (kind: BlockKind, at: number) => {
            if (!active) return;
            const block = BLOCKS[kind].create() as Block;
            updateSection(active.id, (s) => ({ ...s, blocks: [...s.blocks.slice(0, at), block, ...s.blocks.slice(at)] }));
        },
        change: (block: Block) => {
            if (!active) return;
            updateSection(active.id, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === block.id ? block : b)) }));
        },
        move: (bid: string, delta: number) => {
            if (!active) return;
            updateSection(active.id, (s) => {
                const i = s.blocks.findIndex((b) => b.id === bid);
                return { ...s, blocks: move(s.blocks, i, i + delta) };
            });
        },
        duplicate: (bid: string) => {
            if (!active) return;
            updateSection(active.id, (s) => {
                const i = s.blocks.findIndex((b) => b.id === bid);
                const copy = { ...structuredClone(s.blocks[i]), id: newId() };
                return { ...s, blocks: [...s.blocks.slice(0, i + 1), copy, ...s.blocks.slice(i + 1)] };
            });
        },
        remove: (bid: string) => {
            if (!active) return;
            updateSection(active.id, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== bid) }));
        },
    };

    const save = async (quiet = false) => {
        if (!card) return false;
        setBusy(true);
        try {
            await libraryApi.manualUpdate(id, card, sections);
            setDirty(false);
            if (!quiet) toast.success("Черновик сохранён");
            const { manual: m } = await libraryApi.manual(id, true);
            setManual(m);
            return true;
        } catch (e) {
            toast.error(errorText(e, "Не удалось сохранить черновик"));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const publish = async () => {
        if (dirty && !(await save(true))) return;
        setBusy(true);
        try {
            await libraryApi.manualPublish(id);
            toast.success("Методичка опубликована — студенты видят новую версию");
            await load();
        } catch (e) {
            toast.error(errorText(e, "Не удалось опубликовать"));
        } finally {
            setBusy(false);
        }
    };

    const archive = async () => {
        if (!window.confirm("Снять методичку с публикации? Студенты перестанут её видеть, черновик останется.")) return;
        setBusy(true);
        try {
            await libraryApi.manualArchive(id);
            toast.success("Методичка снята с публикации");
            await load();
        } catch (e) {
            toast.error(errorText(e, "Не удалось снять с публикации"));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm("Удалить методичку целиком? Это нельзя отменить.")) return false;
        try {
            await libraryApi.manualDelete(id);
            setDirty(false);
            toast.success("Методичка удалена");
            return true;
        } catch (e) {
            toast.error(errorText(e, "Не удалось удалить"));
            return false;
        }
    };

    // Ctrl/Cmd+S — сохранить.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (dirtyRef.current) save();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    return {
        manual, card, setCard, sections, active, activeId, setActiveId,
        loading, error, dirty, busy, load,
        sectionOps, blockOps, save, publish, archive, remove,
    };
}

export type ManualEditorState = ReturnType<typeof useManualEditor>;
