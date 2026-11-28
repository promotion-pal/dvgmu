import type { ScheduleLessonView } from "@/shared/components/schedule";
import type { ScheduleFilters, ScheduleTimetable } from "./schedule.schema";
import { datesBetween, filterEntries, formatGroups, isoWeekday, offsetDate, resolveDateRange, slotRangeOf, toLessonView } from "./schedule.utils";

export const CALENDAR_MODES = ["day", "week", "term", "range"] as const;
export type CalendarMode = typeof CALENDAR_MODES[number];

type DateRange = { from: string; to: string };

export const semesterDate = (date: string, semester: ScheduleTimetable["semester"]) =>
    date < semester.start ? semester.start : date > semester.end ? semester.end : date;

export const calendarPeriod = (mode: CalendarMode, date: string, semester: ScheduleTimetable["semester"], filters: ScheduleFilters): DateRange => {
    if (mode === "range") return resolveDateRange(filters) ?? { from: date, to: date };
    if (mode === "term") return { from: semester.start, to: semester.end };
    if (mode === "day") return { from: date, to: date };

    const monday = offsetDate(date, 1 - isoWeekday(date));
    return { from: semesterDate(monday, semester), to: semesterDate(offsetDate(monday, 6), semester) };
};

export interface CalendarLesson extends ScheduleLessonView {
    seriesId: string;
    from: string;
    to: string;
    start?: string;
    end?: string;
    kind: "lecture" | "practice" | "cycle";
}

const clock = (time: string) => time.padStart(5, "0");

export const calendarLessons = (timetable: ScheduleTimetable, filters: ScheduleFilters, period: DateRange): CalendarLesson[] => {
    const audience = (groups: string[]) => {
        const label = formatGroups(groups);
        return label ? `Группы ${label}` : undefined;
    };
    const includesGroup = (groups: string[]) => !filters.groupId || groups.length === 0 || groups.includes(filters.groupId);
    const includesSubject = (id: string) => filters.subjectIds.length === 0 || filters.subjectIds.includes(id);
    const subjects = new Map(timetable.subjects.map((subject) => [subject.id, subject]));
    const subject = (id: string) => ({ title: subjects.get(id)?.name ?? id, tone: subjects.get(id)?.tone ?? "slate" as const });

    const lessons: CalendarLesson[] = timetable.format === "weekly"
        ? filterEntries(timetable, { ...filters, dateFrom: period.from, dateTo: period.to }).flatMap(({ entry, dates }) => {
            const { first, last } = slotRangeOf(timetable, entry);
            if (!first) return [];

            const lesson = toLessonView(timetable, { entry });
            return (dates ?? []).map((date) => ({
                ...lesson,
                seriesId: `weekly:${entry.id}`,
                id: `weekly:${entry.id}:${date}`,
                from: date,
                to: date,
                start: clock(entry.startsAt ?? first.start),
                end: clock(last.end),
                kind: entry.kind,
                audience: audience(entry.groupIds),
                badges: [entry.kind === "lecture" ? "Лекция" : "Практическое занятие", ...(lesson.badges ?? []).filter((badge) => badge !== "Лекция")],
            }));
        })
        : [
            ...timetable.lectures
                .filter((lecture) => includesGroup(lecture.groupIds) && includesSubject(lecture.subjectId))
                .flatMap((lecture) => [...new Set(lecture.dates)]
                    .filter((date) => date >= period.from && date <= period.to)
                    .map((date) => ({
                        ...subject(lecture.subjectId),
                        seriesId: `lecture:${lecture.id}`,
                        id: `lecture:${lecture.id}:${date}`,
                        from: date,
                        to: date,
                        start: clock(lecture.start),
                        end: clock(lecture.end),
                        kind: "lecture" as const,
                        time: `${clock(lecture.start)}–${clock(lecture.end)}`,
                        location: lecture.room,
                        audience: audience(lecture.groupIds),
                        badges: ["Лекция", ...(lecture.remote ? ["С применением ДОТ"] : []), ...(lecture.note ? [lecture.note] : [])],
                    }))),
            ...timetable.cycles
                .filter((cycle) => includesGroup(cycle.groupIds) && includesSubject(cycle.subjectId))
                .filter((cycle) => cycle.from <= period.to && cycle.to >= period.from)
                .map((cycle) => ({
                    ...subject(cycle.subjectId),
                    seriesId: `cycle:${cycle.id}`,
                    id: `cycle:${cycle.id}`,
                    from: cycle.from,
                    to: cycle.to,
                    kind: "cycle" as const,
                    audience: audience(cycle.groupIds),
                    badges: cycle.note ? ["Учебный цикл", cycle.note] : ["Учебный цикл"],
                })),
        ];

    return lessons.sort((a, b) => a.from.localeCompare(b.from) || (a.start ?? "").localeCompare(b.start ?? ""));
};

export const calendarDays = ({ from, to }: DateRange) => datesBetween(from, to);
