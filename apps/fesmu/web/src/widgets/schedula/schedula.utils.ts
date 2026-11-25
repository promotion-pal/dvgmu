import { ChangeType, EventStatus, EventType, PeriodType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";

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
