import { useState } from "react";
import type { FC, ReactNode } from "react";
import { CopyIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { CommonFilterChips } from "@/shared/components/filter";
import { LESSON_TONE_STYLES } from "@/shared/components/schedule";
import { useCommonWrapperViewMode } from "@/shared/components/wrapper";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import type { ScheduleEditor, EditorTab } from "./schedule.editor.fn";
import { slotLabel } from "./schedule.editor.utils";
import type { ScheduleEditorSection } from "./schedule.editor.utils";
import { WEEKDAYS, WEEKDAY_LABEL, WEEKDAY_SHORT_LABEL, scheduleToneSchema } from "./schedule.schema";
import type { ScheduleEntry, SchedulePeriod } from "./schedule.schema";
import { ScheduleBoard } from "./schedule.ui";
import { formatDate, formatGroups } from "./schedule.utils";

/* ───────────── small pieces ───────────── */

const Field: FC<{ label: string; hint?: string; className?: string; children: ReactNode }> = ({ label, hint, className, children }) => (
    <label className={cn("flex flex-col gap-1", className)}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {children}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
);

const NativeSelect: FC<{ value: string | number; onChange: (value: string) => void; options: { value: string | number; label: string }[]; placeholder?: string }> = ({
    value,
    onChange,
    options,
    placeholder,
}) => (
    <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
            <option key={option.value} value={option.value}>
                {option.label}
            </option>
        ))}
    </select>
);

const Section: FC<{ title: string; description?: string; action?: ReactNode; children: ReactNode }> = ({ title, description, action, children }) => (
    <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h3 className="text-base font-semibold">{title}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {action}
        </div>
        {children}
    </div>
);

const AddButton: FC<{ onClick: () => void; children: ReactNode }> = ({ onClick, children }) => (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <PlusIcon className="size-4" />
        {children}
    </Button>
);

const RemoveButton: FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        className="icon-inline size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
        <Trash2Icon className="size-4" />
    </button>
);

const Chip: FC<{ onRemove: () => void; children: ReactNode }> = ({ onRemove, children }) => (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs font-medium">
        {children}
        <button type="button" onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <XIcon className="size-3" />
        </button>
    </span>
);

/** One item per line, edited as text. Keeps its own text so a trailing newline survives typing. */
const LinesField: FC<{ label: string; hint?: string; lines: string[]; onChange: (lines: string[]) => void; rows?: number }> = ({ label, hint, lines, onChange, rows = 4 }) => {
    const [text, setText] = useState(() => lines.join("\n"));

    return (
        <Field label={label} hint={hint}>
            <Textarea
                rows={rows}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean));
                }}
            />
        </Field>
    );
};

/** Free text + an "add" button that turns what was typed into chips. */
const ChipInput: FC<{ placeholder: string; type?: string; onAdd: (value: string) => void }> = ({ placeholder, type = "text", onAdd }) => {
    const [value, setValue] = useState("");
    const commit = () => {
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
    };

    return (
        <div className="flex gap-2">
            <Input
                type={type}
                value={value}
                placeholder={placeholder}
                className="max-w-64"
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                }}
            />
            <Button type="button" variant="outline" onClick={commit}>
                Добавить
            </Button>
        </div>
    );
};

/* ───────────── sections ───────────── */

type EditorProps = { editor: ScheduleEditor };

const GeneralSection: FC<EditorProps> = ({ editor }) => {
    const { draft, patch, setProgram, setSemester, addGroups, removeGroup } = editor;

    return (
        <Section title="Основное" description="Что это за расписание и на какой семестр оно составлено.">
            <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название" className="md:col-span-2">
                    <Input value={draft.title} placeholder="Лечебное дело, 1 курс" onChange={(event) => patch({ title: event.target.value })} />
                </Field>
                <Field label="Факультет">
                    <Input value={draft.faculty} placeholder="Лечебный факультет" onChange={(event) => patch({ faculty: event.target.value })} />
                </Field>
                <Field label="Поток" hint="Необязательно, например «1 поток»">
                    <Input value={draft.stream ?? ""} onChange={(event) => patch({ stream: event.target.value })} />
                </Field>
                <Field label="Код специальности">
                    <Input value={draft.program.code} placeholder="31.05.01" onChange={(event) => setProgram({ code: event.target.value })} />
                </Field>
                <Field label="Специальность">
                    <Input value={draft.program.name} placeholder="Лечебное дело" onChange={(event) => setProgram({ name: event.target.value })} />
                </Field>
                <Field label="Курс">
                    <Input type="number" min={1} max={8} value={draft.course || ""} onChange={(event) => patch({ course: Number(event.target.value) })} />
                </Field>
                <Field label="Семестр">
                    <Input value={draft.semester.label} placeholder="Осенний семестр 2026/27" onChange={(event) => setSemester({ label: event.target.value })} />
                </Field>
                <Field label="Начало семестра" hint="От этой даты идёт счёт числителя и знаменателя">
                    <Input type="date" value={draft.semester.start} onChange={(event) => setSemester({ start: event.target.value })} />
                </Field>
                <Field label="Конец семестра">
                    <Input type="date" value={draft.semester.end} onChange={(event) => setSemester({ end: event.target.value })} />
                </Field>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">Группы</span>
                <div className="flex flex-wrap gap-1.5">
                    {draft.groups.length === 0 && <span className="text-sm text-muted-foreground">Пока нет ни одной группы</span>}
                    {draft.groups.map((group) => (
                        <Chip key={group} onRemove={() => removeGroup(group)}>
                            {group}
                        </Chip>
                    ))}
                </div>
                <ChipInput placeholder="101 или диапазон 101-110" onAdd={addGroups} />
            </div>
        </Section>
    );
};

