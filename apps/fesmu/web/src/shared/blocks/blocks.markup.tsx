import type { ReactNode } from "react";
import { Fragment } from "react";

/* Лёгкая разметка текстовых блоков — без HTML, поэтому безопасна:
 *   **жирный**, *курсив*, [ссылка](https://…)
 *   строки «- …» — маркированный список, «1. …» — нумерованный
 *   пустая строка — новый абзац. */

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Ссылка только на http(s) и почту: javascript: и прочее — простым текстом. */
const safeHref = (raw: string) => (/^(https?:\/\/|mailto:)/i.test(raw) ? raw : undefined);

function renderInline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(INLINE)) {
        const at = m.index ?? 0;
        if (at > last) out.push(text.slice(last, at));
        const key = `${at}`;
        if (m[1] !== undefined) out.push(<strong key={key}>{renderInline(m[1])}</strong>);
        else if (m[2] !== undefined) out.push(<em key={key}>{renderInline(m[2])}</em>);
        else {
            const href = safeHref(m[4]);
            out.push(
                href ? (
                    <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">
                        {m[3]}
                    </a>
                ) : (
                    m[0]
                ),
            );
        }
        last = at + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

const BULLET = /^\s*[-•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;

/** Абзацы и списки текста с лёгкой разметкой. */
export function Markup({ text, className }: { text: string; className?: string }) {
    const paragraphs = text.trim().split(/\n\s*\n/).filter(Boolean);
    return (
        <div className={className}>
            {paragraphs.map((paragraph, i) => {
                const lines = paragraph.split("\n");
                if (lines.every((l) => BULLET.test(l))) {
                    return (
                        <ul key={i} className="my-3 list-disc space-y-1 pl-6">
                            {lines.map((l, j) => <li key={j}>{renderInline(l.replace(BULLET, ""))}</li>)}
                        </ul>
                    );
                }
                if (lines.every((l) => NUMBER.test(l))) {
                    return (
                        <ol key={i} className="my-3 list-decimal space-y-1 pl-6">
                            {lines.map((l, j) => <li key={j}>{renderInline(l.replace(NUMBER, ""))}</li>)}
                        </ol>
                    );
                }
                return (
                    <p key={i} className="my-3 leading-relaxed">
                        {lines.map((l, j) => (
                            <Fragment key={j}>
                                {j > 0 && <br />}
                                {renderInline(l)}
                            </Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}
