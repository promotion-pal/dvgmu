import {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
} from "docx";
import type { ISectionOptions } from "docx";
import type { ScheduleGridSection, ScheduleLessonView } from "@/shared/components/schedule";
import { buildCycleScheduleView } from "./schedule.cycles.utils";
import type { CycleScheduleView } from "./schedule.cycles.utils";
import type { ScheduleFilters, ScheduleTimetable } from "./schedule.schema";
import { buildScheduleView, formatDayMonth, formatRange, resolveDateRange, todayIso } from "./schedule.utils";

/* Downloading the timetable as Word, laid out the way it reads on the site and
 * on the faculty's paper: the same view models the page draws from.
 *
 *  - no filter        → the whole course: for every stream a grid per weekday
 *                       (time × groups, shared lessons merged across groups),
 *                       or for a senior course the groups × cycles matrix plus
 *                       the stream's lectures;
 *  - a group picked   → that group's week day by day, or its cycles and
 *                       lectures in date order;
 *  - other filters    → the open timetable's grid, narrowed. */

const EMPTY_FILTERS: ScheduleFilters = { subjectIds: [], weekdays: [] };

/* A4 in twips with 1 cm margins. Widths are absolute (DXA) and the layout
 * fixed: percentage widths aren't honoured by every viewer, and a collapsed
 * table is unreadable. */
const MARGIN = 567;
const A4_SHORT = 11906;
const A4_LONG = 16838;
const contentWidth = (landscape: boolean) => (landscape ? A4_LONG : A4_SHORT) - 2 * MARGIN;
/** Set per section before its tables are built. */
let pageWidth = contentWidth(true);
const HEADER_FILL = "E2E8F0";
const FONT = "Times New Roman";

/* ───────────── small docx helpers ───────────── */

const text = (value: string, options: { bold?: boolean; size?: number; italics?: boolean } = {}) =>
    new TextRun({ text: value, font: FONT, bold: options.bold, italics: options.italics, size: options.size ?? 18 });

const para = (runs: TextRun[], options: { center?: boolean; after?: number } = {}) =>
    new Paragraph({ children: runs, alignment: options.center ? AlignmentType.CENTER : undefined, spacing: { after: options.after ?? 0 } });

const cell = (
    lines: Paragraph[],
    options: { header?: boolean; columnSpan?: number; rowSpan?: number; width?: number } = {},
) =>
    new TableCell({
        children: lines.length > 0 ? lines : [para([])],
        columnSpan: options.columnSpan,
        rowSpan: options.rowSpan,
        verticalAlign: VerticalAlign.TOP,
        width: options.width ? { size: Math.round((pageWidth * options.width) / 100), type: WidthType.DXA } : undefined,
        shading: options.header ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL } : undefined,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
    });

const headerCell = (value: string, width?: number) => cell([para([text(value, { bold: true })], { center: true })], { header: true, width });

/** `widths` are percentages of the page's content width, one per column. */
const table = (rows: TableRow[], widths: number[]) =>
    new Table({
        rows,
        width: { size: pageWidth, type: WidthType.DXA },
        columnWidths: widths.map((width) => Math.round((pageWidth * width) / 100)),
        layout: TableLayoutType.FIXED,
    });

const heading = (value: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) =>
    new Paragraph({ children: [text(value, { bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 22 })], heading: level, spacing: { before: 200, after: 80 } });

/** A lesson as it reads on its card: name, then time, kind, weeks, dates, room. */
const lessonLines = (lesson: ScheduleLessonView, size = 16) => {
    const lines = [para([text(lesson.title, { bold: true, size })])];
    const details = [lesson.time, lesson.meta, ...(lesson.badges ?? [])].filter(Boolean).join(" · ");
    if (details) lines.push(para([text(details, { size })]));
    if (lesson.audience) lines.push(para([text(lesson.audience, { size })]));
    if (lesson.dates) lines.push(para([text(`Даты: ${lesson.dates}`, { size, italics: true })]));
    if (lesson.location) lines.push(para([text(lesson.location, { size })]));
    return lines;
};

