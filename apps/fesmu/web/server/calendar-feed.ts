import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ScheduleService } from "@fesmu/contract/fesmu/service/v1/schedule.service_pb";
import { SchedulaService } from "@fesmu/contract/schedula/service/schedula.service_pb";
import { EventStatus } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { calendarLessons } from "../src/widgets/schedule/schedule.calendar.utils";
import { fromMessage } from "../src/widgets/schedule/schedule.message";
import { offsetDate, todayIso } from "../src/widgets/schedule/schedule.utils";

type FeedEvent = { id: string; name: string; location?: string; start: string; end: string; cancelled?: boolean; allDay?: boolean };

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");

// RFC 5545 counts octets, including the continuation space.
function fold(line: string) {
    let result = "", length = 0;
    for (const character of line) {
        const size = Buffer.byteLength(character);
        if (length + size > 75) {
            result += "\r\n ";
            length = 1;
        }
        result += character;
        length += size;
    }
    return result;
}

export function renderFeed(name: string, events: FeedEvent[], modified: Date) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FESMU//Schedule//RU", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + text(name)];
    for (const event of events) {
        const uid = createHash("sha256").update(event.id).digest("hex") + "@schedule.fesmu.ru";
        const suffix = event.allDay ? ";VALUE=DATE:" : ":";
        lines.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp(modified), "DTSTART" + suffix + event.start,
            "DTEND" + suffix + event.end, "SUMMARY:" + text(event.name));
        if (event.location) lines.push("LOCATION:" + text(event.location));
        if (event.cancelled) lines.push("STATUS:CANCELLED");
        lines.push("END:VEVENT");
    }
    return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}

const localTime = (date: string, clock: string) => stamp(new Date(date + "T" + clock + ":00+10:00"));

export async function serveCalendar(req: IncomingMessage, res: ServerResponse, api: string) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        res.writeHead(405).end();
        return;
    }
    const url = new URL(req.url!, "http://localhost");
    const scope = /^\/calendar(?:\/timetable\/([^/]+))?(?:\/group\/([^/]+))?\/schedule\.ics$/.exec(url.pathname);
    if (!scope) { res.writeHead(404).end(); return; }
    let timetableId: string | undefined, group: string | undefined;
    try {
        timetableId = scope[1] && decodeURIComponent(scope[1]);
        group = scope[2] && decodeURIComponent(scope[2]);
        if (url.pathname === "/calendar/schedule.ics") {
            timetableId = url.searchParams.get("timetable") || undefined;
            group = url.searchParams.get("group") || undefined;
        }
    } catch {
        res.writeHead(400).end();
        return;
    }
    if (!timetableId && !group) { res.writeHead(400).end(); return; }
    const transport = createConnectTransport({ baseUrl: api, defaultTimeoutMs: 15000 });
    let events: FeedEvent[], name: string, modified = new Date();
    try {
        if (timetableId) {
            const { item } = await createClient(ScheduleService, transport).scheduleByID({ id: timetableId });
            if (!item || (group && !item.groups.includes(group))) { res.writeHead(404).end(); return; }
            const timetable = fromMessage(item);
            name = group ? timetable.title + " · " + group : timetable.title;
            if (item.updatedAt) modified = new Date(Number(item.updatedAt.seconds) * 1000);
            const lessons = calendarLessons(timetable, { groupId: group, weekdays: [], subjectIds: [] },
                { from: timetable.semester.start, to: timetable.semester.end });
            // Explicit events keep every lesson visible in clients that skip RDATE-only series.
            const seen = new Set<string>();
            events = lessons.map(lesson => {
                // Preserve the original master UID for the first occurrence of each series.
                const key = seen.has(lesson.seriesId) ? lesson.id : lesson.seriesId;
                seen.add(lesson.seriesId);
                return {
                    id: JSON.stringify([timetableId, key]), name: lesson.title, location: lesson.location,
                    allDay: !lesson.start,
                    start: lesson.start ? localTime(lesson.from, lesson.start) : lesson.from.replaceAll("-", ""),
                    end: lesson.end ? localTime(lesson.to, lesson.end) : offsetDate(lesson.to, 1).replaceAll("-", ""),
                };
            });
        } else {
            const today = todayIso();
            const { events: published } = await createClient(SchedulaService, transport).publicScheduleFetch({
                filter: { group, dateFrom: offsetDate(today, -30), dateTo: offsetDate(today, 335) },
            });
            name = "Расписание ДВГМУ · " + group;
            events = published.map(event => {
                const midnight = Date.parse(event.date + "T00:00:00+10:00");
                const start = midnight + event.startMinute * 60000;
                return { id: "schedula:" + event.id, name: event.subject?.name || "Занятие", start: stamp(new Date(start)),
                    end: stamp(new Date(start + event.durationMinutes * 60000)), location: [event.site, event.room, event.address].filter(Boolean).join(", "),
                    cancelled: event.status === EventStatus.CANCELLED };
            });
        }
        const body = renderFeed(name, events, modified);
        res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Calendar-Events": String(events.length) });
        res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
        const code = ConnectError.from(error).code;
        res.writeHead(code === Code.NotFound ? 404 : code === Code.InvalidArgument ? 400 : 502).end();
    }
}
