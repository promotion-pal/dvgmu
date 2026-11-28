import { createHash } from "node:crypto";

type FeedEvent = { id: string; name: string; location?: string; start: string; end: string; cancelled?: boolean; allDay?: boolean };

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");

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
    return [...lines, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
