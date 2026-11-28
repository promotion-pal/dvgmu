import { ScheduleEntryKind, ScheduleFormat, SchedulePeriodKind, ScheduleWeeks } from "@fesmu/contract/fesmu/enum/v1/schedule.enum_pb";
import type { ScheduleTimetable as ScheduleTimetableMessage } from "@fesmu/contract/fesmu/entity/v1/schedule.entity_pb";
import { scheduleTimetableSchema, scheduleToneSchema } from "./schedule.schema";
import type { ScheduleEntry, SchedulePeriod, ScheduleTimetable } from "./schedule.schema";
const KIND_TO_MESSAGE = {
    lecture: ScheduleEntryKind.LECTURE,
    practice: ScheduleEntryKind.PRACTICE,
} as const;
const WEEKS_TO_MESSAGE = {
    every: ScheduleWeeks.EVERY,
    numerator: ScheduleWeeks.NUMERATOR,
    denominator: ScheduleWeeks.DENOMINATOR,
} as const;
const PERIOD_TO_MESSAGE = {
    study: SchedulePeriodKind.STUDY,
    practice: SchedulePeriodKind.PRACTICE,
    session: SchedulePeriodKind.SESSION,
    holiday: SchedulePeriodKind.HOLIDAY,
} as const;

const invert = <K extends string, V extends number>(map: Record<K, V>) =>
    Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])) as Record<V, K>;

const FORMAT_TO_MESSAGE = {
    weekly: ScheduleFormat.WEEKLY,
    cycles: ScheduleFormat.CYCLES,
} as const;

const KIND_FROM_MESSAGE = invert(KIND_TO_MESSAGE);
const WEEKS_FROM_MESSAGE = invert(WEEKS_TO_MESSAGE);
const PERIOD_FROM_MESSAGE = invert(PERIOD_TO_MESSAGE);

/** The contract's zero values ("unset") become the model's absent optionals. */
const orUndefined = <T>(value: T, unset: T) => (value === unset ? undefined : value);

/** Contract message -> the timetable the widget works with. Parsing through the
 * schema means a malformed document fails here, not deep in the rendering. */
export const fromMessage = (message: ScheduleTimetableMessage): ScheduleTimetable =>
    scheduleTimetableSchema.parse({
        id: message.id,
        title: message.title,
        faculty: message.faculty,
        program: { id: message.program?.id ?? "", code: message.program?.code ?? "", name: message.program?.name ?? "" },
        course: message.course,
        stream: orUndefined(message.stream, ""),
        semester: {
            label: message.semester?.label ?? "",
            start: message.semester?.start ?? "",
            end: message.semester?.end ?? "",
        },
        groups: message.groups,
        format: message.format === ScheduleFormat.CYCLES ? "cycles" : "weekly",
        slots: message.slots.map(({ id, start, end }) => ({ id, start, end })),
        subjects: message.subjects.map((subject, index) => ({
            id: subject.id,
            name: subject.name,
            tone: scheduleToneSchema.safeParse(subject.tone).data ?? scheduleToneSchema.options[index % scheduleToneSchema.options.length],
        })),
        entries: message.entries.map(
            (entry): ScheduleEntry => ({
                id: entry.id,
                weekday: entry.weekday,
                slotId: entry.slotId,
                span: Math.max(entry.span, 1),
                groupIds: entry.groupIds,
                subjectId: entry.subjectId,
                kind: KIND_FROM_MESSAGE[entry.kind as keyof typeof KIND_FROM_MESSAGE] ?? "practice",
                startsAt: orUndefined(entry.startsAt, ""),
                hours: orUndefined(entry.hours, 0),
                total: orUndefined(entry.total, 0),
                weeks: WEEKS_FROM_MESSAGE[entry.weeks as keyof typeof WEEKS_FROM_MESSAGE] ?? "every",
                dates: entry.dates.length > 0 ? entry.dates : undefined,
                room: orUndefined(entry.room, ""),
                note: orUndefined(entry.note, ""),
            }),
        ),
        lectures: message.lectures.map((lecture) => ({
            id: lecture.id,
            subjectId: lecture.subjectId,
            start: lecture.start,
            end: lecture.end,
            dates: lecture.dates,
            room: orUndefined(lecture.room, ""),
            remote: lecture.remote,
            groupIds: lecture.groupIds,
            note: orUndefined(lecture.note, ""),
        })),
        cycles: message.cycles.map((cycle) => ({
            id: cycle.id,
            subjectId: cycle.subjectId,
            groupIds: cycle.groupIds,
            from: cycle.from,
            to: cycle.to,
            note: orUndefined(cycle.note, ""),
        })),
        periods: message.periods.map(
            (period): SchedulePeriod => ({
                id: period.id,
                kind: PERIOD_FROM_MESSAGE[period.kind as keyof typeof PERIOD_FROM_MESSAGE] ?? "study",
                label: period.label,
                from: period.from,
                to: period.to,
            }),
        ),
        exams: message.exams,
        credits: message.credits,
        note: orUndefined(message.note, ""),
        approvedBy: orUndefined(message.approvedBy, ""),
        approvedOn: orUndefined(message.approvedOn, ""),
        agreedBy: message.agreedBy,
    });

/** The timetable -> a contract message (as a plain init object the client accepts). */
export const toMessage = (timetable: ScheduleTimetable) => ({
    id: timetable.id,
    title: timetable.title,
    faculty: timetable.faculty,
    program: timetable.program,
    course: timetable.course,
    stream: timetable.stream ?? "",
    semester: timetable.semester,
    groups: timetable.groups,
    format: FORMAT_TO_MESSAGE[timetable.format],
    slots: timetable.slots,
    subjects: timetable.subjects,
    entries: timetable.entries.map((entry) => ({
        id: entry.id,
        weekday: entry.weekday,
        slotId: entry.slotId,
        span: entry.span,
        groupIds: entry.groupIds,
        subjectId: entry.subjectId,
        kind: KIND_TO_MESSAGE[entry.kind],
        startsAt: entry.startsAt ?? "",
        hours: entry.hours ?? 0,
        total: entry.total ?? 0,
        weeks: WEEKS_TO_MESSAGE[entry.weeks],
        dates: entry.dates ?? [],
        room: entry.room ?? "",
        note: entry.note ?? "",
    })),
    lectures: timetable.lectures.map((lecture) => ({ ...lecture, room: lecture.room ?? "", note: lecture.note ?? "" })),
    cycles: timetable.cycles.map((cycle) => ({ ...cycle, note: cycle.note ?? "" })),
    periods: timetable.periods.map((period) => ({ ...period, kind: PERIOD_TO_MESSAGE[period.kind] })),
    exams: timetable.exams,
    credits: timetable.credits,
    note: timetable.note ?? "",
    approvedBy: timetable.approvedBy ?? "",
    approvedOn: timetable.approvedOn ?? "",
    agreedBy: timetable.agreedBy,
});
