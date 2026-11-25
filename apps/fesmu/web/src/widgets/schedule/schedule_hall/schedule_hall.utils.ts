import { HALL_DAY_END, HALL_DAY_START, HALL_MIN_SLOT_MINUTES } from "./schedule_hall.schema";
import type { Hall, HallEvent, HallScheduleFilters } from "./schedule_hall.schema";

/* Pure helpers for the month grid: dates are ISO `YYYY-MM-DD` strings handled in
 * UTC so the viewer's timezone can never shift a booking to the neighbouring day. */

export const WEEKDAY_HEADERS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const MONTH_LABEL = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const MS_PER_DAY = 86_400_000;

const toIso = (date: Date) => date.toISOString().slice(0, 10);
const isoWeekday = (date: Date) => ((date.getUTCDay() + 6) % 7) + 1; // Mon = 1 ... Sun = 7

/** Today in the viewer's own calendar (not UTC): in Khabarovsk, UTC is still
 * "yesterday" until 10 a.m. */
export const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** The first day of `iso`'s calendar month, at UTC midnight. */
export interface MonthCursor {
    year: number;
    month: number; // 0-based, matches Date's convention
}

export const monthCursorOf = (iso: string): MonthCursor => ({
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)) - 1,
});

export const monthCursorToIso = ({ year, month }: MonthCursor) =>
    `${year.toString().padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`;

export const shiftMonth = (cursor: MonthCursor, delta: number): MonthCursor => {
    const date = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
};

export const formatMonthTitle = ({ year, month }: MonthCursor) => `${MONTH_LABEL[month]} ${year}`;

/** A day heading for the compact monthly hall agenda. */
export const formatHallDay = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
};

export interface HallCalendarEvent {
    id: string;
    timeStart: string;
    timeEnd: string;
    title: string;
    organizer?: string;
    contact?: string;
    hallName: string;
    tone: Hall["tone"];
}

export interface HallCalendarDay {
    iso: string;
    day: number;
    inCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    events: HallCalendarEvent[];
}

export interface HallCalendarWeek {
    id: string;
    days: HallCalendarDay[];
}

/** Builds only as many weeks as the month needs (5 or 6), Monday-first, with the
 * leading/trailing days of the neighbouring months filled in — same layout as
 * the source calendar. */
export const buildMonthWeeks = (
    cursor: MonthCursor,
    events: HallEvent[],
    halls: Hall[],
    filters: HallScheduleFilters,
    today: string,
): HallCalendarWeek[] => {
    const hallById = new Map(halls.map((hall) => [hall.id, hall]));

    const eventsByDate = new Map<string, HallCalendarEvent[]>();
    for (const event of events) {
        if (filters.hallId && event.hallId !== filters.hallId) continue;
        const hall = hallById.get(event.hallId);
        if (!hall) continue;

        const list = eventsByDate.get(event.date) ?? [];
        list.push({
            id: event.id,
            timeStart: event.timeStart,
            timeEnd: event.timeEnd,
            title: event.title,
            organizer: event.organizer,
            contact: event.contact,
            hallName: hall.name,
            tone: hall.tone,
        });
        eventsByDate.set(event.date, list);
    }
    for (const list of eventsByDate.values()) list.sort((a, b) => a.timeStart.localeCompare(b.timeStart));

    const firstOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const lastOfMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0));

    const gridStart = new Date(firstOfMonth);
    gridStart.setUTCDate(gridStart.getUTCDate() - (isoWeekday(firstOfMonth) - 1));

    const gridEnd = new Date(lastOfMonth);
    gridEnd.setUTCDate(gridEnd.getUTCDate() + (7 - isoWeekday(lastOfMonth)));

    const weeks: HallCalendarWeek[] = [];
    for (let time = gridStart.getTime(); time <= gridEnd.getTime(); time += 7 * MS_PER_DAY) {
        const days: HallCalendarDay[] = [];
        for (let offset = 0; offset < 7; offset++) {
            const date = new Date(time + offset * MS_PER_DAY);
            const iso = toIso(date);
            days.push({
                iso,
                day: date.getUTCDate(),
                inCurrentMonth: date.getUTCMonth() === cursor.month,
                isToday: iso === today,
                isWeekend: isoWeekday(date) >= 6,
                events: eventsByDate.get(iso) ?? [],
            });
        }
        weeks.push({ id: toIso(new Date(time)), days });
    }

    return weeks;
};

export const buildHallOptions = (halls: Hall[]) => halls.map((hall) => ({ value: hall.id, label: hall.name }));

/* Occupancy of one hall on one day: which intervals are taken and which are
 * still free inside the working day. HH:MM strings compare in time order. */

const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

export interface HallInterval {
    start: string;
    end: string;
}

/** The hall's bookings on `date`, earliest first. */
export const bookingsOn = (events: HallEvent[], hallId: string, date: string) =>
    events
        .filter((event) => event.hallId === hallId && event.date === date)
        .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

/** Gaps of at least HALL_MIN_SLOT_MINUTES between the day's bookings. */
export const freeIntervals = (dayBookings: HallEvent[]): HallInterval[] => {
    const free: HallInterval[] = [];
    let cursor = HALL_DAY_START;

    const pushGap = (end: string) => {
        if (toMinutes(end) - toMinutes(cursor) >= HALL_MIN_SLOT_MINUTES) free.push({ start: cursor, end });
    };

    for (const booking of dayBookings) {
        if (booking.timeStart > cursor) pushGap(booking.timeStart < HALL_DAY_END ? booking.timeStart : HALL_DAY_END);
        if (booking.timeEnd > cursor) cursor = booking.timeEnd;
    }
    if (cursor < HALL_DAY_END) pushGap(HALL_DAY_END);

    return free;
};

export type HallDayLoad = "free" | "partial" | "full";

export const dayLoad = (dayBookings: HallEvent[]): HallDayLoad => {
    if (dayBookings.length === 0) return "free";
    return freeIntervals(dayBookings).length === 0 ? "full" : "partial";
};

export const formatInterval = ({ start, end }: HallInterval) => `${start}–${end}`;

/** "понедельник, 28 сентября" for an ISO date, independent of the viewer's timezone. */
export const formatLongDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
    });

/** A local-midnight Date for the day picker ↔ ISO date, both in the viewer's calendar. */
export const isoToLocalDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const localDateToIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
