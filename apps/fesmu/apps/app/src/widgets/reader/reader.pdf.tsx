import { useEffect, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import { Loader2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { loadFile } from "@/features/library";
import { CommonError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { useReaderProgress } from "./reader.fn";
import type { TocEntry } from "./reader.shell";
import { ReaderShell } from "./reader.shell";

GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.75, 1, 1.25, 1.5, 2] as const;
const TOP_OFFSET = 128;
const pageAnchor = (n: number) => `pdf-page-${n}`;

/** Одна страница: рисуется, только когда подходит к экрану. */
const PdfPage: FC<{ doc: PDFDocumentProxy; n: number; width: number; ratio: number; zoom: number }> = ({ doc, n, width, ratio, zoom }) => {
    const box = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [near, setNear] = useState(false);
    const cssWidth = width * zoom;

    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "1200px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!near || !canvas.current) return;
        let task: { cancel: () => void } | undefined;
        let alive = true;
        doc.getPage(n).then((page) => {
            if (!alive || !canvas.current) return;
            const base = page.getViewport({ scale: 1 });
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
            const c = canvas.current;
            c.width = viewport.width;
            c.height = viewport.height;
            const t = page.render({ canvas: c, viewport });
            task = t;
            t.promise.catch(() => {});
        });
        return () => {
            alive = false;
            task?.cancel();
        };
    }, [near, doc, n, cssWidth]);

    return (
        <div ref={box} id={pageAnchor(n)} data-pdf-page={n} className="mx-auto mb-4 bg-white shadow-sm ring-1 ring-border" style={{ width: cssWidth, height: cssWidth * ratio }}>
            {near && <canvas ref={canvas} className="size-full" />}
        </div>
    );
};

interface PdfReaderProps {
    refId: string;
    fileId: string;
    title: string;
    subtitle?: string;
    backHref: string;
    backLabel: string;
    tools?: ReactNode;
}

/* Адаптер читалки для PDF (pdf.js): страницы рисуются лениво, оглавление —
 * из закладок файла, если они есть. Позиция — "page:<n>". */
export const PdfReader: FC<PdfReaderProps> = ({ refId, fileId, title, subtitle, backHref, backLabel, tools }) => {
    const progress = useReaderProgress("item", refId);
    const [doc, setDoc] = useState<PDFDocumentProxy>();
    const [ratio, setRatio] = useState(1.414);
    const [toc, setToc] = useState<TocEntry[]>([]);
    const [error, setError] = useState(false);
    const [zoomStep, setZoomStep] = useState(1);
    const [page, setPage] = useState(1);
    const [width, setWidth] = useState(800);
    const area = useRef<HTMLDivElement>(null);
    const restored = useRef(false);
    const zoom = ZOOMS[zoomStep];

    useEffect(() => {
        let alive = true;
        let loaded: PDFDocumentProxy | undefined;
        loadFile(fileId)
            // pdf.js забирает буфер себе — отдаём копию, кэш остаётся целым.
            .then((f) => getDocument({ data: f.bytes.slice() }).promise)
            .then(async (d) => {
                loaded = d;
                if (!alive) return d.destroy();
                const first = (await d.getPage(1)).getViewport({ scale: 1 });
                setRatio(first.height / first.width);
                setDoc(d);
                const outline = (await d.getOutline().catch(() => null)) ?? [];
                const entries: TocEntry[] = [];
                for (const item of outline.slice(0, 200)) {
                    try {
                        const dest = typeof item.dest === "string" ? await d.getDestination(item.dest) : item.dest;
                        if (!dest) continue;
                        const index = await d.getPageIndex(dest[0]);
                        entries.push({ id: String(index + 1), title: item.title, level: 1 });
                    } catch {
                        /* битая закладка — пропускаем */
                    }
                }
                if (alive) setToc(entries);
            })
            .catch(() => alive && setError(true));
        return () => {
            alive = false;
            loaded?.destroy();
        };
    }, [fileId]);

    useEffect(() => {
        const el = area.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setWidth(Math.min(900, el.clientWidth - 32)));
        ro.observe(el);
        return () => ro.disconnect();
    }, [doc]);

    const scrollTo = (n: number, smooth = true) => {
        const el = document.getElementById(pageAnchor(n));
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - TOP_OFFSET, behavior: smooth ? "smooth" : "auto" });
    };

    useEffect(() => {
        if (!doc || restored.current || progress.initial === undefined) return;
        restored.current = true;
        const n = progress.initial?.startsWith("page:") ? Number(progress.initial.slice(5)) : 0;
        if (n > 1) requestAnimationFrame(() => scrollTo(n, false));
    }, [doc, progress.initial]);

    useEffect(() => {
        if (!doc) return;
        const onScroll = () => {
            let current = 1;
            for (const el of document.querySelectorAll<HTMLElement>("[data-pdf-page]")) {
                if (el.getBoundingClientRect().top - TOP_OFFSET > window.innerHeight / 3) break;
                current = Number(el.dataset.pdfPage);
            }
            setPage(current);
            if (restored.current) progress.report(`page:${current}`, (current / doc.numPages) * 100);
        };
        let frame = 0;
        const throttled = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(onScroll);
        };
        window.addEventListener("scroll", throttled, { passive: true });
        return () => {
            window.removeEventListener("scroll", throttled);
            cancelAnimationFrame(frame);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    const activeId = [...toc].reverse().find((e) => Number(e.id) <= page)?.id;

    return (
        <ReaderShell
            title={title}
            subtitle={doc ? `${subtitle ? `${subtitle} · ` : ""}стр. ${page} из ${doc.numPages}` : subtitle}
            backHref={backHref}
            backLabel={backLabel}
            toc={toc}
            activeId={activeId}
            onNavigate={(id) => scrollTo(Number(id))}
            percent={progress.percent}
            tools={
                <>
                    <Button variant="ghost" size="icon-sm" aria-label="Уменьшить" disabled={zoomStep === 0} onClick={() => setZoomStep(zoomStep - 1)}><ZoomOutIcon /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Увеличить" disabled={zoomStep === ZOOMS.length - 1} onClick={() => setZoomStep(zoomStep + 1)}><ZoomInIcon /></Button>
                    {tools}
                </>
            }
        >
            <div ref={area} className="overflow-x-auto bg-muted/40 px-4 py-6">
                {error ? (
                    <CommonError />
                ) : !doc ? (
                    <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" />Открываем файл…</div>
                ) : (
                    Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} width={width} ratio={ratio} zoom={zoom} />)
                )}
            </div>
        </ReaderShell>
    );
};
