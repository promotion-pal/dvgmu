/** Domain-agnostic view models for the shared timetable components: whatever
 * produces a schedule (a university, a clinic rota, ...) maps its own data
 * into these and the components draw it. */

export type ScheduleTone =
    | "rose"
    | "sky"
    | "emerald"
    | "amber"
    | "violet"
    | "teal"
    | "orange"
    | "indigo"
    | "pink"
    | "cyan"
    | "lime"
    | "slate";

export interface ScheduleLessonView {
    id: string;
    title: string;
    tone: ScheduleTone;
    /** "08:30–10:10" or "с 13:10" */
    time?: string;
    /** Secondary line, e.g. "3 ч, 16 занятий" */
    meta?: string;
    badges?: string[];
    location?: string;
    /** Pre-formatted dates a recurring-by-date lesson (a stream lecture) takes place on. */
    dates?: string;
    /** Who it is for, e.g. "101–104". Shown where the layout has no column for it. */
    audience?: string;
}

export interface ScheduleGridColumn {
    id: string;
    label: string;
}

export interface ScheduleGridSlot {
    id: string;
    label: string;
}

/** Lessons occupying one merged cell: `columnIds` must be contiguous columns of
 * the grid, `slotSpan` how many consecutive slots it covers. Several lessons
 * in one placement are stacked (a stream-lecture cell lists every subject). */
export interface ScheduleGridPlacement {
    id: string;
    slotId: string;
    slotSpan: number;
    columnIds: string[];
    lessons: ScheduleLessonView[];
}

export interface ScheduleGridSection {
    id: string;
    title: string;
    subtitle?: string;
    slots: ScheduleGridSlot[];
    placements: ScheduleGridPlacement[];
}

/** Lessons that start at the same time, shown under one time marker. */
export interface ScheduleAgendaItem {
    id: string;
    time: string;
    lessons: ScheduleLessonView[];
}

export interface ScheduleAgendaSection {
    id: string;
    title: string;
    subtitle?: string;
    items: ScheduleAgendaItem[];
}

export type SchedulePeriodTone = "study" | "practice" | "session" | "holiday";

export interface SchedulePeriodView {
    id: string;
    label: string;
    /** Pre-formatted, e.g. "01.09.2026 – 24.12.2026" */
    range: string;
    tone: SchedulePeriodTone;
    active?: boolean;
}
