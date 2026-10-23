import type { ScheduleTone } from "@/shared/components/schedule";
import type { ScheduleCycle, ScheduleFilters, ScheduleLecture, ScheduleTimetable } from "./schedule.schema";
import { formatDayMonth, formatGroups, isoWeekday, resolveDateRange } from "./schedule.utils";

/* View model of a cycle-based timetable (4th course on): stream lectures on
 * set dates plus per-group cycles of practical classes, merged into one
 * chronological timeline for a group, and a groups × disciplines matrix for
 * everyone. Dates are ISO strings, compared as text. */

const SHORT_WEEKDAY = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MS_PER_DAY = 86_400_000;

export type CycleState = "past" | "current" | "upcoming";

const stateOf = (from: string, to: string, today: string): CycleState =>
    today < from ? "upcoming" : today > to ? "past" : "current";

/** Mon–Sat between two dates, both inclusive: the days a cycle actually meets. */
const workingDays = (from: string, to: string) => {
    let count = 0;
    const end = Date.parse(`${to}T00:00:00Z`);
    for (let time = Date.parse(`${from}T00:00:00Z`); time <= end; time += MS_PER_DAY) {
        if (new Date(time).getUTCDay() !== 0) count++;
    }
    return count;
};

const plural = (count: number, [one, few, many]: [string, string, string]) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
};

export const formatDayLabel = (iso: string) => `${SHORT_WEEKDAY[isoWeekday(iso)]}, ${formatDayMonth(iso)}`;
export const formatCycleRange = (from: string, to: string) => `${formatDayMonth(from)} – ${formatDayMonth(to)}`;

const REMOTE_LABEL = "С применением ДОТ";

export interface CycleLectureView {
    id: string;
    time: string;
    title: string;
    tone: ScheduleTone;
    place: string;
    remote: boolean;
    audience?: string;
}

export interface CycleLectureDay {
    date: string;
    label: string;
    state: CycleState;
    lectures: CycleLectureView[];
}

export interface CycleView {
    id: string;
    title: string;
    tone: ScheduleTone;
    from: string;
    to: string;
    range: string;
    /** "7 учебных дней" */
    length: string;
    state: CycleState;
    /** Share of the cycle already behind, 0..1 — for the "current" progress bar. */
    progress: number;
    note?: string;
}

/** One step of the group's term, in date order: a day of stream lectures, or a
 * cycle (with any lecture days that fall inside it). */
export type CycleTimelineItem =
    | { kind: "lectures"; id: string; day: CycleLectureDay }
    | { kind: "cycle"; id: string; cycle: CycleView; lectureDays: CycleLectureDay[] };

export interface CycleMatrixCell {
    range: string;
    state: CycleState;
    tone: ScheduleTone;
}

export interface CycleMatrixRow {
    id: string;
    /** "401, 402" — groups with identical cycles share a row, as on paper. */
    label: string;
    cells: (CycleMatrixCell | undefined)[];
    /** This row holds the group picked in the filters. */
    selected: boolean;
}

export interface CycleLectureRow {
    id: string;
    title: string;
    tone: ScheduleTone;
    time: string;
    dates: string;
    count: number;
    place: string;
    remote: boolean;
    audience?: string;
}

export interface CycleScheduleView {
    groupId?: string;
    /** What the group is on now, or what comes next. */
    now?: { cycle?: CycleView; nextCycle?: CycleView; nextLecture?: { day: CycleLectureDay; lecture: CycleLectureView } };
    timeline: CycleTimelineItem[];
    matrix: { columns: { id: string; title: string; tone: ScheduleTone }[]; rows: CycleMatrixRow[] };
    lectureRows: CycleLectureRow[];
    /** Lecture days + cycles on screen, for the filter bar counter. */
    count: number;
    emptyReason?: string;
}

const subjectOf = (timetable: ScheduleTimetable, id: string) => timetable.subjects.find((subject) => subject.id === id);

