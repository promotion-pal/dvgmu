import { z } from "zod";
import { scheduleToneSchema } from "../schedule.schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");

/** The hall's working day — a booking must fit inside it. Mirrors
 * HallDayStart/HallDayEnd in api/internal/domain/models/hall.models.go. */
export const HALL_DAY_START = "08:00";
export const HALL_DAY_END = "20:00";
/** The shortest free window worth offering for a booking, in minutes. */
export const HALL_MIN_SLOT_MINUTES = 30;

/** A bookable lecture hall / auditorium. */
export const hallSchema = z.object({
    id: z.string(),
    /** Short label as it appears on the room plate, e.g. "238" or "Акт. зал". */
    name: z.string(),
    building: z.string(),
    tone: scheduleToneSchema,
});

/** One booking on the hall's calendar: a lecture, a meeting, a record slot —
 * what holds the room from `timeStart` to `timeEnd`. `organizer`/`contact` come
 * only from the staff endpoint; the public one leaves them empty. */
export const hallEventSchema = z.object({
    id: z.string(),
    hallId: z.string(),
    date: isoDate,
    timeStart: clockTime,
    timeEnd: clockTime,
    title: z.string(),
    organizer: z.string().optional(),
    contact: z.string().optional(),
});

export type HallTone = z.infer<typeof scheduleToneSchema>;
export type Hall = z.infer<typeof hallSchema>;
export type HallEvent = z.infer<typeof hallEventSchema>;

/** The "book a hall" form — the same on the public page and in the admin. */
export const hallBookingSchema = z
    .object({
        hallId: z.string({ error: "Выберите зал" }).min(1, "Выберите зал"),
        date: isoDate,
        timeStart: clockTime,
        timeEnd: clockTime,
        title: z.string().trim().min(1, "Укажите, что проходит в зале"),
        organizer: z.string().trim().min(1, "Укажите, кто бронирует зал"),
        contact: z.string().trim().min(1, "Укажите телефон или e-mail для связи"),
        consent: z.boolean().refine((value) => value, "Нужно согласие на обработку персональных данных"),
    })
    .refine((values) => values.timeEnd > values.timeStart, {
        path: ["timeEnd"],
        message: "Окончание должно быть позже начала",
    })
    .refine((values) => values.timeStart >= HALL_DAY_START && values.timeEnd <= HALL_DAY_END, {
        path: ["timeStart"],
        message: `Зал можно забронировать с ${HALL_DAY_START} до ${HALL_DAY_END}`,
    });

export type HallBookingSchema = z.infer<typeof hallBookingSchema>;

export const hallScheduleFilterSchema = z.object({
    hallId: z.string().optional(),
});

export type HallScheduleFilters = z.infer<typeof hallScheduleFilterSchema>;

export const EMPTY_HALL_SCHEDULE_FILTERS: HallScheduleFilters = {};
