import { scheduleToneSchema } from "./schedule.schema";
import type { ScheduleEntry, ScheduleSlot, ScheduleSubject, ScheduleTimetable } from "./schedule.schema";

/* Pure helpers of the timetable editor: creating drafts, keeping references
 * between parts intact, and checking the draft. The rules mirror the server's
 * (api/internal/domain/models/schedule.validate.go) so mistakes surface while typing. */

const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TONES = scheduleToneSchema.options;

/** The usual class periods of the faculty, offered for a new timetable. */
export const DEFAULT_SLOTS: Pick<ScheduleSlot, "start" | "end">[] = [
    { start: "08:30", end: "10:10" },
    { start: "10:40", end: "12:20" },
    { start: "12:50", end: "14:30" },
    { start: "14:45", end: "16:25" },
    { start: "16:35", end: "18:15" },
];

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

export const emptyTimetable = (): ScheduleTimetable => ({
    id: "",
    title: "",
    faculty: "",
    program: { id: "", code: "", name: "" },
    course: 1,
    semester: { label: "", start: "", end: "" },
    groups: [],
    format: "weekly",
    slots: DEFAULT_SLOTS.map((slot) => ({ ...slot, id: newId("s") })),
    subjects: [],
    entries: [],
    lectures: [],
    cycles: [],
    periods: [],
    exams: [],
    credits: [],
    agreedBy: [],
});

export const emptyEntry = (timetable: ScheduleTimetable, weekday = 1): ScheduleEntry => ({
    id: newId("e"),
    weekday,
    slotId: timetable.slots[0]?.id ?? "",
    span: 1,
    groupIds: [],
    subjectId: timetable.subjects[0]?.id ?? "",
    kind: "practice",
    weeks: "every",
});

export const emptySubject = (existing: ScheduleSubject[]): ScheduleSubject => ({
    id: newId("sub"),
    name: "",
    tone: TONES[existing.length % TONES.length],
});

/** The program's id is not something to type: the code identifies it, so timetables of one specialty share an id. */
export const programIdFor = (code: string, current: string) => current || code.trim();

/** "101-110" and "101, 102" -> the groups they name, in order, without repeats. */
export const parseGroupInput = (input: string): string[] => {
    const groups: string[] = [];
    for (const part of input.split(/[\s,;]+/).filter(Boolean)) {
        const range = part.match(/^(\d+)[-–](\d+)$/);
        if (range && Number(range[2]) >= Number(range[1]) && Number(range[2]) - Number(range[1]) < 100) {
            for (let n = Number(range[1]); n <= Number(range[2]); n++) groups.push(String(n));
        } else {
            groups.push(part);
        }
    }
    return [...new Set(groups)];
};

export const slotLabel = (slot: ScheduleSlot, index: number) => `${index + 1} пара · ${slot.start}–${slot.end}`;

/* ───────────── references ───────────── */

export const entriesUsing = (timetable: ScheduleTimetable, by: { slotId?: string; subjectId?: string; group?: string }) =>
    [...timetable.entries, ...timetable.lectures, ...timetable.cycles].filter((entry) =>
        (by.slotId !== undefined && "slotId" in entry && entry.slotId === by.slotId) ||
        (by.subjectId !== undefined && entry.subjectId === by.subjectId) ||
        (by.group !== undefined && entry.groupIds.includes(by.group)),
    );

/** Removing a group takes it out of every lesson; lessons left with no group are dropped. */
export const withoutGroup = (timetable: ScheduleTimetable, group: string): ScheduleTimetable => ({
    ...timetable,
    groups: timetable.groups.filter((item) => item !== group),
    entries: timetable.entries
        .map((entry) => ({ ...entry, groupIds: entry.groupIds.filter((item) => item !== group) }))
        .filter((entry) => entry.groupIds.length > 0),
    lectures: timetable.lectures.flatMap((lecture) => {
        if (!lecture.groupIds.includes(group)) return [lecture];
        const groupIds = lecture.groupIds.filter((item) => item !== group);
        return groupIds.length ? [{ ...lecture, groupIds }] : [];
    }),
    cycles: timetable.cycles
        .map((cycle) => ({ ...cycle, groupIds: cycle.groupIds.filter((item) => item !== group) }))
        .filter((cycle) => cycle.groupIds.length > 0),
});