const lectureFor = (lecture: ScheduleLecture, groupId?: string) =>
    !groupId || lecture.groupIds.length === 0 || lecture.groupIds.includes(groupId);

const toLectureView = (timetable: ScheduleTimetable, lecture: ScheduleLecture): CycleLectureView => {
    const subject = subjectOf(timetable, lecture.subjectId);
    return {
        id: lecture.id,
        time: `${lecture.start}–${lecture.end}`,
        title: subject?.name ?? lecture.subjectId,
        tone: subject?.tone ?? "slate",
        place: lecture.remote ? REMOTE_LABEL : (lecture.room ?? ""),
        remote: lecture.remote,
        audience: lecture.groupIds.length > 0 ? `Группы ${formatGroups(lecture.groupIds)}` : undefined,
    };
};

const toCycleView = (timetable: ScheduleTimetable, cycle: ScheduleCycle, today: string): CycleView => {
    const subject = subjectOf(timetable, cycle.subjectId);
    const days = workingDays(cycle.from, cycle.to);
    const state = stateOf(cycle.from, cycle.to, today);
    const done = state === "current" ? workingDays(cycle.from, today) : state === "past" ? days : 0;
    return {
        id: cycle.id,
        title: subject?.name ?? cycle.subjectId,
        tone: subject?.tone ?? "slate",
        from: cycle.from,
        to: cycle.to,
        range: formatCycleRange(cycle.from, cycle.to),
        length: `${days} ${plural(days, ["учебный день", "учебных дня", "учебных дней"])}`,
        state,
        progress: days > 0 ? done / days : 0,
        note: cycle.note,
    };
};

const inRange = (iso: string, from?: string, to?: string) => (!from || iso >= from) && (!to || iso <= to);

/** Lecture days for the group (or everyone), filtered, in date order. */
const lectureDays = (timetable: ScheduleTimetable, filters: ScheduleFilters, today: string): CycleLectureDay[] => {
    const range = resolveDateRange(filters);
    const byDate = new Map<string, { start: string; view: CycleLectureView }[]>();

    for (const lecture of timetable.lectures) {
        if (!lectureFor(lecture, filters.groupId)) continue;
        if (filters.subjectIds.length > 0 && !filters.subjectIds.includes(lecture.subjectId)) continue;
        const view = toLectureView(timetable, lecture);
        for (const date of lecture.dates) {
            if (!inRange(date, range?.from, range?.to)) continue;
            const list = byDate.get(date) ?? [];
            list.push({ start: lecture.start, view });
            byDate.set(date, list);
        }
    }

    return [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, list]) => ({
            date,
            label: formatDayLabel(date),
            state: date < today ? "past" : date === today ? "current" : "upcoming",
            lectures: list.sort((a, b) => a.start.localeCompare(b.start)).map(({ view }) => view),
        }));
};

const groupCycles = (timetable: ScheduleTimetable, filters: ScheduleFilters, today: string): CycleView[] => {
    if (!filters.groupId) return [];
    const range = resolveDateRange(filters);
    return timetable.cycles
        .filter((cycle) => cycle.groupIds.includes(filters.groupId!))
        .filter((cycle) => filters.subjectIds.length === 0 || filters.subjectIds.includes(cycle.subjectId))
        // A cycle is shown when it overlaps the chosen dates at all.
        .filter((cycle) => !range || (cycle.to >= range.from && cycle.from <= range.to))
        .map((cycle) => toCycleView(timetable, cycle, today))
        .sort((a, b) => a.from.localeCompare(b.from));
};

