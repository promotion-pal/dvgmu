import { useMemo, useState } from "react";
import type { FC, ReactNode } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { useBlocksEnv } from "./blocks.env";
import type { BlockFile, BlockKind, BlockOf, CalloutTone, QuizQuestion } from "./blocks.types";
import { CALLOUT_TONES } from "./blocks.utils";
import { AttachmentView, FigureView } from "./blocks.view";

/* Редактирование блоков: каждый компонент меняет только свой блок и отдаёт
 * его целиком в onChange. Загрузка файлов и каталог — из окружения. */

export type EditProps<K extends BlockKind> = { block: BlockOf<K>; onChange: (block: BlockOf<K>) => void };

const Field: FC<{ label: string; children: ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={cn("grid gap-1.5", className)}>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {children}
    </div>
);

const MARKUP_HINT = "**жирный**, *курсив*, [ссылка](https://…), строки «- » и «1. » — списки, пустая строка — новый абзац";

/** Список строк: по одной на строку текста. */
const LinesField: FC<{ label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
    <Field label={`${label} — по одному на строку`}>
        <Textarea
            rows={Math.max(3, value.length + 1)}
            value={value.join("\n")}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value.split("\n"))}
        />
    </Field>
);

/** Выбор файла: загружает через окружение и отдаёт сохранённый файл. */
const FilePick: FC<{ accept?: string; onPicked: (f: BlockFile) => void; label: string }> = ({ accept, onPicked, label }) => {
    const { upload } = useBlocksEnv();
    const [busy, setBusy] = useState(false);
    if (!upload) return null;
    return (
        <Button variant="outline" size="sm" asChild disabled={busy}>
            <label className="cursor-pointer">
                {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                {label}
                <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    disabled={busy}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setBusy(true);
                        try {
                            onPicked(await upload(file));
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Файл не загружен");
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            </label>
        </Button>
    );
};

export const HeadingEdit: FC<EditProps<"heading">> = ({ block, onChange }) => (
    <div className="flex gap-2">
        <Select value={String(block.level)} onValueChange={(v) => onChange({ ...block, level: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="2">Заголовок</SelectItem>
                <SelectItem value="3">Подзаголовок</SelectItem>
                <SelectItem value="4">Малый</SelectItem>
            </SelectContent>
        </Select>
        <Input value={block.text} placeholder="Текст заголовка" onChange={(e) => onChange({ ...block, text: e.target.value })} className="font-semibold" />
    </div>
);

export const TextEdit: FC<EditProps<"text">> = ({ block, onChange }) => (
    <Field label={MARKUP_HINT}>
        <Textarea rows={Math.min(20, Math.max(4, block.text.split("\n").length + 1))} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
    </Field>
);

export const FigureEdit: FC<EditProps<"figure">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        {block.file && <FigureView block={{ ...block, caption: "", source: "" }} />}
        <FilePick accept="image/*" label={block.file ? "Заменить изображение" : "Выбрать изображение"} onPicked={(file) => onChange({ ...block, file })} />
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Подпись"><Input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Рис. 1. Кости черепа" /></Field>
            <Field label="Источник"><Input value={block.source} onChange={(e) => onChange({ ...block, source: e.target.value })} /></Field>
        </div>
    </div>
);

export const TableEdit: FC<EditProps<"table">> = ({ block, onChange }) => {
    const cols = Math.max(1, ...block.rows.map((r) => r.length));
    const rows = block.rows.length ? block.rows : [[""]];
    const set = (r: number, c: number, v: string) =>
        onChange({ ...block, rows: rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : row[j] ?? "")) : row)) });
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-4">
                <Input className="max-w-md" value={block.caption} placeholder="Название таблицы" onChange={(e) => onChange({ ...block, caption: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                    <Switch checked={block.header} onCheckedChange={(header) => onChange({ ...block, header })} /> Первая строка — шапка
                </label>
            </div>
            <div className="overflow-x-auto">
                <table className="border-collapse">
                    <tbody>
                        {rows.map((row, r) => (
                            <tr key={r}>
                                {Array.from({ length: cols }, (_, c) => (
                                    <td key={c} className="p-0.5">
                                        <Input className={cn("h-8 min-w-32", block.header && r === 0 && "font-medium")} value={row[c] ?? ""} onChange={(e) => set(r, c, e.target.value)} />
                                    </td>
                                ))}
                                <td>
                                    <Button variant="ghost" size="icon-sm" aria-label="Удалить строку" onClick={() => onChange({ ...block, rows: rows.filter((_, i) => i !== r) })}>
                                        <Trash2Icon />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onChange({ ...block, rows: [...rows, Array(cols).fill("")] })}><PlusIcon />Строка</Button>
                <Button variant="outline" size="sm" onClick={() => onChange({ ...block, rows: rows.map((row) => [...row, ...Array(cols - row.length).fill(""), ""]) })}><PlusIcon />Столбец</Button>
                {cols > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => onChange({ ...block, rows: rows.map((row) => row.slice(0, cols - 1)) })}>Убрать последний столбец</Button>
                )}
            </div>
        </div>
    );
};

export const CalloutEdit: FC<EditProps<"callout">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        <div className="flex gap-2">
            <Select value={block.tone} onValueChange={(tone) => onChange({ ...block, tone: tone as CalloutTone })}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {Object.entries(CALLOUT_TONES).map(([tone, t]) => <SelectItem key={tone} value={tone}>{t.label}</SelectItem>)}
                </SelectContent>
            </Select>
            <Input value={block.title} placeholder={`Заголовок (по умолчанию «${CALLOUT_TONES[block.tone].label}»)`} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        </div>
        <Field label={MARKUP_HINT}><Textarea rows={3} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} /></Field>
    </div>
);