/* ───────────── weekly: the grid (time × groups) ───────────── */

/** One weekday as a table: a row per class period, a column per group; a
 * lesson shared by neighbouring groups or spanning periods is one merged cell. */
const gridTable = (section: ScheduleGridSection, groups: { id: string; label: string }[]) => {
    const columnIndex = new Map(groups.map((group, index) => [group.id, index]));
    const rowIndex = new Map(section.slots.map((slot, index) => [slot.id, index]));
    const covered = section.slots.map(() => groups.map(() => false));
    const anchors = new Map<string, { rowSpan: number; columnSpan: number; lessons: ScheduleLessonView[] }>();

    for (const placement of section.placements) {
        const row = rowIndex.get(placement.slotId);
        const columns = placement.columnIds.map((id) => columnIndex.get(id)).filter((index): index is number => index !== undefined);
        if (row === undefined || columns.length === 0) continue;
        const first = Math.min(...columns);
        const rowSpan = Math.min(placement.slotSpan, section.slots.length - row);
        const key = `${row}:${first}`;
        const existing = anchors.get(key);
        if (existing) {
            existing.lessons.push(...placement.lessons);
            continue;
        }
        anchors.set(key, { rowSpan, columnSpan: columns.length, lessons: [...placement.lessons] });
        for (let r = row; r < row + rowSpan; r++) {
            for (const c of columns) covered[r][c] = true;
        }
        covered[row][first] = false;
    }

    const timeWidth = 9;
    const groupWidth = (100 - timeWidth) / Math.max(groups.length, 1);
    const rows = [new TableRow({ tableHeader: true, children: [headerCell("Время", timeWidth), ...groups.map((g) => headerCell(g.label, groupWidth))] })];

    section.slots.forEach((slot, r) => {
        const cells = [cell([para([text(slot.label, { bold: true, size: 16 })])], { header: true, width: timeWidth })];
        for (let c = 0; c < groups.length; c++) {
            const anchor = anchors.get(`${r}:${c}`);
            if (anchor) {
                cells.push(
                    cell(anchor.lessons.flatMap((lesson) => lessonLines(lesson)), {
                        rowSpan: anchor.rowSpan > 1 ? anchor.rowSpan : undefined,
                        columnSpan: anchor.columnSpan > 1 ? anchor.columnSpan : undefined,
                        width: groupWidth * anchor.columnSpan,
                    }),
                );
                c += anchor.columnSpan - 1;
            } else if (!covered[r][c]) {
                cells.push(cell([], { width: groupWidth }));
            }
        }
        rows.push(new TableRow({ children: cells, cantSplit: true }));
    });

    return table(rows, [timeWidth, ...groups.map(() => groupWidth)]);
};

const weeklyGrid = (timetable: ScheduleTimetable, filters: ScheduleFilters) => {
    const view = buildScheduleView(timetable, filters, todayIso());
    return view.gridSections.flatMap((section) => [
        heading(section.subtitle ? `${section.title} (${section.subtitle})` : section.title, HeadingLevel.HEADING_3),
        gridTable(section, view.columns),
    ]);
};

/* ───────────── weekly: one group, day by day ───────────── */

const weeklyAgenda = (timetable: ScheduleTimetable, filters: ScheduleFilters) => {
    const view = buildScheduleView(timetable, filters, todayIso());
    return view.agendaSections.flatMap((section) => [
        heading(section.subtitle ? `${section.title} (${section.subtitle})` : section.title, HeadingLevel.HEADING_3),
        table([
            new TableRow({ tableHeader: true, children: [headerCell("Время", 16), headerCell("Занятие", 84)] }),
            ...section.items.map(
                (item) =>
                    new TableRow({
                        cantSplit: true,
                        children: [
                            cell([para([text(item.time, { bold: true })])], { width: 16 }),
                            cell(item.lessons.flatMap((lesson) => lessonLines({ ...lesson, time: undefined }, 18)), { width: 84 }),
                        ],
                    }),
            ),
        ], [16, 84]),
    ]);
};

