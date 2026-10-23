import { useState } from "react";
import type { FC } from "react";
import { BookOpenIcon, CheckCircle2Icon, ExternalLinkIcon, FileIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { useBlocksEnv } from "./blocks.env";
import { Markup } from "./blocks.markup";
import type { BlockOf, QuizQuestion } from "./blocks.types";
import { CALLOUT_TONES, embedUrl } from "./blocks.utils";

/* Просмотр блоков: так методичку видит студент в читалке. Каждый компонент
 * получает только свой блок; файлы и литература — из окружения (blocks.env). */

export const HeadingView: FC<{ block: BlockOf<"heading"> }> = ({ block }) => {
    const Tag = (`h${block.level + 1}` as "h3" | "h4" | "h5");
    const size = { 2: "text-xl", 3: "text-lg", 4: "text-base" }[block.level];
    return <Tag className={cn("mt-6 mb-2 font-semibold scroll-mt-20", size)}>{block.text}</Tag>;
};

export const TextView: FC<{ block: BlockOf<"text"> }> = ({ block }) => <Markup text={block.text} />;

export const FigureView: FC<{ block: BlockOf<"figure"> }> = ({ block }) => {
    const url = useBlocksEnv().useFileUrl(block.file);
    return (
        <figure className="my-5">
            {url ? (
                <img src={url} alt={block.caption || block.file?.name} className="mx-auto max-h-[70vh] rounded-lg border object-contain" />
            ) : (
                <div className="mx-auto h-48 w-full max-w-lg animate-pulse rounded-lg bg-muted" />
            )}
            {(block.caption || block.source) && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                    {block.caption}
                    {block.source && <span className="block text-xs">Источник: {block.source}</span>}
                </figcaption>
            )}
        </figure>
    );
};