/* ───────────── validation ───────────── */

export type ScheduleEditorSection = "general" | "slots" | "subjects" | "entries" | "periods" | "notes";

export interface ScheduleIssue {
    section: ScheduleEditorSection;
    message: string;
}

const minutes = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + m;
};

export const validateTimetable = (t: ScheduleTimetable): ScheduleIssue[] => {
    const issues: ScheduleIssue[] = [];
    const add = (section: ScheduleEditorSection, message: string) => issues.push({ section, message });

    if (!t.title.trim()) add("general", "Укажите название расписания");
    if (!t.program.code.trim() || !t.program.name.trim()) add("general", "Укажите код и название специальности");
    if (!(t.course >= 1)) add("general", "Курс должен быть не меньше 1");
    if (!t.semester.label.trim()) add("general", "Укажите название семестра");
    if (!ISO_DATE.test(t.semester.start) || !ISO_DATE.test(t.semester.end)) {
        add("general", "Укажите даты начала и конца семестра");
    } else if (t.semester.end < t.semester.start) {
        add("general", "Семестр заканчивается раньше, чем начинается");
    }
    if (t.groups.length === 0) add("general", "Добавьте хотя бы одну группу");

    const weeklySlots = t.format === "weekly" ? t.slots : [];
    if (t.format === "weekly" && weeklySlots.length === 0) add("slots", "Добавьте хотя бы одну пару");
    weeklySlots.forEach((slot, index) => {
        const previous = weeklySlots[index - 1];
        if (!CLOCK.test(slot.start) || !CLOCK.test(slot.end)) add("slots", `Пара ${index + 1}: укажите время начала и конца`);
        else if (minutes(slot.end) <= minutes(slot.start)) add("slots", `Пара ${index + 1} заканчивается раньше, чем начинается`);
        else if (previous && CLOCK.test(previous.end) && minutes(slot.start) < minutes(previous.end)) {
            add("slots", `Пара ${index + 1} начинается раньше окончания пары ${index}`);
        }
    });

    const subjectIds = new Set(t.subjects.map((subject) => subject.id));
    t.subjects.forEach((subject, index) => {
        if (!subject.name.trim()) add("subjects", `Предмет ${index + 1}: укажите название`);
    });
    const names = t.subjects.map((subject) => subject.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) add("subjects", "Есть предметы с одинаковым названием");

    const slotIndex = new Map(t.slots.map((slot, index) => [slot.id, index]));
    const groups = new Set(t.groups);
    t.entries.forEach((entry, index) => {
        const label = `Занятие ${index + 1}`;
        const slot = slotIndex.get(entry.slotId);
        if (slot === undefined) add("entries", `${label}: выберите пару`);
        else if (slot + entry.span > t.slots.length) add("entries", `${label} выходит за последнюю пару сетки`);
        if (!subjectIds.has(entry.subjectId)) add("entries", `${label}: выберите предмет`);
        if (entry.groupIds.length === 0) add("entries", `${label}: выберите хотя бы одну группу`);
        else if (entry.groupIds.some((group) => !groups.has(group))) add("entries", `${label}: указана группа, которой нет в расписании`);
        if (entry.startsAt && !CLOCK.test(entry.startsAt)) add("entries", `${label}: время начала в формате ЧЧ:ММ`);
    });

    t.lectures.forEach((lecture, index) => {
        const label = `Лекция ${index + 1}`;
        if (!subjectIds.has(lecture.subjectId)) add("entries", `${label}: выберите предмет`);
        if (!CLOCK.test(lecture.start) || !CLOCK.test(lecture.end) || minutes(lecture.end) <= minutes(lecture.start)) {
            add("entries", `${label}: проверьте время начала и окончания`);
        }
        if (!lecture.dates.length || !lecture.dates.every((day) => ISO_DATE.test(day))) add("entries", `${label}: укажите даты`);
        if (!lecture.remote && !lecture.room?.trim()) add("entries", `${label}: укажите аудиторию или выберите ДОТ`);
        if (lecture.groupIds.some((group) => !groups.has(group))) add("entries", `${label}: проверьте группы`);
    });
    t.cycles.forEach((cycle, index) => {
        const label = `Цикл ${index + 1}`;
        if (!subjectIds.has(cycle.subjectId)) add("entries", `${label}: выберите предмет`);
        if (!ISO_DATE.test(cycle.from) || !ISO_DATE.test(cycle.to) || cycle.to < cycle.from) add("entries", `${label}: проверьте даты`);
        if (!cycle.groupIds.length || cycle.groupIds.some((group) => !groups.has(group))) add("entries", `${label}: выберите группы`);
    });

    const ranges = t.periods.flatMap((period, index) => {
        if (!period.label.trim()) add("periods", `Период ${index + 1}: укажите название`);
        if (!ISO_DATE.test(period.from) || !ISO_DATE.test(period.to)) {
            add("periods", `Период ${index + 1}: укажите даты`);
        } else if (period.to < period.from) {
            add("periods", `Период ${index + 1} заканчивается раньше, чем начинается`);
        } else {
            return [{ ...period, number: index + 1 }];
        }
        return [];
    });
    ranges.sort((a, b) => a.from.localeCompare(b.from));
    for (let index = 1; index < ranges.length; index++) {
        const previous = ranges[index - 1];
        const period = ranges[index];
        if (period.from <= previous.to) {
            add("periods", `Периоды ${previous.number} и ${period.number} пересекаются`);
            break;
        }
    }

    return issues;
};

