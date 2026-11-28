import { ChangeType, EventStatus, EventType, PeriodType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import type { Event, PublicEvent } from "@fesmu/contract/schedula/entity/schedule.entity_pb";

export const eventTypes = {
    [EventType.UNSPECIFIED]: "Событие",
    [EventType.LECTURE]: "Лекция",
    [EventType.CLASS]: "Практическое занятие",
    [EventType.LAB]: "Лабораторное занятие",
    [EventType.CLINICAL_CYCLE]: "Клинический цикл",
    [EventType.EXAM]: "Экзамен",
    [EventType.CONSULTATION]: "Консультация",
    [EventType.RETAKE]: "Пересдача",
    [EventType.MAKEUP]: "Отработка",
    [EventType.GIA]: "Этап ГИА",
    [EventType.PRACTICE]: "День практики",
    [EventType.COMPUTER_CLASS_TEST]: "Тестирование",
};

export const periodTypes = {
    [PeriodType.UNSPECIFIED]: "Учебный период",
    [PeriodType.CLASSES]: "Занятия",
    [PeriodType.EXAMS]: "Сессия",
    [PeriodType.PRACTICE]: "Практика",
    [PeriodType.HOLIDAYS]: "Каникулы",
};

export const eventStatuses = {
    [EventStatus.UNSPECIFIED]: "",
    [EventStatus.DRAFT]: "Черновик",
    [EventStatus.PUBLISHED]: "",
    [EventStatus.CANCELLED]: "Отменено",
    [EventStatus.TRANSFER]: "К переносу",
};

export const changeTypes = {
    [ChangeType.UNSPECIFIED]: "",
    [ChangeType.MOVE]: "Перенос",
    [ChangeType.INSTRUCTOR]: "Замена преподавателя",
    [ChangeType.ROOM]: "Замена площадки",
    [ChangeType.CANCEL]: "Отмена",
};

export const timeLabel = (minute: number) =>
    [Math.floor(minute / 60), minute % 60].map((part) => String(part).padStart(2, "0")).join(":");

export const readTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

export const eventTime = (minute?: number, duration = 0) =>
    minute === undefined ? "Время не назначено" : `${timeLabel(minute)}–${timeLabel(minute + duration)}`;

export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Vladivostok" }).format();

export const addDays = (isoDate: string, days: number) => {
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

export const dateLabel = (isoDate: string) => isoDate ? new Intl.DateTimeFormat("ru-RU", {
    weekday: "short", month: "long", day: "numeric", timeZone: "UTC",
}).format(new Date(`${isoDate}T12:00:00Z`)) : "Дата не назначена";

export function scheduleDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return undefined;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function scheduleWeek(date: string) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const from = addDays(date, -((day + 6) % 7));
    return { from, to: addDays(from, 6) };
}

const PUBLIC_FILTERS = ["group", "course", "subject", "site", "room", "type", "sources", "layout"];

export function publicScheduleParams(search: string, from: string, to: string) {
    const current = new URLSearchParams(search);
    const params = new URLSearchParams({ from, to });
    for (const key of PUBLIC_FILTERS) {
        const value = current.get(key);
        if (value) params.set(key, value);
    }
    return params;
}

export function eventFields(event: Event | PublicEvent) {
    if (event.$typeName === "contract.schedula.entity.PublicEvent") {
        return {
            date: event.date,
            start: event.startMinute,
            duration: event.durationMinutes,
            kind: event.type,
            location: [event.room, event.site, event.address].filter(Boolean).join(" · "),
            groups: event.groups.map((group) => ({ group, subgroup: "", course: 0 })),
            point: "",
            instructor: "",
        };
    }
    return {
        date: event.details?.date ?? "",
        start: event.details?.startMinute,
        duration: event.details?.durationMinutes,
        kind: event.details?.type ?? EventType.UNSPECIFIED,
        location: [event.room?.name, event.room?.site?.name, event.room?.site?.address].filter(Boolean).join(" · "),
        groups: event.details?.audiences ?? [],
        point: event.details?.meetingPoint || event.room?.site?.meetingPoint,
        instructor: [event.instructorName, event.details?.department].filter(Boolean).join(" · "),
    };
}