export const TableView: FC<{ block: BlockOf<"table"> }> = ({ block }) => {
    const [head, ...body] = block.header ? block.rows : [undefined, ...block.rows];
    return (
        <div className="my-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                {block.caption && <caption className="mb-2 text-left text-sm text-muted-foreground">{block.caption}</caption>}
                {head && (
                    <thead>
                        <tr>{head.map((cell, i) => <th key={i} className="border bg-muted/50 px-3 py-2 text-left font-medium">{cell}</th>)}</tr>
                    </thead>
                )}
                <tbody>
                    {body.map((row, r) => (
                        <tr key={r}>{row?.map((cell, i) => <td key={i} className="border px-3 py-2 align-top">{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


export const CalloutView: FC<{ block: BlockOf<"callout"> }> = ({ block }) => {
    const tone = CALLOUT_TONES[block.tone];
    const Icon = tone.icon;
    return (
        <aside className={cn("my-5 rounded-lg border-l-4 px-4 py-3", tone.className)}>
            <div className="flex items-center gap-2 font-medium">
                <Icon className="size-4" />
                {block.title || tone.label}
            </div>
            <Markup text={block.text} className="text-sm [&_p]:my-1.5" />
        </aside>
    );
};


export const VideoView: FC<{ block: BlockOf<"video"> }> = ({ block }) => {
    const embed = embedUrl(block.url);
    return (
        <figure className="my-5">
            {embed ? (
                <div className="aspect-video overflow-hidden rounded-lg border bg-black">
                    <iframe src={embed} title={block.caption || "Видео"} className="size-full" allow="fullscreen; picture-in-picture" allowFullScreen />
                </div>
            ) : (
                <a href={block.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 text-primary underline underline-offset-4">
                    <ExternalLinkIcon className="size-4" /> {block.caption || block.url}
                </a>
            )}
            {embed && block.caption && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{block.caption}</figcaption>}
        </figure>
    );
};

const sizeLabel = (bytes: number) =>
    bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

export const AttachmentView: FC<{ block: BlockOf<"attachment"> }> = ({ block }) => {
    const { download } = useBlocksEnv();
    const file = block.file;
    if (!file) return null;
    return (
        <button
            type="button"
            onClick={() => download(file)}
            className="my-4 flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
            <FileIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{block.title || file.name}</span>
                <span className="text-xs text-muted-foreground">{file.name} · {sizeLabel(file.size)}</span>
            </span>
        </button>
    );
};

export const CaseView: FC<{ block: BlockOf<"case"> }> = ({ block }) => {
    const [open, setOpen] = useState(false);
    return (
        <section className="my-5 rounded-lg border bg-muted/20 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ситуационная задача</div>
            {block.title && <div className="font-semibold">{block.title}</div>}
            <Markup text={block.condition} className="text-sm" />
            {block.questions.length > 0 && (
                <ol className="my-2 list-decimal space-y-1 pl-6 text-sm">
                    {block.questions.map((q, i) => <li key={i}>{q}</li>)}
                </ol>
            )}
            {block.answer && (
                <>
                    <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
                        {open ? "Скрыть эталон ответа" : "Показать эталон ответа"}
                    </Button>
                    {open && <Markup text={block.answer} className="mt-3 rounded-md border bg-background p-3 text-sm" />}
                </>
            )}
        </section>
    );
};

const QuizQuestionView: FC<{ q: QuizQuestion; n: number }> = ({ q, n }) => {
    const [picked, setPicked] = useState<number[]>([]);
    const [checked, setChecked] = useState(false);
    const multiple = q.correct.length > 1;
    const right = checked && picked.length === q.correct.length && q.correct.every((c) => picked.includes(c));
    const toggle = (i: number) => {
        setChecked(false);
        setPicked(multiple ? (picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i]) : [i]);
    };
    return (
        <div className="space-y-2">
            <div className="font-medium">{n}. {q.text}</div>
            {multiple && <div className="text-xs text-muted-foreground">Несколько верных ответов</div>}
            <div className="space-y-1.5">
                {q.options.map((option, i) => {
                    const mark = checked && (q.correct.includes(i) ? "right" : picked.includes(i) ? "wrong" : undefined);
                    return (
                        <label
                            key={i}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                                mark === "right" && "border-emerald-500/60 bg-emerald-500/5",
                                mark === "wrong" && "border-red-500/60 bg-red-500/5",
                            )}
                        >
                            <Checkbox checked={picked.includes(i)} onCheckedChange={() => toggle(i)} />
                            {option}
                        </label>
                    );
                })}
            </div>
            <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" disabled={picked.length === 0} onClick={() => setChecked(true)}>Проверить</Button>
                {checked && (
                    <span className={cn("flex items-center gap-1 text-sm", right ? "text-emerald-600" : "text-red-600")}>
                        {right ? <CheckCircle2Icon className="size-4" /> : <XCircleIcon className="size-4" />}
                        {right ? "Верно" : "Неверно"}
                    </span>
                )}
            </div>
            {checked && q.explanation && <Markup text={q.explanation} className="text-sm text-muted-foreground [&_p]:my-1" />}
        </div>
    );
};

export const QuizView: FC<{ block: BlockOf<"quiz"> }> = ({ block }) => (
    <section className="my-5 space-y-5 rounded-lg border p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{block.title || "Проверьте себя"}</div>
        {block.questions.map((q, i) => <QuizQuestionView key={i} q={q} n={i + 1} />)}
    </section>
);

export const ChecklistView: FC<{ block: BlockOf<"checklist"> }> = ({ block }) => {
    const [done, setDone] = useState<number[]>([]);
    return (
        <section className="my-5 rounded-lg border p-4">
            {block.title && <div className="mb-2 font-semibold">{block.title}</div>}
            <ul className="space-y-1.5">
                {block.steps.map((step, i) => (
                    <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <Checkbox
                                className="mt-0.5"
                                checked={done.includes(i)}
                                onCheckedChange={() => setDone(done.includes(i) ? done.filter((d) => d !== i) : [...done, i])}
                            />
                            <span className={cn(done.includes(i) && "text-muted-foreground line-through")}>
                                {block.ordered && <span className="mr-1 font-medium">{i + 1}.</span>}
                                {step}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export const GlossaryView: FC<{ block: BlockOf<"glossary"> }> = ({ block }) => (
    <dl className="my-5 divide-y rounded-lg border">
        {block.terms.map((t, i) => (
            <div key={i} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(8rem,1fr)_3fr] sm:gap-4">
                <dt className="font-medium">{t.term}</dt>
                <dd className="text-sm text-muted-foreground">{t.definition}</dd>
            </div>
        ))}
    </dl>
);

export const LiteratureView: FC<{ block: BlockOf<"literature"> }> = ({ block }) => {
    const { literature } = useBlocksEnv();
    const items = block.itemIds.map((id) => literature.get(id)).filter((x) => x !== undefined);
    if (items.length === 0) return null;
    return (
        <section className="my-5">
            <div className="mb-2 flex items-center gap-2 font-semibold"><BookOpenIcon className="size-4" />{block.title || "Литература"}</div>
            <ol className="list-decimal space-y-1 pl-6 text-sm">
                {items.map((it) => (
                    <li key={it.id}>
                        <a href={it.href} target={it.external ? "_blank" : undefined} rel={it.external ? "noreferrer noopener" : undefined} className="text-primary underline-offset-4 hover:underline">
                            {it.authors && `${it.authors}. `}{it.title}{it.year ? `, ${it.year}` : ""}
                        </a>
                    </li>
                ))}
            </ol>
        </section>
    );
};

export const DividerView: FC = () => <hr className="my-8" />;
