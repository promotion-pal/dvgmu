import type {
    ScheduleAgendaItem,
    ScheduleAgendaSection,
    ScheduleGridColumn,
    ScheduleGridPlacement,
    ScheduleGridSection,
    ScheduleLessonView,
    SchedulePeriodView,
} from "@/shared/components/schedule";
import { WEEKDAYS, WEEKDAY_LABEL } from "./schedule.schema";
import type { ScheduleEntry, ScheduleFilters, ScheduleTimetable } from "./schedule.schema";
import type { CycleScheduleView } from "./schedule.cycles.utils";

/* Everything here is pure: dates are ISO `YYYY-MM-DD` strings handled in UTC so
 * the user's timezone can never shift a lesson to the neighbouring day. */

const MS_PER_DAY = 86_400_000;
/** Guards the per-day scan against an absurd range typed into the date inputs. */
const MAX_RANGE_DAYS = 400;

/* ───────────── dates ───────────── */

const parseIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export const isoWeekday = (iso: string) => ((parseIso(iso).getUTCDay() + 6) % 7) + 1;

export const formatDayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const formatDate = (iso: string) => `${formatDayMonth(iso)}.${iso.slice(0, 4)}`;
export const formatRange = (from: string, to: string) => `${formatDate(from)} – ${formatDate(to)}`;

/** Monday-aligned week number, so two dates in the same calendar week share it. */
const weekNumber = (iso: string) => Math.floor((parseIso(iso).getTime() / MS_PER_DAY + 3) / 7);

/** The paper timetables' alternating weeks: the term's first week is the numerator. */
export const weekParity = (iso: string, semesterStart: string): "numerator" | "denominator" =>
    Math.abs(weekNumber(iso) - weekNumber(semesterStart)) % 2 === 0 ? "numerator" : "denominator";

export const todayIso = () => toIso(new Date());

const datesBetween = (from: string, to: string) => {
    const days: string[] = [];
    const end = parseIso(to).getTime();
    for (let time = parseIso(from).getTime(), i = 0; time <= end && i < MAX_RANGE_DAYS; time += MS_PER_DAY, i++) {
        days.push(toIso(new Date(time)));
    }
    return days;
};

/** A lone `from` (or `to`) means a single day. */
export const resolveDateRange = (filters: ScheduleFilters) => {
    const from = filters.dateFrom ?? filters.dateTo;
    const to = filters.dateTo ?? filters.dateFrom;
    if (!from || !to) return null;
    return from <= to ? { from, to } : { from: to, to: from };
};

const periodOn = (timetable: ScheduleTimetable, iso: string) =>
    timetable.periods.find((period) => iso >= period.from && iso <= period.to);

/* ───────────── text ───────────── */

const toMinutes = (clock: string) => {
    const [hours, minutes] = clock.split(":").map(Number);
    return hours * 60 + minutes;
};

const padClock = (clock: string) => clock.padStart(5, "0");

const plural = (count: number, [one, few, many]: [string, string, string]) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
};

/** ["101","102","103","107"] -> "101–103, 107". */
export const formatGroups = (groupIds: string[]) => {
    const numeric = groupIds.map(Number);
    if (numeric.some(Number.isNaN)) return groupIds.join(", ");

    const sorted = [...numeric].sort((a, b) => a - b);
    const runs: string[] = [];
    for (let i = 0; i < sorted.length; ) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
        i = j + 1;
    }
    return runs.join(", ");
};

/* ───────────── filtering ───────────── */

/** Does a lesson actually take place on this calendar day? */
const occursOn = (entry: ScheduleEntry, iso: string, timetable: ScheduleTimetable) => {
    if (entry.dates) return entry.dates.includes(iso);
    if (isoWeekday(iso) !== entry.weekday) return false;
    if (periodOn(timetable, iso)?.kind !== "study") return false;
    return entry.weeks === "every" || weekParity(iso, timetable.semester.start) === entry.weeks;
};

interface FilteredEntry {
    entry: ScheduleEntry;
    /** The dates to show for a by-date lesson — narrowed to the chosen range. */
    dates?: string[];
}

export const filterEntries = (timetable: ScheduleTimetable, filters: ScheduleFilters): FilteredEntry[] => {
    const range = resolveDateRange(filters);
    const days = range ? datesBetween(range.from, range.to) : null;

    return timetable.entries.flatMap((entry): FilteredEntry[] => {
        if (filters.weekdays.length > 0 && !filters.weekdays.includes(entry.weekday)) return [];
        if (filters.subjectIds.length > 0 && !filters.subjectIds.includes(entry.subjectId)) return [];
        if (filters.groupId && !entry.groupIds.includes(filters.groupId)) return [];
        if (!days) return [{ entry, dates: entry.dates }];

        const matching = days.filter((day) => occursOn(entry, day, timetable));
        if (matching.length === 0) return [];
        return [{ entry, dates: entry.dates ? matching : undefined }];
    });
};