const SlotsSection: FC<EditorProps> = ({ editor }) => {
    const { draft, addSlot, updateItem, removeSlot } = editor;

    return (
        <Section
            title="Сетка времени"
            description="Пары в течение дня. Занятия привязываются к этим строкам."
            action={<AddButton onClick={addSlot}>Добавить пару</AddButton>}
        >
            <div className="flex flex-col gap-2">
                {draft.slots.map((slot, index) => (
                    <div key={slot.id} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-sm text-muted-foreground">{index + 1} пара</span>
                        <Input type="time" className="w-32" value={slot.start} onChange={(event) => updateItem("slots", slot.id, { start: event.target.value })} />
                        <span className="text-muted-foreground">–</span>
                        <Input type="time" className="w-32" value={slot.end} onChange={(event) => updateItem("slots", slot.id, { end: event.target.value })} />
                        <RemoveButton title="Удалить пару" onClick={() => removeSlot(slot.id)} />
                    </div>
                ))}
            </div>
        </Section>
    );
};

const SubjectsSection: FC<EditorProps> = ({ editor }) => {
    const { draft, addSubject, updateItem, removeSubject } = editor;

    return (
        <Section
            title="Предметы"
            description="Дисциплины, которые встречаются в расписании. Цвет помогает отличать их на сетке."
            action={<AddButton onClick={addSubject}>Добавить предмет</AddButton>}
        >
            {draft.subjects.length === 0 && <p className="text-sm text-muted-foreground">Предметов пока нет.</p>}
            <div className="flex flex-col gap-3">
                {draft.subjects.map((subject) => (
                    <div key={subject.id} className="flex flex-wrap items-center gap-3">
                        <Input
                            className="min-w-60 flex-1"
                            placeholder="Анатомия"
                            value={subject.name}
                            onChange={(event) => updateItem("subjects", subject.id, { name: event.target.value })}
                        />
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Цвет">
                            {scheduleToneSchema.options.map((tone) => (
                                <button
                                    key={tone}
                                    type="button"
                                    role="radio"
                                    aria-checked={subject.tone === tone}
                                    title={tone}
                                    onClick={() => updateItem("subjects", subject.id, { tone })}
                                    className={cn(
                                        "size-5 rounded-full ring-offset-2 ring-offset-background transition",
                                        LESSON_TONE_STYLES[tone].accent,
                                        subject.tone === tone ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100",
                                    )}
                                />
                            ))}
                        </div>
                        <RemoveButton title="Удалить предмет" onClick={() => removeSubject(subject.id)} />
                    </div>
                ))}
            </div>
        </Section>
    );
};

const KIND_OPTIONS = [
    { value: "practice", label: "Практика (каждую неделю)" },
    { value: "lecture", label: "Лекция (по датам)" },
];
const WEEKS_OPTIONS = [
    { value: "every", label: "Каждую неделю" },
    { value: "numerator", label: "По числителю" },
    { value: "denominator", label: "По знаменателю" },
];

const optionalNumber = (value: string) => (value === "" ? undefined : Math.max(Number(value), 0) || undefined);

