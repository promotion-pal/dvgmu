import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("Schedula resolves valid week dates and copies only public calendar filters", async () => {
    const vite = await createServer({
        root: fileURLToPath(new URL("../", import.meta.url)),
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, ws: false },
    });
    try {
        const { scheduleDate, scheduleWeek, publicScheduleParams } = await vite.ssrLoadModule("/src/widgets/schedula/schedula.utils.ts");
        assert.equal(scheduleDate("2026-02-29"), undefined);
        assert.equal(scheduleDate("2028-02-29"), "2028-02-29");
        assert.equal(scheduleDate("0000-01-01"), undefined);
        assert.deepEqual(scheduleWeek("2027-01-01"), { from: "2026-12-28", to: "2027-01-03" });

        const params = publicScheduleParams(
            "?from=2026-01-01&group=401&subject=anatomy&layout=list&teacher=private&subgroup=2&view=mine&back=private&x=unknown",
            "2026-12-28",
            "2027-01-03",
        );
        assert.deepEqual(Object.fromEntries(params), {
            from: "2026-12-28", to: "2027-01-03", group: "401", subject: "anatomy", layout: "list",
        });
    } finally {
        await vite.close();
    }
});
