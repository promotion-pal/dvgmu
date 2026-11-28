import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleCollectTable, scheduleCollectTableHeader } from "../src/widgets/schedule-collect/schedule-collect.table.ts";

const rows = [
    ["2026-11-30", "401", "2", "312", "Доцент", "Иванов", "Иван", "Анатомия", "пр."],
    ["2026-11-30", "402", "3", "313", "Доцент", "Петров", "Петр", 'Основы; модуль "А"', "экз."],
];

test("prepare assignments from a UTF-8 CSV and paste a TSV", () => {
    const quote = (field: string) => `"${field.replaceAll('"', '""')}"`;
    const csv = "\uFEFF" + [
        scheduleCollectTableHeader.replaceAll("\t", ";"),
        ...rows.map((row) => row.map(quote).join(";")),
    ].join("\r\n");
    const parsed = parseScheduleCollectTable(csv, 2);
    assert.equal(parsed[0].les, 2);
    assert.equal(parsed[1].subject, 'Основы; модуль "А"');
    assert.equal(parsed[1].subjType, "экз.");

    const reversed = [scheduleCollectTableHeader.split("\t"), rows[0]].map((fields) => fields.toReversed().join("\t")).join("\n");
    assert.deepEqual(parseScheduleCollectTable(reversed, 1), parsed.slice(0, 1));
});

test("give the source row for malformed values and enforce batch capacity", () => {
    const line = rows[0].join("\t");
    assert.throws(() => parseScheduleCollectTable(`${scheduleCollectTableHeader}\n${line}\n\n${line.replace("2026-11-30", "2026-02-31")}`, 2), /Строка 4.*существующую дату/);
    assert.throws(() => parseScheduleCollectTable(`${scheduleCollectTableHeader}\n${line.replace("Анатомия", '"Анатомия')}`, 1), /Строка 2.*кавычка/);
    assert.throws(() => parseScheduleCollectTable(`${scheduleCollectTableHeader}\n${line.replace("2\t", "2147483648\t")}`, 1), /Строка 2.*слишком велик/);
    assert.throws(() => parseScheduleCollectTable(`${scheduleCollectTableHeader}\n${line}\n${line}`, 1), /ещё строк: 1/);
});