/** Why nothing is shown, phrased for the person who set the filters. */
export const describeEmpty = (timetable: ScheduleTimetable, filters: ScheduleFilters) => {
    const range = resolveDateRange(filters);
    if (range) {
        const period = periodOn(timetable, range.from);
        if (range.from === range.to && period && period.kind !== "study") {
            return `${formatDate(range.from)} — ${period.label.toLowerCase()}, занятий нет`;
        }
        const { start, end } = timetable.semester;
        if (range.to < start || range.from > end) {
            return `Выбранные даты вне семестра (${formatRange(start, end)})`;
        }
    }
    return "По выбранным фильтрам занятий не найдено";
};

/* ───────────── filter options & transitions ───────────── */

export const defaultFilters = (timetables: ScheduleTimetable[]): ScheduleFilters => {
    const first = timetables[0];
    return { programId: first?.program.id, course: first?.course, timetableId: first?.id, subjectIds: [], weekdays: [] };
};

const coursesOf = (timetables: ScheduleTimetable[], programId?: string) =>
    [...new Set(timetables.filter((t) => t.program.id === programId).map((t) => t.course))].sort((a, b) => a - b);

/** Senior courses (4th on) run practical classes as cycles; their option says so,
 * so they stand apart from the weekly-grid courses in the picker. */
const courseLabel = (timetables: ScheduleTimetable[], programId: string | undefined, course: number) => {
    const cycles = timetables.some((t) => t.program.id === programId && t.course === course && t.format === "cycles");
    return cycles ? `${course} курс · лекции и циклы` : `${course} курс`;
};

/** Subjects that actually appear in a timetable, whatever its format. */
const usedSubjectIds = (timetable?: ScheduleTimetable) =>
    new Set([
        ...(timetable?.entries ?? []).map((entry) => entry.subjectId),
        ...(timetable?.lectures ?? []).map((lecture) => lecture.subjectId),
        ...(timetable?.cycles ?? []).map((cycle) => cycle.subjectId),
    ]);

/** Every timetable for one program+course: several streams, and/or the same
 * course offered in different semesters, all collide here without a pick. */
const variantsOf = (timetables: ScheduleTimetable[], programId?: string, course?: number) =>
    timetables
        .filter((t) => t.program.id === programId && t.course === course)
        // Latest semester first, then streams in order ("1 поток" before "2 поток").
        .sort((a, b) => b.semester.start.localeCompare(a.semester.start) || (a.stream ?? "").localeCompare(b.stream ?? "", "ru", { numeric: true }));

/** Applies one change and keeps dependent filters valid: picking another
 * program, course, or stream/semester variant drops the group/subject picks
 * that belonged to the old one. */
export const applyFilterChange = (
    timetables: ScheduleTimetable[],
    current: ScheduleFilters,
    change: Partial<ScheduleFilters>,
): ScheduleFilters => {
    const next = { ...current, ...change };

    if (change.programId !== undefined && change.programId !== current.programId) {
        const courses = coursesOf(timetables, next.programId);
        next.course = next.course !== undefined && courses.includes(next.course) ? next.course : courses[0];
    }

    const courseChanged =
        (change.programId !== undefined && change.programId !== current.programId) ||
        (change.course !== undefined && change.course !== current.course);

    if (courseChanged) {
        const variants = variantsOf(timetables, next.programId, next.course);
        next.timetableId = variants[0]?.id;
    }

    const timetableChanged =
        courseChanged || (change.timetableId !== undefined && change.timetableId !== current.timetableId);
    if (timetableChanged) {
        next.groupId = undefined;
        next.subjectIds = [];
    }

    return next;
};

export const resolveTimetable = (timetables: ScheduleTimetable[], filters: ScheduleFilters) => {
    const variants = variantsOf(timetables, filters.programId, filters.course);
    return variants.find((t) => t.id === filters.timetableId) ?? variants[0];
};

/** Short label for a timetable when several share the same program+course:
 * the stream if it has one, then the semester so the two are never blank. */
const variantLabel = (timetable: ScheduleTimetable) =>
    [timetable.stream, timetable.semester.label].filter(Boolean).join(" — ");