export const VideoEdit: FC<EditProps<"video">> = ({ block, onChange }) => (
    <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ссылка на видео (RuTube, VK Видео, YouTube)"><Input value={block.url} placeholder="https://rutube.ru/video/…" onChange={(e) => onChange({ ...block, url: e.target.value })} /></Field>
        <Field label="Подпись"><Input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} /></Field>
    </div>
);

export const AttachmentEdit: FC<EditProps<"attachment">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        {block.file && <AttachmentView block={block} />}
        <div className="flex flex-wrap items-end gap-3">
            <FilePick label={block.file ? "Заменить файл" : "Выбрать файл"} onPicked={(file) => onChange({ ...block, file })} />
            <Field label="Название" className="min-w-64 flex-1"><Input value={block.title} placeholder={block.file?.name} onChange={(e) => onChange({ ...block, title: e.target.value })} /></Field>
        </div>
    </div>
);

export const CaseEdit: FC<EditProps<"case">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        <Field label="Название"><Input value={block.title} placeholder="Задача 1" onChange={(e) => onChange({ ...block, title: e.target.value })} /></Field>
        <Field label="Условие"><Textarea rows={4} value={block.condition} onChange={(e) => onChange({ ...block, condition: e.target.value })} /></Field>
        <LinesField label="Вопросы" value={block.questions} onChange={(questions) => onChange({ ...block, questions })} />
        <Field label="Эталон ответа — студент откроет его кнопкой"><Textarea rows={4} value={block.answer} onChange={(e) => onChange({ ...block, answer: e.target.value })} /></Field>
    </div>
);

const QuizQuestionEdit: FC<{ q: QuizQuestion; n: number; onChange: (q: QuizQuestion) => void; onRemove: () => void }> = ({ q, n, onChange, onRemove }) => (
    <div className="grid gap-2 rounded-md border p-3">
        <div className="flex gap-2">
            <Input value={q.text} placeholder={`Вопрос ${n}`} onChange={(e) => onChange({ ...q, text: e.target.value })} />
            <Button variant="ghost" size="icon" aria-label="Удалить вопрос" onClick={onRemove}><Trash2Icon /></Button>
        </div>
        <div className="text-xs text-muted-foreground">Отметьте верные варианты</div>
        {q.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
                <Checkbox
                    checked={q.correct.includes(i)}
                    onCheckedChange={(on) => onChange({ ...q, correct: on ? [...q.correct, i].sort() : q.correct.filter((c) => c !== i) })}
                />
                <Input className="h-8" value={option} placeholder={`Вариант ${i + 1}`} onChange={(e) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? e.target.value : o)) })} />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Удалить вариант"
                    onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i), correct: q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)) })}
                >
                    <Trash2Icon />
                </Button>
            </div>
        ))}
        <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange({ ...q, options: [...q.options, ""] })}><PlusIcon />Вариант</Button>
        <Input value={q.explanation} placeholder="Пояснение после проверки (необязательно)" onChange={(e) => onChange({ ...q, explanation: e.target.value })} />
    </div>
);

