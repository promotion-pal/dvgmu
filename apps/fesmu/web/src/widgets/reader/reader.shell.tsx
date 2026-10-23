import { useState } from "react";
import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, ListIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

export interface TocEntry {
    id: string;
    title: string;
    /** 1 — тема, 2+ — заголовки внутри. */
    level: number;
}

interface ReaderShellProps {
    title: string;
    subtitle?: string;
    backHref: string;
    backLabel: string;
    toc: TocEntry[];
    activeId?: string;
    onNavigate: (id: string) => void;
    percent: number;
    /** Кнопки справа в шапке: масштаб, шрифт, скачать, редактировать. */
    tools?: ReactNode;
    /** Полоса над текстом: «это черновик» и т. п. */
    notice?: ReactNode;
    children: ReactNode;
}

const Toc: FC<{ toc: TocEntry[]; activeId?: string; onPick: (id: string) => void }> = ({ toc, activeId, onPick }) => (
    <nav className="space-y-0.5 text-sm">
        {toc.map((e) => (
            <button
                key={e.id}
                type="button"
                onClick={() => onPick(e.id)}
                className={cn(
                    "block w-full truncate rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                    e.level > 1 && "pl-5 text-muted-foreground",
                    e.level > 2 && "pl-8",
                    activeId === e.id && "bg-muted font-medium text-foreground",
                )}
                title={e.title}
            >
                {e.title}
            </button>
        ))}
    </nav>
);

/* Каркас читалки — один на все форматы: шапка с прогрессом и
 * инструментами, оглавление сбоку (на телефоне — шторкой), текст в центре.
 * Что внутри (методичка, PDF) — решает адаптер. */
export const ReaderShell: FC<ReaderShellProps> = ({ title, subtitle, backHref, backLabel, toc, activeId, onNavigate, percent, tools, notice, children }) => {
    const [tocOpen, setTocOpen] = useState(false);
    return (
        <div className="w-full min-w-0">
            <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur">
                <div className="flex h-12 items-center gap-2 px-3 sm:px-6">
                    <Button variant="ghost" size="icon-sm" asChild aria-label={backLabel}>
                        <Link to={backHref}><ArrowLeftIcon /></Link>
                    </Button>
                    {toc.length > 0 && (
                        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Оглавление" onClick={() => setTocOpen(true)}>
                            <ListIcon />
                        </Button>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{title}</div>
                        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
                    </div>
                    <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">{Math.round(percent)}%</span>
                    <div className="flex items-center gap-1">{tools}</div>
                </div>
                <div className="h-0.5 bg-muted">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
                </div>
            </div>

            {notice}

            <div className="flex">
                {toc.length > 0 && (
                    <aside className="sticky top-[7.25rem] hidden h-[calc(100vh-7.25rem)] w-72 shrink-0 overflow-y-auto border-r p-3 lg:block">
                        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Оглавление</div>
                        <Toc toc={toc} activeId={activeId} onPick={onNavigate} />
                    </aside>
                )}
                <div className="min-w-0 flex-1">{children}</div>
            </div>

            <Sheet open={tocOpen} onOpenChange={setTocOpen}>
                <SheetContent side="left" className="w-80 overflow-y-auto p-3">
                    <SheetHeader className="px-2"><SheetTitle>Оглавление</SheetTitle></SheetHeader>
                    <Toc toc={toc} activeId={activeId} onPick={(id) => { setTocOpen(false); onNavigate(id); }} />
                </SheetContent>
            </Sheet>
        </div>
    );
};
