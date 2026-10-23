import type { ScheduleAgendaSection, ScheduleTone } from "@/shared/components/schedule";
import { COMPUTER_CLASS_KIND_LABEL, KIND_BY_SLUG } from "./computer-class.schema";
import type { ComputerClassFilters, ComputerClassSession } from "./computer-class.schema";

const WEEKDAY = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
// "rose" is kept for clashes, so a room never shares its colour.
const TONES: ScheduleTone[] = ["sky", "emerald", "violet", "amber", "teal", "indigo", "orange", "cyan", "pink", "lime"];
const CONFLICT_TONE: ScheduleTone = "rose";

/** Today in the viewer's own calendar (not UTC). */
export const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const formatDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export const formatDayTitle = (iso: string) => `${WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${formatDate(iso)}`;
export const formatTime = (session: ComputerClassSession) => `${session.timeStart}–${session.timeEnd}`;

/** Sessions that share a room with `id` at an overlapping time, by session id. */
export type ComputerClassConflicts = Map<string, ComputerClassSession[]>;

/** The server keeps overlapping sessions of a room (a lesson and testing, two
 * lessons) — they are found here and shown, for staff to fix by editing. */
export const findConflicts = (sessions: ComputerClassSession[]): ComputerClassConflicts => {
    const byRoomDay = new Map<string, ComputerClassSession[]>();
    for (const session of sessions) {
        const key = `${session.date}|${session.room}`;
        byRoomDay.set(key, [...(byRoomDay.get(key) ?? []), session]);
    }

    const conflicts: ComputerClassConflicts = new Map();
    const add = (session: ComputerClassSession, other: ComputerClassSession) =>
        conflicts.set(session.id, [...(conflicts.get(session.id) ?? []), other]);
    for (const list of byRoomDay.values()) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const [a, b] = [list[i], list[j]];
                // [start, end) intervals overlap when each starts before the other ends; HH:MM compares as text.
                if (a.timeStart < b.timeEnd && b.timeStart < a.timeEnd) {
                    add(a, b);
                    add(b, a);
                }
            }
        }
    }
    return conflicts;
};

/** "Накладка: 14:00–17:15 Занятие — 211л" — what a session clashes with. */
export const describeConflict = (others: ComputerClassSession[]) =>
    `Накладка: ${others
        .map((other) => `${formatTime(other)} ${COMPUTER_CLASS_KIND_LABEL[other.kind].toLowerCase()}${other.groups ? ` (${other.groups})` : ""}`)
        .join("; ")}`;

/** Every room gets its own colour, stable across reloads (by its place in the sorted list). */
export const roomTones = (rooms: string[]) => new Map(rooms.map((room, index) => [room, TONES[index % TONES.length]]));

export const roomsOf = (sessions: ComputerClassSession[]) =>
    [...new Set(sessions.map((session) => session.room))].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

/** `from` and `to` bound the list independently: a lone `from` is "from this
 * day on" — the page opens on everything ahead of today. */
export const filterSessions = (sessions: ComputerClassSession[], filters: ComputerClassFilters, conflicts: ComputerClassConflicts) => {
    const from = filters.dateFrom;
    const to = filters.dateTo;
    return sessions
        .filter((session) => !filters.room || session.room === filters.room)
        .filter((session) => !filters.kind || session.kind === KIND_BY_SLUG[filters.kind])
        .filter((session) => !filters.conflicts || conflicts.has(session.id))
        .filter((session) => !from || session.date >= from)
        .filter((session) => !to || session.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart) || a.room.localeCompare(b.room));
};

/** Day cards for the shared ScheduleAgenda: one card per date, sessions in time order. */
export const buildAgenda = (
    sessions: ComputerClassSession[],
    tones: Map<string, ScheduleTone>,
    conflicts: ComputerClassConflicts,
): ScheduleAgendaSection[] => {
    const byDate = new Map<string, ComputerClassSession[]>();
    for (const session of sessions) byDate.set(session.date, [...(byDate.get(session.date) ?? []), session]);

    return [...byDate.entries()].map(([date, list]) => ({
        id: date,
        title: formatDayTitle(date),
        items: list.map((session) => ({
            id: session.id,
            time: formatTime(session),
            lessons: [
                {
                    id: session.id,
                    title: session.title,
                    tone: conflicts.has(session.id) ? CONFLICT_TONE : (tones.get(session.room) ?? "slate"),
                    location: session.room,
                    audience: session.groups,
                    badges: [
                        COMPUTER_CLASS_KIND_LABEL[session.kind],
                        ...(conflicts.has(session.id) ? [describeConflict(conflicts.get(session.id) ?? [])] : []),
                        ...(session.note ? [session.note] : []),
                    ],
                },
            ],
        })),
    }));
};