const EntryEditor: FC<EditorProps & { entry: ScheduleEntry; number: number; defaultOpen: boolean }> = ({ editor, entry, number, defaultOpen }) => {
    const { draft, updateItem, removeItem, duplicateEntry } = editor;
    const update = (change: Partial<ScheduleEntry>) => updateItem("entries", entry.id, change);

    const slotIndex = draft.slots.findIndex((slot) => slot.id === entry.slotId);
    const subject = draft.subjects.find((item) => item.id === entry.subjectId);
    const tone = LESSON_TONE_STYLES[subject?.tone ?? "slate"];
    const removeDate = (date: string) => {
        const rest = (entry.dates ?? []).filter((item) => item !== date);
        update({ dates: rest.length > 0 ? rest : undefined });
    };
    const maxSpan = Math.max(draft.slots.length - Math.max(slotIndex, 0), 1);

    return (
        <details open={defaultOpen || undefined} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
                <span className={cn("h-8 w-1.5 shrink-0 rounded-full", tone.accent)} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                        <span className="text-muted-foreground">№{number} · </span>
                        {subject?.name || "Предмет не выбран"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {WEEKDAY_SHORT_LABEL[entry.weekday]} · {slotIndex >= 0 ? slotLabel(draft.slots[slotIndex], slotIndex) : "пара не выбрана"}
                        {entry.span > 1 && ` (+${entry.span - 1})`} · {entry.groupIds.length > 0 ? `группы ${formatGroups(entry.groupIds)}` : "группы не выбраны"}
                        {entry.kind === "lecture" && " · лекция"}
                        {entry.dates?.length ? ` · ${entry.dates.length} дат` : ""}
                    </p>
                </div>
            </summary>

            <div className="flex flex-col gap-4 border-t p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="День недели">
                        <NativeSelect
                            value={entry.weekday}
                            onChange={(value) => update({ weekday: Number(value) })}
                            options={WEEKDAYS.map((day) => ({ value: day, label: WEEKDAY_LABEL[day] }))}
                        />
                    </Field>
                    <Field label="Пара">
                        <NativeSelect
                            value={entry.slotId}
                            onChange={(value) => update({ slotId: value })}
                            placeholder="Выберите пару"
                            options={draft.slots.map((slot, index) => ({ value: slot.id, label: slotLabel(slot, index) }))}
                        />
                    </Field>
                    <Field label="Сколько пар подряд">
                        <Input type="number" min={1} max={maxSpan} value={entry.span} onChange={(event) => update({ span: Math.max(Number(event.target.value) || 1, 1) })} />
                    </Field>
                    <Field label="Начало (если не с начала пары)">
                        <Input type="time" value={entry.startsAt ?? ""} onChange={(event) => update({ startsAt: event.target.value || undefined })} />
                    </Field>
                    <Field label="Предмет" className="lg:col-span-2">
                        <NativeSelect
                            value={entry.subjectId}
                            onChange={(value) => update({ subjectId: value })}
                            placeholder="Выберите предмет"
                            options={draft.subjects.map((item) => ({ value: item.id, label: item.name || "Без названия" }))}
                        />
                    </Field>
                    <Field label="Тип занятия">
                        <NativeSelect value={entry.kind} onChange={(value) => update({ kind: value as ScheduleEntry["kind"] })} options={KIND_OPTIONS} />
                    </Field>
                    <Field label="Недели">
                        <NativeSelect value={entry.weeks} onChange={(value) => update({ weeks: value as ScheduleEntry["weeks"] })} options={WEEKS_OPTIONS} />
                    </Field>
                    <Field label="Часов за занятие">
                        <Input type="number" min={0} value={entry.hours ?? ""} onChange={(event) => update({ hours: optionalNumber(event.target.value) })} />
                    </Field>
                    <Field label="Всего занятий">
                        <Input type="number" min={0} value={entry.total ?? ""} onChange={(event) => update({ total: optionalNumber(event.target.value) })} />
                    </Field>
                    <Field label="Аудитория">
                        <Input value={entry.room ?? ""} onChange={(event) => update({ room: event.target.value || undefined })} />
                    </Field>
                    <Field label="Примечание" className="sm:col-span-2 lg:col-span-1">
                        <Input value={entry.note ?? ""} onChange={(event) => update({ note: event.target.value || undefined })} />
                    </Field>
                </div>

                <CommonFilterChips
                    label="Группы"
                    options={draft.groups.map((group) => ({ value: group, label: group }))}
                    value={entry.groupIds}
                    onChange={(groupIds) => update({ groupIds })}
                />
                {draft.groups.length > 0 && (
                    <div className="-mt-2 flex gap-3 text-xs">
                        <button type="button" className="text-primary hover:underline" onClick={() => update({ groupIds: draft.groups })}>
                            Все группы
                        </button>
                        <button type="button" className="text-muted-foreground hover:underline" onClick={() => update({ groupIds: [] })}>
                            Снять все
                        </button>
                    </div>
                )}
                {draft.groups.length === 0 && <p className="-mt-2 text-xs text-muted-foreground">Сначала добавьте группы на вкладке «Основное».</p>}

                <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Даты (для лекций и разовых занятий; у еженедельных пар оставьте пустым)</span>
                    <div className="flex flex-wrap gap-1.5">
                        {(entry.dates ?? []).map((date) => (
                            <Chip key={date} onRemove={() => removeDate(date)}>
                                {formatDate(date)}
                            </Chip>
                        ))}
                    </div>
                    <ChipInput
                        type="date"
                        placeholder="Дата"
                        onAdd={(date) => update({ dates: [...new Set([...(entry.dates ?? []), date])].sort() })}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => duplicateEntry(entry)}>
                        <CopyIcon className="size-4" />
                        Дублировать
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem("entries", entry.id)}>
                        <Trash2Icon className="size-4" />
                        Удалить
                    </Button>
                </div>
            </div>
        </details>
    );
};