export const buildOptions = (timetables: ScheduleTimetable[], filters: ScheduleFilters, timetable?: ScheduleTimetable) => {
    const programs = new Map(timetables.map((t) => [t.program.id, `${t.program.code} ${t.program.name}`]));
    const usedSubjects = usedSubjectIds(timetable);
    const variants = variantsOf(timetables, filters.programId, filters.course);

    return {
        programs: [...programs].map(([value, label]) => ({ value, label })),
        courses: coursesOf(timetables, filters.programId).map((course) => ({
            value: String(course),
            label: courseLabel(timetables, filters.programId, course),
        })),
        /** Only meaningful (and only ever rendered) when a course has more than one timetable. */
        variants: variants.length > 1 ? variants.map((t) => ({ value: t.id, label: variantLabel(t) })) : [],
        groups: (timetable?.groups ?? []).map((group) => ({ value: group, label: `Группа ${group}` })),
        subjects: (timetable?.subjects ?? []).filter((subject) => usedSubjects.has(subject.id)).map((subject) => ({ value: subject.id, label: subject.name })),
        weekdays: WEEKDAYS.map((weekday) => ({ value: weekday, label: WEEKDAY_LABEL[weekday].slice(0, 2) })),
    };
};

/* ───────────── view models for the shared schedule components ───────────── */

const slotRangeOf = (timetable: ScheduleTimetable, entry: ScheduleEntry) => {
    const start = timetable.slots.findIndex((slot) => slot.id === entry.slotId);
    const first = timetable.slots[start];
    const last = timetable.slots[Math.min(start + entry.span - 1, timetable.slots.length - 1)];
    return { first, last };
};

const startMinutes = (timetable: ScheduleTimetable, entry: ScheduleEntry) => {
    const { first } = slotRangeOf(timetable, entry);
    return toMinutes(entry.startsAt ?? first.start);
};

const timeLabel = (timetable: ScheduleTimetable, entry: ScheduleEntry) => {
    if (entry.startsAt) return `с ${padClock(entry.startsAt)}`;
    const { first, last } = slotRangeOf(timetable, entry);
    return `${first.start}–${last.end}`;
};

const toLessonView = (timetable: ScheduleTimetable, { entry, dates }: FilteredEntry): ScheduleLessonView => {
    const subject = timetable.subjects.find((item) => item.id === entry.subjectId);

    const badges: string[] = [];
    if (entry.kind === "lecture") badges.push("Лекция");
    if (entry.weeks === "numerator") badges.push("По числителю");
    if (entry.weeks === "denominator") badges.push("По знаменателю");
    if (entry.note) badges.push(entry.note);

    let meta: string | undefined;
    if (dates) {
        meta = `${dates.length} ${plural(dates.length, ["лекция", "лекции", "лекций"])}`;
    } else if (entry.hours && entry.total) {
        meta = `${entry.hours} ч × ${entry.total} ${plural(entry.total, ["занятие", "занятия", "занятий"])}`;
    } else if (entry.hours) {
        meta = `${entry.hours} ч`;
    }

    return {
        id: entry.id,
        title: subject?.name ?? entry.subjectId,
        tone: subject?.tone ?? "slate",
        time: timeLabel(timetable, entry),
        meta,
        badges,
        location: entry.room,
        dates: dates?.map(formatDayMonth).join(" · "),
    };
};

const contiguousRuns = (indexes: number[]) => {
    const sorted = [...indexes].sort((a, b) => a - b);
    const runs: number[][] = [];
    for (const index of sorted) {
        const run = runs[runs.length - 1];
        if (run && index === run[run.length - 1] + 1) run.push(index);
        else runs.push([index]);
    }
    return runs;
};

const weekdaysOf = (items: FilteredEntry[]) => [...new Set(items.map(({ entry }) => entry.weekday))].sort((a, b) => a - b);

/** When the range is short enough to list, the actual calendar dates of a weekday inside it. */
const sectionSubtitle = (timetable: ScheduleTimetable, filters: ScheduleFilters, weekday: number) => {
    const range = resolveDateRange(filters);
    if (!range) return undefined;

    const dates = datesBetween(range.from, range.to).filter(
        (day) => isoWeekday(day) === weekday && periodOn(timetable, day)?.kind === "study",
    );
    if (dates.length === 0 || dates.length > 6) return undefined;
    return dates.map(formatDayMonth).join(" · ");
};

