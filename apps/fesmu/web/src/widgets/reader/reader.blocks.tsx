import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import { AArrowDownIcon, AArrowUpIcon } from "lucide-react";
import type { BlocksEnv, Section } from "@/shared/blocks";
import { BlocksEnvProvider, BlockView } from "@/shared/blocks";
import { Button } from "@/shared/ui/button";
import { useReaderFont, useReaderProgress } from "./reader.fn";
import type { TocEntry } from "./reader.shell";
import { ReaderShell } from "./reader.shell";

interface BlocksReaderProps {
    /** Что открыто — для сохранения позиции; без него позиция не пишется (предпросмотр). */
    refId?: string;
    title: string;
    subtitle?: string;
    backHref: string;
    backLabel: string;
    sections: Section[];
    env: BlocksEnv;
    header?: ReactNode;
    tools?: ReactNode;
    notice?: ReactNode;
}

const anchor = (id: string) => `rd-${id}`;

/** Сколько пикселей сверху занимают шапка приложения и читалки. */
const TOP_OFFSET = 128;

/* Адаптер читалки для методички: темы и блоки через общий реестр блоков.
 * Позиция — "block:<id>" первого видимого блока. */
export const BlocksReader: FC<BlocksReaderProps> = ({ refId, title, subtitle, backHref, backLabel, sections, env, header, tools, notice }) => {
    const font = useReaderFont();
    const progress = useReaderProgress("manual", refId);
    const [activeId, setActiveId] = useState<string>();
    const restored = useRef(false);

    const toc: TocEntry[] = useMemo(
        () =>
            sections.flatMap((s) => [
                { id: s.id, title: s.title, level: 1 },
                ...s.blocks.flatMap((b) => (b.kind === "heading" && b.text ? [{ id: b.id, title: b.text, level: b.level }] : [])),
            ]),
        [sections],
    );
    // К какому пункту оглавления относится каждый блок.
    const tocOf = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of sections) {
            let current = s.id;
            map.set(s.id, s.id);
            for (const b of s.blocks) {
                if (b.kind === "heading" && b.text) current = b.id;
                map.set(b.id, current);
            }
        }
        return map;
    }, [sections]);

    const scrollTo = (id: string, smooth = true) => {
        const el = document.getElementById(anchor(id));
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - TOP_OFFSET, behavior: smooth ? "smooth" : "auto" });
    };

    // Вернуть читателя туда, где он остановился.
    useEffect(() => {
        if (restored.current || progress.initial === undefined || sections.length === 0) return;
        restored.current = true;
        const id = progress.initial?.startsWith("block:") ? progress.initial.slice(6) : undefined;
        if (id) requestAnimationFrame(() => scrollTo(id, false));
    }, [progress.initial, sections.length]);

    useEffect(() => {
        const onScroll = () => {
            const marks = document.querySelectorAll<HTMLElement>("[data-reader-block]");
            let current: string | undefined;
            for (const el of marks) {
                if (el.getBoundingClientRect().top - TOP_OFFSET > 8) break;
                current = el.dataset.readerBlock;
            }
            current ??= marks[0]?.dataset.readerBlock;
            if (!current) return;
            setActiveId(tocOf.get(current));
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const percent = max > 0 ? (window.scrollY / max) * 100 : 100;
            if (refId && restored.current) progress.report(`block:${current}`, percent);
        };
        let frame = 0;
        const throttled = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(onScroll);
        };
        window.addEventListener("scroll", throttled, { passive: true });
        onScroll();
        return () => {
            window.removeEventListener("scroll", throttled);
            cancelAnimationFrame(frame);
        };
        // progress.report стабилен
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tocOf, refId]);

    return (
        <ReaderShell
            title={title}
            subtitle={subtitle}
            backHref={backHref}
            backLabel={backLabel}
            toc={toc}
            activeId={activeId}
            onNavigate={(id) => scrollTo(id)}
            percent={progress.percent}
            notice={notice}
            tools={
                <>
                    <Button variant="ghost" size="icon-sm" aria-label="Мельче" disabled={!font.canSmaller} onClick={font.smaller}><AArrowDownIcon /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Крупнее" disabled={!font.canLarger} onClick={font.larger}><AArrowUpIcon /></Button>
                    {tools}
                </>
            }
        >
            <BlocksEnvProvider value={env}>
                <article className="mx-auto max-w-3xl px-4 py-8 sm:px-8" style={{ fontSize: `${font.scale}rem` }}>
                    {header}
                    {sections.map((s, i) => (
                        <section key={s.id} className="mb-12">
                            <h2 id={anchor(s.id)} data-reader-block={s.id} className="mb-4 border-b pb-2 text-2xl font-bold">
                                <span className="mr-2 text-muted-foreground">{i + 1}.</span>{s.title}
                            </h2>
                            {s.blocks.map((b) => (
                                <div key={b.id} id={anchor(b.id)} data-reader-block={b.id}>
                                    <BlockView block={b} />
                                </div>
                            ))}
                        </section>
                    ))}
                </article>
            </BlocksEnvProvider>
        </ReaderShell>
    );
};