/* ───────────── conflicts ───────────── */

/** Two entries can meet only if their weeks can coincide: "every" meets anything, the alternating weeks only themselves. */
const weeksOverlap = (a: ScheduleEntry, b: ScheduleEntry) => a.weeks === "every" || b.weeks === "every" || a.weeks === b.weeks;

/** Lecture dates decide when two entries meet: a weekly entry has no dates and meets anything, two dated ones meet on shared dates. */
const datesOverlap = (a: ScheduleEntry, b: ScheduleEntry) =>
    !a.dates?.length || !b.dates?.length || a.dates.some((date) => b.dates!.includes(date));

/** Group, weekday and time collisions — a warning for the author, not a reason to refuse saving. */
export const findConflicts = (t: ScheduleTimetable): string[] => {
    const slotIndex = new Map(t.slots.map((slot, index) => [slot.id, index]));
    const subject = (id: string) => t.subjects.find((item) => item.id === id)?.name || "без названия";
    const conflicts: string[] = [];

    for (let i = 0; i < t.entries.length; i++) {
        for (let j = i + 1; j < t.entries.length; j++) {
            const a = t.entries[i];
            const b = t.entries[j];
            const startA = slotIndex.get(a.slotId);
            const startB = slotIndex.get(b.slotId);
            if (a.weekday !== b.weekday || startA === undefined || startB === undefined) continue;
            if (startA >= startB + b.span || startB >= startA + a.span) continue;
            if (!weeksOverlap(a, b) || !datesOverlap(a, b)) continue;

            const shared = a.groupIds.filter((group) => b.groupIds.includes(group));
            if (shared.length === 0) continue;
            conflicts.push(`«${subject(a.subjectId)}» и «${subject(b.subjectId)}» пересекаются у групп ${shared.join(", ")} (занятия ${i + 1} и ${j + 1})`);
        }
    }
    return conflicts;
};
