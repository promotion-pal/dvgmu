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
    } finally { await vite.close(); }
});
