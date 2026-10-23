import type { ReactNode } from "react";
import { ChevronRightIcon, DownloadIcon, FileTextIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { findDoc, type DocSource } from "./docs.data";

/** "Дневник практики (DOCX)" → ["Дневник практики", "DOCX"] */
function splitExt(label: string): [string, string | null] {
    const m = label.match(/^(.*?)\s*\(([A-Z]{3,4})(?:,[^)]*)?\)$/);
    return m ? [m[1], m[2]] : [label, null];
}

export function DocFile({ source }: { source: DocSource }) {
    const [name, ext] = splitExt(source.label);
    return (
        <a
            href={source.href}
            target="_blank"
            rel="noreferrer"
            download
            className="group flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileTextIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{name}</span>
                {ext && <span className="block text-xs text-muted-foreground">{ext}</span>}
            </span>
            <DownloadIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </a>
    );
}

export function DocFiles({ files, className }: { files: DocSource[]; className?: string }) {
    return (
        <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
            {files.map((f) => (
                <DocFile key={f.href} source={f} />
            ))}
        </div>
    );
}

/** Сетка карточек-ссылок на другие статьи: заголовок и summary берутся из самой статьи. */
export function DocLinks({ ids }: { ids: string[] }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ids.map((id) => {
                const doc = findDoc(id);
                if (!doc) return null;
                return (
                    <Link
                        key={id}
                        to={`${ROUTE.DOCS.COMMON}?doc=${id}`}
                        className="group flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-snug">{doc.entry.title}</span>
                            {doc.entry.summary && (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {doc.entry.summary}
                                </span>
                            )}
                        </span>
                        <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                );
            })}
        </div>
    );
}

/** Ссылка на статью внутри текста. */
export function DocLink({ id, children }: { id: string; children: ReactNode }) {
    return (
        <Link className="text-primary underline-offset-4 hover:underline" to={`${ROUTE.DOCS.COMMON}?doc=${id}`}>
            {children}
        </Link>
    );
}