/* ───────────── senior courses: cycles and lectures ───────────── */

const cycleMatrix = (view: CycleScheduleView) => {
    const { columns, rows } = view.matrix;
    const groupsWidth = 10;
    const width = (100 - groupsWidth) / Math.max(columns.length, 1);
    return table([
        new TableRow({ tableHeader: true, children: [headerCell("Группы", groupsWidth), ...columns.map((column) => headerCell(column.title, width))] }),
        ...rows.map(
            (row) =>
                new TableRow({
                    cantSplit: true,
                    children: [
                        cell([para([text(row.label, { bold: true })])], { width: groupsWidth }),
                        ...row.cells.map((value) => cell([para([text(value?.range ?? "", { size: 16 })], { center: true })], { width })),
                    ],
                }),
        ),
    ], [groupsWidth, ...columns.map(() => width)]);
};

const lectureTable = (view: CycleScheduleView) =>
    table([
        new TableRow({
            tableHeader: true,
            children: [headerCell("Дисциплина", 28), headerCell("Время", 12), headerCell("Даты", 32), headerCell("Где", 28)],
        }),
        ...view.lectureRows.map(
            (row) =>
                new TableRow({
                    cantSplit: true,
                    children: [
                        cell([para([text(row.title, { bold: true })]), ...(row.audience ? [para([text(row.audience, { size: 16 })])] : [])]),
                        cell([para([text(row.time)])]),
                        cell([para([text(`${row.dates} (${row.count})`)])]),
                        cell([para([text(row.place)])]),
                    ],
                }),
        ),
    ], [28, 12, 32, 28]);

/** One group's term in date order: each cycle as a row, each lecture as a row. */
const groupTimeline = (view: CycleScheduleView) => {
    const rows: TableRow[] = [
        new TableRow({ tableHeader: true, children: [headerCell("Когда", 20), headerCell("Время", 14), headerCell("Что", 36), headerCell("Где", 30)] }),
    ];
    const lectureRow = (when: string, time: string, what: string, where: string) =>
        new TableRow({ cantSplit: true, children: [cell([para([text(when)])]), cell([para([text(time)])]), cell([para([text(what)])]), cell([para([text(where)])])] });

    for (const item of view.timeline) {
        if (item.kind === "cycle") {
            rows.push(
                new TableRow({
                    cantSplit: true,
                    children: [
                        cell([para([text(item.cycle.range, { bold: true })])], { header: true }),
                        cell([para([text("по расписанию кафедры")])], { header: true }),
                        cell([para([text(`Цикл: ${item.cycle.title}`, { bold: true })]), para([text(item.cycle.length, { size: 16 })])], { header: true }),
                        cell([para([text(item.cycle.note ?? "")])], { header: true }),
                    ],
                }),
            );
            for (const day of item.lectureDays) {
                for (const lecture of day.lectures) rows.push(lectureRow(day.label, lecture.time, `Лекция: ${lecture.title}`, lecture.place));
            }
        } else {
            for (const lecture of item.day.lectures) rows.push(lectureRow(item.day.label, lecture.time, `Лекция: ${lecture.title}`, lecture.place));
        }
    }
    return table(rows, [20, 14, 36, 30]);
};

const cycleContent = (timetable: ScheduleTimetable, filters: ScheduleFilters) => {
    const view = buildCycleScheduleView(timetable, filters, todayIso());
    if (filters.groupId) return [groupTimeline(view)];
    return [
        heading("Циклы практических занятий по группам", HeadingLevel.HEADING_3),
        cycleMatrix(view),
        heading("Лекции потока", HeadingLevel.HEADING_3),
        lectureTable(view),
    ];
};