const buildTimeline = (days: CycleLectureDay[], cycles: CycleView[]): CycleTimelineItem[] => {
    const items: CycleTimelineItem[] = [];
    const nested = new Set<string>();

    for (const cycle of cycles) {
        const inside = days.filter((day) => day.date >= cycle.from && day.date <= cycle.to);
        inside.forEach((day) => nested.add(day.date));
        items.push({ kind: "cycle", id: `cycle-${cycle.id}`, cycle, lectureDays: inside });
    }
    for (const day of days) {
        if (!nested.has(day.date)) items.push({ kind: "lectures", id: `day-${day.date}`, day });
    }

    const startOf = (item: CycleTimelineItem) => (item.kind === "cycle" ? item.cycle.from : item.day.date);
    return items.sort((a, b) => startOf(a).localeCompare(startOf(b)));
};

/** Disciplines in the order their first cycle starts — the paper column order
 * is arbitrary, a chronological one reads left to right. */
const buildMatrix = (timetable: ScheduleTimetable, filters: ScheduleFilters, today: string): CycleScheduleView["matrix"] => {
    const subjectIds = [...new Set(timetable.cycles.map((cycle) => cycle.subjectId))].filter(
        (id) => filters.subjectIds.length === 0 || filters.subjectIds.includes(id),
    );
    const columns = subjectIds.map((id) => {
        const subject = subjectOf(timetable, id);
        return { id, title: subject?.name ?? id, tone: subject?.tone ?? ("slate" as ScheduleTone) };
    });

    const cellsOf = (group: string) =>
        columns.map((column): CycleMatrixCell | undefined => {
            const cycle = timetable.cycles.find((item) => item.subjectId === column.id && item.groupIds.includes(group));
            return cycle ? { range: formatCycleRange(cycle.from, cycle.to), state: stateOf(cycle.from, cycle.to, today), tone: column.tone } : undefined;
        });

    // Neighbouring groups with the same cycles share a row.
    const rows: CycleMatrixRow[] = [];
    let previousKey = "";
    for (const group of timetable.groups) {
        const cells = cellsOf(group);
        const key = JSON.stringify(cells.map((cell) => cell?.range));
        const last = rows[rows.length - 1];
        if (last && key === previousKey) {
            last.label += `, ${group}`;
            last.selected ||= group === filters.groupId;
        } else {
            rows.push({ id: group, label: group, cells, selected: group === filters.groupId });
        }
        previousKey = key;
    }
    return { columns, rows };
};

const buildLectureRows = (timetable: ScheduleTimetable, filters: ScheduleFilters): CycleLectureRow[] =>
    timetable.lectures
        .filter((lecture) => lectureFor(lecture, filters.groupId))
        .filter((lecture) => filters.subjectIds.length === 0 || filters.subjectIds.includes(lecture.subjectId))
        .map((lecture) => {
            const view = toLectureView(timetable, lecture);
            return {
                id: lecture.id,
                title: view.title,
                tone: view.tone,
                time: view.time,
                dates: lecture.dates.map(formatDayMonth).join(", "),
                count: lecture.dates.length,
                place: view.place,
                remote: lecture.remote,
                audience: view.audience,
            };
        });

export const buildCycleScheduleView = (timetable: ScheduleTimetable, filters: ScheduleFilters, today: string): CycleScheduleView => {
    const days = lectureDays(timetable, filters, today);
    const cycles = groupCycles(timetable, filters, today);
    const timeline = buildTimeline(days, cycles);

    const upcomingDay = days.find((day) => day.date >= today);
    const now = filters.groupId
        ? {
              cycle: cycles.find((cycle) => cycle.state === "current"),
              nextCycle: cycles.find((cycle) => cycle.state === "upcoming"),
              nextLecture: upcomingDay ? { day: upcomingDay, lecture: upcomingDay.lectures[0] } : undefined,
          }
        : undefined;

    return {
        groupId: filters.groupId,
        now,
        timeline,
        matrix: buildMatrix(timetable, filters, today),
        lectureRows: buildLectureRows(timetable, filters),
        count: days.length + cycles.length,
        emptyReason: timeline.length === 0 && !filters.groupId && days.length === 0 ? "По выбранным фильтрам лекций нет" : undefined,
    };
};
