import { z } from "zod";
import { ComputerClassSessionKind } from "@dvgmu/contract/fesmu/enum/v1/computer_class.enum_pb";

export { ComputerClassSessionKind };

/** What takes place in a computer class — the form's dropdown and the badges. */
export const COMPUTER_CLASS_KIND_LABEL: Record<ComputerClassSessionKind, string> = {
    [ComputerClassSessionKind.UNSPECIFIED]: "Не указано",
    [ComputerClassSessionKind.LESSON]: "Занятие",
    [ComputerClassSessionKind.TESTING]: "Тестирование",
};

export const COMPUTER_CLASS_KIND_OPTIONS = [ComputerClassSessionKind.LESSON, ComputerClassSessionKind.TESTING].map((kind) => ({
    value: kind,
    label: COMPUTER_CLASS_KIND_LABEL[kind],
}));

/** The kind as it goes into the URL (?kind=testing). */
export const COMPUTER_CLASS_KIND_SLUGS = ["lesson", "testing"] as const;
export type ComputerClassKindSlug = (typeof COMPUTER_CLASS_KIND_SLUGS)[number];
export const KIND_BY_SLUG: Record<ComputerClassKindSlug, ComputerClassSessionKind> = {
    lesson: ComputerClassSessionKind.LESSON,
    testing: ComputerClassSessionKind.TESTING,
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");

/** One slot of a computer class's timetable: a lesson or testing in a room, on a date, from–to. */
export interface ComputerClassSession {
    id: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    room: string;
    kind: ComputerClassSessionKind;
    title: string;
    groups?: string;
    note?: string;
}

/** The create/edit form. */
export const computerClassSessionSchema = z
    .object({
        date: isoDate,
        timeStart: clockTime,
        timeEnd: clockTime,
        room: z.string().trim().min(1, "Укажите кабинет"),
        // The select holds a string; the server gets the enum's number.
        kind: z.coerce
            .number<string | number>()
            .refine((kind): boolean => kind === ComputerClassSessionKind.LESSON || kind === ComputerClassSessionKind.TESTING, "Выберите: занятие или тестирование"),
        title: z.string().trim().min(1, "Укажите, что проходит в классе"),
        groups: z.string().trim(),
        note: z.string().trim(),
    })
    .refine((values) => values.timeEnd > values.timeStart, {
        path: ["timeEnd"],
        message: "Окончание должно быть позже начала",
    });

export type ComputerClassSessionFormInput = z.input<typeof computerClassSessionSchema>;
export type ComputerClassSessionForm = z.output<typeof computerClassSessionSchema>;

/** What the list is narrowed to; lives in the URL (see computer-class.url.ts). */
export interface ComputerClassFilters {
    room?: string;
    kind?: ComputerClassKindSlug;
    /** "only" — just the sessions that clash with another one in their room. */
    conflicts?: "only";
    dateFrom?: string;
    dateTo?: string;
}

export const EMPTY_COMPUTER_CLASS_FILTERS: ComputerClassFilters = {};
