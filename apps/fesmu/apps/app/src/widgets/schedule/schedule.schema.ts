import { z } from "zod";

/** Mon..Sat as in ISO weekday numbers; Sunday (7) is valid data but never used by the faculty timetables. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

export const WEEKDAY_LABEL: Record<number, string> = {
    1: "Понедельник",
    2: "Вторник",
    3: "Среда",
    4: "Четверг",
    5: "Пятница",
    6: "Суббота",
    7: "Воскресенье",
};

export const WEEKDAY_SHORT_LABEL: Record<number, string> = {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    7: "Вс",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД");
const clockTime = z.string().regex(/^\d{1,2}:\d{2}$/, "Время в формате ЧЧ:ММ");

export const scheduleToneSchema = z.enum([
    "rose", "sky", "emerald", "amber", "violet", "teal", "orange", "indigo", "pink", "cyan", "lime", "slate",
]);

export const scheduleSubjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    tone: scheduleToneSchema,
});

/** A row of the day grid: one class period. */
export const scheduleSlotSchema = z.object({
    id: z.string(),
    start: clockTime,
    end: clockTime,
});

/** Numerator/denominator: the paper timetables' "по числ." / "по знам." alternating weeks. */
export const scheduleWeeksSchema = z.enum(["every", "numerator", "denominator"]);

export const scheduleEntrySchema = z.object({
    id: z.string(),
    /** ISO weekday, 1 = Monday. */
    weekday: z.number().int().min(1).max(7),
    slotId: z.string(),
    /** How many consecutive slots it occupies (a 4-hour lesson covers two periods). */
    span: z.number().int().min(1).default(1),
    groupIds: z.array(z.string()).min(1),
    subjectId: z.string(),
    /** A lecture is given to a whole stream on specific dates; a practice repeats weekly. */
    kind: z.enum(["lecture", "practice"]).default("practice"),
    /** Actual start when it isn't the slot's start ("С 13:10"). */
    startsAt: clockTime.optional(),
    /** Length of one session in academic hours. */
    hours: z.number().positive().optional(),
    /** How many sessions the term has. */
    total: z.number().int().positive().optional(),
    weeks: scheduleWeeksSchema.default("every"),
    /** Exact dates, for lectures; a weekly practice leaves this out. */
    dates: z.array(isoDate).optional(),
    room: z.string().optional(),
    note: z.string().optional(),
});

/** A stream lecture of a cycle-based timetable: one discipline at one time on set dates. */
export const scheduleLectureSchema = z.object({
    id: z.string(),
    subjectId: z.string(),
    start: clockTime,
    end: clockTime,
    dates: z.array(isoDate).min(1),
    room: z.string().optional(),
    /** Held with distance learning technologies (ДОТ). */
    remote: z.boolean().default(false),
    /** Empty = the whole timetable; set for an elective only some groups take. */
    groupIds: z.array(z.string()).default([]),
    note: z.string().optional(),
});

/** A block of practical classes: the groups study one discipline every working
 * day from `from` to `to`, following the department's own timetable. */
export const scheduleCycleSchema = z.object({
    id: z.string(),
    subjectId: z.string(),
    groupIds: z.array(z.string()).min(1),
    from: isoDate,
    to: isoDate,
    note: z.string().optional(),
});

/** Courses 1–3 meet on a weekly grid; from the 4th course on, practical
 * classes run as cycles and lectures are given on set dates. */
export const scheduleFormatSchema = z.enum(["weekly", "cycles"]);

export const schedulePeriodSchema = z.object({
    id: z.string(),
    kind: z.enum(["study", "practice", "session", "holiday"]),
    label: z.string(),
    from: isoDate,
    to: isoDate,
});

export const scheduleTimetableSchema = z.object({
    id: z.string(),
    title: z.string(),
    faculty: z.string(),
    program: z.object({ id: z.string(), code: z.string(), name: z.string() }),
    course: z.number().int().min(1),
    /** "1 поток" etc. */
    stream: z.string().optional(),
    semester: z.object({ label: z.string(), start: isoDate, end: isoDate }),
    groups: z.array(z.string()).min(1),
    format: scheduleFormatSchema.default("weekly"),
    /** Weekly format only. */
    slots: z.array(scheduleSlotSchema).default([]),
    subjects: z.array(scheduleSubjectSchema),
    /** Weekly format only. */
    entries: z.array(scheduleEntrySchema).default([]),
    /** Cycle format only. */
    lectures: z.array(scheduleLectureSchema).default([]),
    /** Cycle format only. */
    cycles: z.array(scheduleCycleSchema).default([]),
    periods: z.array(schedulePeriodSchema),
    exams: z.array(z.string()),
    credits: z.array(z.string()),
    note: z.string().optional(),
    approvedBy: z.string().optional(),
    approvedOn: z.string().optional(),
    agreedBy: z.array(z.string()).default([]),
});

export const scheduleFilterSchema = z.object({
    programId: z.string().optional(),
    course: z.number().int().optional(),
    /** Disambiguates when a program+course has more than one timetable (several
     * streams, or the same course across different semesters). */
    timetableId: z.string().optional(),
    groupId: z.string().optional(),
    subjectIds: z.array(z.string()),
    weekdays: z.array(z.number().int()),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
});

export type ScheduleTone = z.infer<typeof scheduleToneSchema>;
export type ScheduleSubject = z.infer<typeof scheduleSubjectSchema>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
export type SchedulePeriod = z.infer<typeof schedulePeriodSchema>;
export type ScheduleLecture = z.infer<typeof scheduleLectureSchema>;
export type ScheduleCycle = z.infer<typeof scheduleCycleSchema>;
export type ScheduleFormat = z.infer<typeof scheduleFormatSchema>;
export type ScheduleTimetable = z.infer<typeof scheduleTimetableSchema>;
export type ScheduleTimetableInput = z.input<typeof scheduleTimetableSchema>;
export type ScheduleFilters = z.infer<typeof scheduleFilterSchema>;

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilters = { subjectIds: [], weekdays: [] };