const EntriesSection: FC<EditorProps> = ({ editor }) => {
    const { draft, addEntry } = editor;
    const [weekdays, setWeekdays] = useState<number[]>([]);
    const [openId, setOpenId] = useState<string>();

    const slotOrder = new Map(draft.slots.map((slot, index) => [slot.id, index]));
    const numbered = draft.entries.map((entry, index) => ({ entry, number: index + 1 }));
    const visible = numbered
        .filter(({ entry }) => weekdays.length === 0 || weekdays.includes(entry.weekday))
        .sort((a, b) => a.entry.weekday - b.entry.weekday || (slotOrder.get(a.entry.slotId) ?? 0) - (slotOrder.get(b.entry.slotId) ?? 0) || a.number - b.number);

    const canAdd = draft.slots.length > 0 && draft.subjects.length > 0 && draft.groups.length > 0;

    return (
        <Section
            title="Занятия"
            description="Каждая запись — одно занятие: день, пара, предмет и группы. Лекции потока задаются по датам."
            action={
                <AddButton
                    onClick={() => {
                        if (canAdd) setOpenId(addEntry(weekdays.length === 1 ? weekdays[0] : undefined));
                    }}
                >
                    Добавить занятие
                </AddButton>
            }
        >
            {!canAdd && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Чтобы добавлять занятия, задайте группы, пары и хотя бы один предмет.</p>}

            <CommonFilterChips
                label="Показать дни"
                options={WEEKDAYS.map((day) => ({ value: day, label: WEEKDAY_SHORT_LABEL[day] }))}
                value={weekdays}
                onChange={setWeekdays}
            />

            <div className="flex flex-col gap-2">
                {visible.map(({ entry, number }) => (
                    <EntryEditor key={entry.id} editor={editor} entry={entry} number={number} defaultOpen={entry.id === openId} />
                ))}
                {canAdd && visible.length === 0 && <p className="text-sm text-muted-foreground">Занятий пока нет.</p>}
            </div>
        </Section>
    );
};

const PERIOD_KIND_OPTIONS: { value: SchedulePeriod["kind"]; label: string }[] = [
    { value: "study", label: "Учёба" },
    { value: "practice", label: "Практика" },
    { value: "session", label: "Сессия" },
    { value: "holiday", label: "Каникулы" },
];

const PeriodsSection: FC<EditorProps> = ({ editor }) => {
    const { draft, addPeriod, updateItem, removeItem } = editor;

    return (
        <Section
            title="Периоды семестра"
            description="Учёба, практика, сессия и каникулы — отображаются полосой над расписанием."
            action={<AddButton onClick={addPeriod}>Добавить период</AddButton>}
        >
            {draft.periods.length === 0 && <p className="text-sm text-muted-foreground">Периодов пока нет.</p>}
            <div className="flex flex-col gap-3">
                {draft.periods.map((period) => (
                    <div key={period.id} className="flex flex-wrap items-end gap-3">
                        <Field label="Тип" className="w-40">
                            <NativeSelect value={period.kind} onChange={(value) => updateItem("periods", period.id, { kind: value as SchedulePeriod["kind"] })} options={PERIOD_KIND_OPTIONS} />
                        </Field>
                        <Field label="Название" className="min-w-52 flex-1">
                            <Input value={period.label} placeholder="Учебные занятия" onChange={(event) => updateItem("periods", period.id, { label: event.target.value })} />
                        </Field>
                        <Field label="С">
                            <Input type="date" value={period.from} onChange={(event) => updateItem("periods", period.id, { from: event.target.value })} />
                        </Field>
                        <Field label="По">
                            <Input type="date" value={period.to} onChange={(event) => updateItem("periods", period.id, { to: event.target.value })} />
                        </Field>
                        <RemoveButton title="Удалить период" onClick={() => removeItem("periods", period.id)} />
                    </div>
                ))}
            </div>
        </Section>
    );
};