export const QuizEdit: FC<EditProps<"quiz">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        <Input value={block.title} placeholder="Проверьте себя" onChange={(e) => onChange({ ...block, title: e.target.value })} />
        {block.questions.map((q, i) => (
            <QuizQuestionEdit
                key={i}
                q={q}
                n={i + 1}
                onChange={(next) => onChange({ ...block, questions: block.questions.map((x, j) => (j === i ? next : x)) })}
                onRemove={() => onChange({ ...block, questions: block.questions.filter((_, j) => j !== i) })}
            />
        ))}
        <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => onChange({ ...block, questions: [...block.questions, { text: "", options: ["", ""], correct: [], explanation: "" }] })}
        >
            <PlusIcon />Вопрос
        </Button>
    </div>
);

export const ChecklistEdit: FC<EditProps<"checklist">> = ({ block, onChange }) => (
    <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-4">
            <Input className="max-w-md" value={block.title} placeholder="Алгоритм внутримышечной инъекции" onChange={(e) => onChange({ ...block, title: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
                <Switch checked={block.ordered} onCheckedChange={(ordered) => onChange({ ...block, ordered })} /> Нумеровать шаги
            </label>
        </div>
        <LinesField label="Шаги" value={block.steps} onChange={(steps) => onChange({ ...block, steps })} />
    </div>
);

export const GlossaryEdit: FC<EditProps<"glossary">> = ({ block, onChange }) => (
    <div className="grid gap-2">
        {block.terms.map((t, i) => (
            <div key={i} className="flex gap-2">
                <Input className="w-56" value={t.term} placeholder="Термин" onChange={(e) => onChange({ ...block, terms: block.terms.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)) })} />
                <Input value={t.definition} placeholder="Определение" onChange={(e) => onChange({ ...block, terms: block.terms.map((x, j) => (j === i ? { ...x, definition: e.target.value } : x)) })} />
                <Button variant="ghost" size="icon" aria-label="Удалить термин" onClick={() => onChange({ ...block, terms: block.terms.filter((_, j) => j !== i) })}><Trash2Icon /></Button>
            </div>
        ))}
        <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange({ ...block, terms: [...block.terms, { term: "", definition: "" }] })}><PlusIcon />Термин</Button>
    </div>
);

export const LiteratureEdit: FC<EditProps<"literature">> = ({ block, onChange }) => {
    const { catalog = [] } = useBlocksEnv();
    const [query, setQuery] = useState("");
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return catalog.filter((it) => block.itemIds.includes(it.id) || !q || `${it.title} ${it.authors}`.toLowerCase().includes(q)).slice(0, 50);
    }, [catalog, query, block.itemIds]);
    const toggle = (id: string) =>
        onChange({ ...block, itemIds: block.itemIds.includes(id) ? block.itemIds.filter((x) => x !== id) : [...block.itemIds, id] });
    return (
        <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <Input value={block.title} placeholder="Литература" onChange={(e) => onChange({ ...block, title: e.target.value })} />
                <Input value={query} placeholder="Найти в каталоге…" onChange={(e) => setQuery(e.target.value)} />
            </div>
            {catalog.length === 0 ? (
                <p className="text-sm text-muted-foreground">В каталоге пока нет изданий — добавьте их в разделе «Каталог».</p>
            ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {shown.map((it) => (
                        <label key={it.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                            <Checkbox className="mt-0.5" checked={block.itemIds.includes(it.id)} onCheckedChange={() => toggle(it.id)} />
                            <span>{it.authors && `${it.authors}. `}{it.title}{it.year ? `, ${it.year}` : ""}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export const DividerEdit: FC = () => <hr className="my-2" />;
