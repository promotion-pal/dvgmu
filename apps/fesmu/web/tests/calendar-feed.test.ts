import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("calendar subscription preserves identity, scopes groups and reflects moves and cancellations", async (t) => {
    const vite = await createServer({ cacheDir: "node_modules/.vite-calendar-feed-test", server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true } });
    try {
        const { serveCalendar } = await vite.ssrLoadModule("/server/calendar-feed.ts");
        let upstream: object = {};
        const requests: string[] = [];
        t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
            requests.push(url + ":" + new TextDecoder().decode(options.body as Uint8Array));
            return Response.json(upstream);
        });
        async function read(scope: string) {
            const result = { status: 0, body: "", headers: {} };
            await serveCalendar({ method: "GET", url: scope.startsWith("/") ? scope : "/calendar/" + scope + "/schedule.ics" }, {
                writeHead(status: number, headers = {}) {
                    Object.assign(result, { status, headers });
                    return this;
                },
                end(body = "") { result.body = body; },
            }, "https://example.test");
            return result;
        }
        const event = { id: "evt", date: "2026-11-24", subject: { name: "Анатомия, практика" }, startMinute: 600, durationMinutes: 90 };
        upstream = { events: [event] };
        const first = await read("group/401");
        assert.equal(first.status, 200);
        assert.match(first.body, /DTSTART:20261124T000000Z/);
        assert.match(first.body, /Анатомия\\, практика/);
        assert.match(requests[0], /PublicScheduleFetch.*"group":"401"/);
        upstream = { events: [{ ...event, date: "2026-11-25", status: "EVENT_STATUS_CANCELLED" }] };
        const changed = await read("group/401");
        assert.match(changed.body, /STATUS:CANCELLED/);
        assert.equal(changed.body.match(/UID:.+/)?.[0], first.body.match(/UID:.+/)?.[0]);
        assert.doesNotMatch(changed.body, /DTSTART:20261124/);

        const item = { updatedAt: "2026-11-21T12:00:00Z", id: "one", title: "Расписание", course: 1, groups: ["401", "402"],
            semester: { start: "2026-11-01", end: "2026-11-30" }, format: "SCHEDULE_FORMAT_CYCLES",
            lectures: [{ id: "lab", subjectId: "biology", dates: ["2026-11-24", "2026-11-26"], start: "10:00", end: "11:30", groupIds: ["401"] }],
            cycles: [{ id: "other", subjectId: "chemistry", groupIds: ["402"], from: "2026-11-01", to: "2026-11-05" }],
        };
        upstream = { item };
        const group = await read("timetable/one/group/401");
        assert.equal(group.status, 200);
        assert.equal((await read("/calendar/schedule.ics?timetable=one&group=401")).body, group.body);
        assert.match(group.body, /DTSTART:20261126T000000Z/);
        assert.equal(group.body.match(/BEGIN:VEVENT/g)?.length, 2);
        assert.equal(new Set(group.body.match(/^UID:.+/gm)).size, 2);
        assert.doesNotMatch(group.body, /chemistry/);
        item.lectures[0].dates = ["2026-11-25", "2026-11-26"];
        const moved = await read("timetable/one/group/401");
        assert.equal(group.body.match(/UID:.+/)?.[0], moved.body.match(/UID:.+/)?.[0]);
        assert.doesNotMatch(moved.body, /20261124/);
        assert.equal((await read("timetable/one/group/999")).status, 404);
        assert.match((await read("timetable/one")).body, /DTEND;VALUE=DATE:20261106/);
    } finally { await vite.close(); }
});