const NotesSection: FC<EditorProps> = ({ editor }) => {
    const { draft, patch, setLines } = editor;

    return (
        <Section title="Экзамены и утверждение" description="Строки, которые печатаются под расписанием. По одному пункту на строку.">
            <div className="grid gap-4 md:grid-cols-2">
                <LinesField label="Экзамены" lines={draft.exams} onChange={(lines) => setLines("exams", lines)} />
                <LinesField label="Зачёты" lines={draft.credits} onChange={(lines) => setLines("credits", lines)} />
                <Field label="Примечание" className="md:col-span-2">
                    <Textarea rows={3} value={draft.note ?? ""} onChange={(event) => patch({ note: event.target.value || undefined })} />
                </Field>
                <Field label="Утверждает (должность)">
                    <Input value={draft.approvedBy ?? ""} onChange={(event) => patch({ approvedBy: event.target.value || undefined })} />
                </Field>
                <Field label="Дата утверждения">
                    <Input value={draft.approvedOn ?? ""} placeholder="«01» сентября 2026 г." onChange={(event) => patch({ approvedOn: event.target.value || undefined })} />
                </Field>
                <LinesField label="Согласовано" hint="Должности согласующих" lines={draft.agreedBy} onChange={(lines) => setLines("agreedBy", lines)} rows={3} />
            </div>
        </Section>
    );
};

const PreviewSection: FC<EditorProps> = ({ editor }) => {
    const viewModeState = useCommonWrapperViewMode("table");
    const { issues, previewView, conflicts } = editor;

    return (
        <Section title="Предпросмотр" description="Так расписание увидят на странице «Расписание».">
            {previewView ? (
                <>
                    {conflicts.length > 0 && <ConflictsNotice conflicts={conflicts} />}
                    <ScheduleBoard view={previewView} viewModeState={viewModeState} />
                </>
            ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Предпросмотр появится, когда будут исправлены ошибки ({issues.length}).
                </div>
            )}
        </Section>
    );
};

const ConflictsNotice: FC<{ conflicts: string[] }> = ({ conflicts }) => (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-medium">Возможные пересечения ({conflicts.length})</p>
        <ul className="mt-1 list-disc pl-5">
            {conflicts.slice(0, 8).map((conflict) => (
                <li key={conflict}>{conflict}</li>
            ))}
            {conflicts.length > 8 && <li>и ещё {conflicts.length - 8}…</li>}
        </ul>
    </div>
);

/* ───────────── shell ───────────── */

const TABS: { key: EditorTab; label: string }[] = [
    { key: "general", label: "Основное" },
    { key: "slots", label: "Сетка времени" },
    { key: "subjects", label: "Предметы" },
    { key: "entries", label: "Занятия" },
    { key: "periods", label: "Периоды" },
    { key: "notes", label: "Экзамены и утверждение" },
    { key: "preview", label: "Предпросмотр" },
];

const SECTIONS: Record<ScheduleEditorSection | "preview", FC<EditorProps>> = {
    general: GeneralSection,
    slots: SlotsSection,
    subjects: SubjectsSection,
    entries: EntriesSection,
    periods: PeriodsSection,
    notes: NotesSection,
    preview: PreviewSection,
};

const ScheduleEditorPanel: FC<EditorProps> = ({ editor }) => {
    const { tab, setTab, issues, draft } = editor;
    const ActiveSection = SECTIONS[tab];

    const issuesIn = (key: EditorTab) => issues.filter((issue) => issue.section === key).length;
    const counts: Partial<Record<EditorTab, number>> = { entries: draft.entries.length, subjects: draft.subjects.length };

    return (
        <div className="flex flex-col gap-5">
            <nav className="flex flex-wrap gap-1 border-b" aria-label="Разделы расписания">
                {TABS.map(({ key, label }) => {
                    const errors = issuesIn(key);
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            aria-current={tab === key}
                            className={cn(
                                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                                tab === key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label}
                            {counts[key] ? <span className="text-xs text-muted-foreground">{counts[key]}</span> : null}
                            {errors > 0 && <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{errors}</span>}
                        </button>
                    );
                })}
            </nav>

            {tab !== "preview" && issuesIn(tab) > 0 && (
                <ul className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {issues
                        .filter((issue) => issue.section === tab)
                        .map((issue) => (
                            <li key={issue.message}>{issue.message}</li>
                        ))}
                </ul>
            )}

            <ActiveSection editor={editor} />
        </div>
    );
};

export { ScheduleEditorPanel };
