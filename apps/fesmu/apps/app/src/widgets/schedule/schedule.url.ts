import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import { EMPTY_SCHEDULE_FILTERS } from "./schedule.schema";
import type { ScheduleFilters, ScheduleTimetable } from "./schedule.schema";
import { defaultFilters } from "./schedule.utils";

/* The schedule filters as query parameters, so a link like
 *   /schedule?program=31.05.01&course=4&group=401
 * opens straight on that group's timetable — e.g. from an announcement.
 * Only this file knows about the URL; the filter UI and the view logic work
 * with plain ScheduleFilters. */

const SCHEDULE_URL_SCHEMA: UrlStateSchema<ScheduleFilters> = {
    programId: { key: "program", codec: urlCodec.text },
    course: { key: "course", codec: urlCodec.integer },
    timetableId: { key: "timetable", codec: urlCodec.text },
    groupId: { key: "group", codec: urlCodec.text },
    subjectIds: { key: "subjects", codec: urlCodec.list(urlCodec.text) },
    weekdays: { key: "days", codec: urlCodec.list(urlCodec.integer) },
    dateFrom: { key: "from", codec: urlCodec.isoDate },
    dateTo: { key: "to", codec: urlCodec.isoDate },
};

/** The page's filters, read from and written to the query string. */
export const useScheduleUrlFilters = () => useUrlState(SCHEDULE_URL_SCHEMA, EMPTY_SCHEDULE_FILTERS);

const latestFirst = (a: ScheduleTimetable, b: ScheduleTimetable) =>
    b.semester.start.localeCompare(a.semester.start) || (a.stream ?? "").localeCompare(b.stream ?? "", "ru", { numeric: true });

const subjectsUsedIn = (timetable: ScheduleTimetable) =>
    new Set([
        ...timetable.entries.map((entry) => entry.subjectId),
        ...timetable.lectures.map((lecture) => lecture.subjectId),
        ...timetable.cycles.map((cycle) => cycle.subjectId),
    ]);

/**
 * Turns whatever a link asked for into filters that point at a real
 * timetable: unknown or stale values are dropped, missing ones filled in.
 * A group alone is enough — `?group=401&program=31.05.01` finds the stream
 * that group is in, so an announcement doesn't need to know timetable ids.
 */
export const resolveLinkedFilters = (timetables: ScheduleTimetable[], asked: ScheduleFilters): ScheduleFilters => {
    const sorted = [...timetables].sort(latestFirst);
    const hasGroup = (t: ScheduleTimetable) => !asked.groupId || t.groups.includes(asked.groupId);

    const candidates = sorted.filter(
        (t) =>
            (!asked.programId || t.program.id === asked.programId) &&
            (asked.course === undefined || t.course === asked.course),
    );
    const timetable =
        candidates.find((t) => t.id === asked.timetableId) ??
        candidates.find(hasGroup) ??
        (asked.programId ? sorted.find((t) => t.program.id === asked.programId) : undefined);

    if (!timetable) return defaultFilters(timetables);

    const subjects = subjectsUsedIn(timetable);
    return {
        programId: timetable.program.id,
        course: timetable.course,
        timetableId: timetable.id,
        groupId: asked.groupId && timetable.groups.includes(asked.groupId) ? asked.groupId : undefined,
        subjectIds: asked.subjectIds.filter((id) => subjects.has(id)),
        weekdays: asked.weekdays.filter((day) => day >= 1 && day <= 7),
        dateFrom: asked.dateFrom,
        dateTo: asked.dateTo,
    };
};
