import type { CSSProperties, FC } from "react";
import { Card } from "@/shared/ui/card";
import { ScheduleLessonCard } from "./schedule-lesson";
import type { ScheduleGridColumn, ScheduleGridSection } from "./schedule.types";

const TIME_COLUMN_PX = 92;
const COLUMN_MIN_PX = 108;

interface ScheduleGridProps {
    columns: ScheduleGridColumn[];
    sections: ScheduleGridSection[];
    /** Heading of the leftmost column, e.g. "Время". */
    slotHeading?: string;
    /** Heading above the columns, e.g. "Учебные группы". */
    columnsHeading?: string;
}

/** The classic timetable layout — one block per section (day), rows are
 * time slots, columns are groups — drawn with CSS grid so a lesson can span
 * several slots and several columns like the merged cells of a paper
 * schedule. Scrolls sideways when there are many columns, keeping the time
 * column pinned. */
const ScheduleGrid: FC<ScheduleGridProps> = ({ columns, sections, slotHeading = "Время", columnsHeading }) => {
    const columnIndex = new Map(columns.map((column, index) => [column.id, index]));

    return (
        <div className="flex flex-col gap-5">
            {sections.map((section) => {
                const slotIndex = new Map(section.slots.map((slot, index) => [slot.id, index]));

                const gridStyle: CSSProperties = {
                    gridTemplateColumns: `${TIME_COLUMN_PX}px repeat(${columns.length}, minmax(${COLUMN_MIN_PX}px, 1fr))`,
                    minWidth: TIME_COLUMN_PX + columns.length * COLUMN_MIN_PX,
                };

                return (
                    <Card key={section.id} className="gap-0 overflow-hidden p-0">
                        <div className="flex items-baseline justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
                            <h3 className="text-sm font-semibold">{section.title}</h3>
                            {section.subtitle && <span className="text-xs text-muted-foreground">{section.subtitle}</span>}
                        </div>

                        <div className="overflow-x-auto">
                            <div className="grid text-xs" style={gridStyle}>
                                <div className="sticky left-0 z-10 border-b bg-card px-2 py-1.5 font-medium text-muted-foreground">
                                    {slotHeading}
                                </div>
                                {columns.map((column) => (
                                    <div
                                        key={column.id}
                                        className="border-b border-l bg-card px-2 py-1.5 text-center font-medium text-muted-foreground"
                                    >
                                        {column.label}
                                    </div>
                                ))}

                                {section.slots.map((slot, row) => (
                                    <div
                                        key={slot.id}
                                        className="sticky left-0 z-10 flex items-start border-b bg-card px-2 py-2 font-mono text-[0.7rem] text-muted-foreground"
                                        style={{ gridRow: row + 2, gridColumn: 1 }}
                                    >
                                        {slot.label}
                                    </div>
                                ))}

                                {section.slots.flatMap((slot, row) =>
                                    columns.map((column, col) => (
                                        <div
                                            key={`${slot.id}-${column.id}`}
                                            className="border-b border-l"
                                            style={{ gridRow: row + 2, gridColumn: col + 2 }}
                                        />
                                    )),
                                )}

                                {section.placements.map((placement) => {
                                    const rowStart = slotIndex.get(placement.slotId);
                                    const indexes = placement.columnIds
                                        .map((id) => columnIndex.get(id))
                                        .filter((index): index is number => index !== undefined);
                                    if (rowStart === undefined || indexes.length === 0) return null;

                                    const first = Math.min(...indexes);
                                    const last = Math.max(...indexes);

                                    return (
                                        <div
                                            key={placement.id}
                                            className="flex flex-col gap-1 p-1"
                                            style={{
                                                gridRow: `${rowStart + 2} / span ${placement.slotSpan}`,
                                                gridColumn: `${first + 2} / span ${last - first + 1}`,
                                            }}
                                        >
                                            {placement.lessons.map((lesson) => (
                                                <ScheduleLessonCard key={lesson.id} lesson={lesson} compact className="flex-1" />
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {columnsHeading && <p className="border-t px-4 py-1.5 text-[0.7rem] text-muted-foreground">{columnsHeading}</p>}
                    </Card>
                );
            })}
        </div>
    );
};

export { ScheduleGrid };