/* ───────────── the document ───────────── */

const hasNarrowingFilters = (filters: ScheduleFilters) =>
    Boolean(filters.groupId || filters.dateFrom || filters.dateTo) || filters.subjectIds.length > 0 || filters.weekdays.length > 0;

/** Every stream of the open timetable's course in the same semester. */
const courseTimetables = (timetables: ScheduleTimetable[], open: ScheduleTimetable) =>
    timetables
        .filter((t) => t.program.id === open.program.id && t.course === open.course && t.semester.start === open.semester.start)
        .sort((a, b) => (a.stream ?? "").localeCompare(b.stream ?? "", "ru", { numeric: true }));

const subjectName = (timetable: ScheduleTimetable, id: string) => timetable.subjects.find((subject) => subject.id === id)?.name ?? id;

const describeFilters = (timetable: ScheduleTimetable, filters: ScheduleFilters) => {
    const parts: string[] = [];
    if (filters.groupId) parts.push(`группа ${filters.groupId}`);
    const range = resolveDateRange(filters);
    if (range) parts.push(range.from === range.to ? `дата ${formatDayMonth(range.from)}` : `даты ${formatRange(range.from, range.to)}`);
    if (filters.subjectIds.length > 0) parts.push(`предметы: ${filters.subjectIds.map((id) => subjectName(timetable, id)).join(", ")}`);
    return parts.join("; ");
};

/** What a click on "Выгрузить" will produce, for the button's label. */
export const describeExportScope = (filters: ScheduleFilters) => {
    if (filters.groupId) return `Выгрузить группу ${filters.groupId}`;
    if (hasNarrowingFilters(filters)) return "Выгрузить по фильтрам";
    return "Выгрузить весь курс";
};

const streamTitle = (timetable: ScheduleTimetable) =>
    `${timetable.course} курс${timetable.stream ? ` (${timetable.stream})` : ""} · ${timetable.semester.label}`;

const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

/**
 * Downloads the timetable as .docx. Returns false when the filters leave
 * nothing to export, so the caller can say so instead of saving an empty file.
 */
export const exportSchedule = async (timetables: ScheduleTimetable[], open: ScheduleTimetable, filters: ScheduleFilters) => {
    const narrowed = hasNarrowingFilters(filters);
    const sources = narrowed ? [open] : courseTimetables(timetables, open);

    const sections: ISectionOptions[] = [];
    for (const timetable of sources) {
        const used = narrowed ? filters : EMPTY_FILTERS;
        // Group-by-group grids are wide: landscape for them, portrait for a single group's list.
        const landscape = !filters.groupId;
        pageWidth = contentWidth(landscape);
        const body =
            timetable.format === "cycles"
                ? cycleContent(timetable, used)
                : filters.groupId
                  ? weeklyAgenda(timetable, used)
                  : weeklyGrid(timetable, used);
        if (body.length === 0) continue;

        sections.push({
            properties: {
                page: {
                    // Always A4 given portrait-wise: docx swaps the sides itself for landscape.
                    size: {
                        width: A4_SHORT,
                        height: A4_LONG,
                        orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
                    },
                    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
                },
            },
            children: [
                heading(`Расписание: ${timetable.program.code} ${timetable.program.name}`, HeadingLevel.HEADING_1),
                para([text(`${timetable.faculty} · ${streamTitle(timetable)}`, { size: 20 })], { after: 60 }),
                ...(narrowed ? [para([text(`Выгружено: ${describeFilters(timetable, filters)}`, { size: 20, italics: true })], { after: 120 })] : []),
                ...body,
            ],
        });
    }

    if (sections.length === 0) return false;

    const blob = await Packer.toBlob(new Document({ sections }));
    const scope = filters.groupId ? `группа_${filters.groupId}` : narrowed ? "по_фильтрам" : "весь_курс";
    download(blob, `Расписание_${open.program.code}_${open.course}_курс_${scope}.docx`);
    return true;
};
