import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { ScheduleTimetable } from "../src/widgets/schedule/schedule.schema";

test("calendar dates honour parity, semester bounds and explicit lesson dates", async () => {
    const vite = await createServer({
        root: fileURLToPath(new URL("../", import.meta.url)),
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, ws: false },
    });
    try {
        const { emptyTimetable, validateTimetable } = await vite.ssrLoadModule("/src/widgets/schedule/schedule.editor.utils.ts");
        const { buildScheduleView } = await vite.ssrLoadModule("/src/widgets/schedule/schedule.utils.ts");
        const { calendarLessons, calendarPeriod } = await vite.ssrLoadModule("/src/widgets/schedule/schedule.calendar.utils.ts");
        const base = emptyTimetable();
        const weekly: ScheduleTimetable = {
            ...base,
            semester: { label: "Осень", start: "2026-09-01", end: "2026-12-31" },
            groups: ["401"],
            subjects: [{ id: "subject", name: "Анатомия", tone: "slate" }],
            entries: [
                {
                    id: "regular", slotId: base.slots[0].id, span: 1, weekday: 1, groupIds: ["401"],
                    subjectId: "subject", kind: "practice", weeks: "denominator",
                },
                {
                    id: "dated", slotId: base.slots[1].id, span: 1, weekday: 1, groupIds: ["401"],
                    subjectId: "subject", kind: "lecture", weeks: "every", dates: ["2026-09-14"],
                },
            ],
        };
        const view = (dateFrom: string, timetable = weekly, dateTo?: string) => buildScheduleView(
            timetable, { subjectIds: [], weekdays: [], dateFrom, dateTo }, "2026-09-07",
        );
        assert.equal(view("2026-09-07").count, 1);
        assert.equal(view("2026-09-14").count, 1);
        assert.equal(view("2027-01-11").count, 0);
        assert.equal(view("2026-09-01", weekly, "2026-09-14").gridSections[0].subtitle, "07.09 · 14.09");
        const group = { groupId: "401", subjectIds: [], weekdays: [] };
        assert.deepEqual(calendarPeriod("week", "2026-09-01", weekly.semester, group), { from: "2026-09-01", to: "2026-09-06" });
        const period = { from: "2026-09-07", to: "2026-09-14" };
        assert.deepEqual(calendarLessons(weekly, group, period).map(({ id }: { id: string }) => id), [
            "weekly:regular:2026-09-07", "weekly:dated:2026-09-14",
        ]);
        const cyclic: ScheduleTimetable = {
            ...weekly,
            format: "cycles",
            lectures: [{ id: "lecture", subjectId: "subject", dates: ["2026-09-07"], start: "9:00", end: "10:00", groupIds: [], remote: true }],
            cycles: [{ id: "cycle", subjectId: "subject", from: "2026-09-01", to: "2026-09-10", groupIds: ["401"] }],
        };
        assert.deepEqual(calendarLessons(cyclic, group, period).map(({ id }: { id: string }) => id), [
            "cycle:cycle", "lecture:lecture:2026-09-07",
        ]);
        assert.equal(calendarLessons(cyclic, { ...group, groupId: "402" }, period).length, 1);

        const study = { id: "study", kind: "study" as const, label: "Учёба", from: "2026-09-01", to: "2026-12-31" };
        const holiday = { id: "holiday", kind: "holiday" as const, label: "Каникулы", from: "2026-09-07", to: "2026-09-14" };
        for (const periods of [[study, holiday], [holiday, study]]) {
            const timetable = { ...weekly, periods };
            assert.equal(view("2026-09-07", timetable).count, 0);
            const dated = view("2026-09-14", timetable);
            assert.equal(dated.count, 1);
            assert.equal(dated.agendaSections[0].subtitle, "14.09");
            assert.ok(validateTimetable(timetable).some((issue: { section: string }) => issue.section === "periods"));
        }
    } finally {
        await vite.close();
    }
});