export const buildGridSections = (
    timetable: ScheduleTimetable,
    filters: ScheduleFilters,
    items: FilteredEntry[],
    columns: ScheduleGridColumn[],
): ScheduleGridSection[] => {
    const columnIds = columns.map((column) => column.id);
    const slotRows = timetable.slots.map((slot) => ({ id: slot.id, label: `${slot.start}–${slot.end}` }));

    return weekdaysOf(items).map((weekday) => {
        const cells = new Map<string, ScheduleGridPlacement>();

        for (const item of items.filter(({ entry }) => entry.weekday === weekday)) {
            const { entry } = item;
            const indexes = entry.groupIds.map((group) => columnIds.indexOf(group)).filter((index) => index >= 0);

            // One merged cell per run of neighbouring groups; lessons landing on
            // the same cell (several stream lectures) are stacked inside it.
            for (const run of contiguousRuns(indexes)) {
                const key = `${entry.slotId}|${entry.span}|${run[0]}-${run[run.length - 1]}`;
                const cell = cells.get(key) ?? {
                    id: `${weekday}-${key}`,
                    slotId: entry.slotId,
                    slotSpan: entry.span,
                    columnIds: run.map((index) => columnIds[index]),
                    lessons: [],
                };
                cell.lessons.push(toLessonView(timetable, item));
                cells.set(key, cell);
            }
        }

        const placements = [...cells.values()];

        // A day rarely uses every period; drop the empty ones at either end so
        // the block is only as tall as the day itself.
        const rows = placements.flatMap((placement) => {
            const start = slotRows.findIndex((slot) => slot.id === placement.slotId);
            return [start, start + placement.slotSpan - 1];
        });
        const slots = slotRows.slice(Math.min(...rows), Math.max(...rows) + 1);

        return {
            id: `day-${weekday}`,
            title: WEEKDAY_LABEL[weekday],
            subtitle: sectionSubtitle(timetable, filters, weekday),
            slots,
            placements,
        };
    });
};

export const buildAgendaSections = (
    timetable: ScheduleTimetable,
    filters: ScheduleFilters,
    items: FilteredEntry[],
): ScheduleAgendaSection[] =>
    weekdaysOf(items).map((weekday) => {
        const sorted = items
            .filter(({ entry }) => entry.weekday === weekday)
            .sort((a, b) => startMinutes(timetable, a.entry) - startMinutes(timetable, b.entry));

        // Consecutive lessons with the same start label share one time marker.
        const groups: ScheduleAgendaItem[] = [];
        for (const item of sorted) {
            const time = timeLabel(timetable, item.entry);
            const lesson: ScheduleLessonView = {
                ...toLessonView(timetable, item),
                audience: filters.groupId ? undefined : `Группы ${formatGroups(item.entry.groupIds)}`,
            };

            const last = groups[groups.length - 1];
            if (last && last.time === time) last.lessons.push(lesson);
            else groups.push({ id: `${weekday}-${item.entry.id}`, time, lessons: [lesson] });
        }

        return {
            id: `day-${weekday}`,
            title: WEEKDAY_LABEL[weekday],
            subtitle: sectionSubtitle(timetable, filters, weekday),
            items: groups,
        };
    });

export const buildPeriods = (timetable: ScheduleTimetable, today: string): SchedulePeriodView[] =>
    timetable.periods.map((period) => ({
        id: period.id,
        label: period.label,
        range: formatRange(period.from, period.to),
        tone: period.kind,
        active: today >= period.from && today <= period.to,
    }));

export interface ScheduleView {
    /** Lessons on screen, i.e. entries that survived the filters. */
    count: number;
    columns: ScheduleGridColumn[];
    gridSections: ScheduleGridSection[];
    agendaSections: ScheduleAgendaSection[];
    periods: SchedulePeriodView[];
    emptyReason?: string;
    /** Set for a cycle-based (senior course) timetable instead of the grid/agenda. */
    cycles?: CycleScheduleView;
}

export const buildScheduleView = (timetable: ScheduleTimetable, filters: ScheduleFilters, today: string): ScheduleView => {
    const items = filterEntries(timetable, filters);
    const groups = filters.groupId ? [filters.groupId] : timetable.groups;
    const columns = groups.map((group) => ({ id: group, label: group }));

    return {
        count: items.length,
        columns,
        gridSections: buildGridSections(timetable, filters, items, columns),
        agendaSections: buildAgendaSections(timetable, filters, items),
        periods: buildPeriods(timetable, today),
        emptyReason: items.length === 0 ? describeEmpty(timetable, filters) : undefined,
    };
};
