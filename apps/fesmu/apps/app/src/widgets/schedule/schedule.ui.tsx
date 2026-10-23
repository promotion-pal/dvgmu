import type { FC } from "react";
import { CalendarSearchIcon, ChevronDownIcon, DownloadIcon, FilterXIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { CommonFilterChips, CommonFilterDateRange, CommonFilterSelect } from "@/shared/components/filter";
import { CommonWrapperViewMode } from "@/shared/components/wrapper";
import type { useCommonWrapperViewMode } from "@/shared/components/wrapper";
import { ScheduleAgenda, ScheduleGrid, SchedulePeriods } from "@/shared/components/schedule";
import { Badge } from "@/shared/ui/badge";
import { WEEKDAY_SHORT_LABEL } from "./schedule.schema";
import type { ScheduleFormat } from "./schedule.schema";
import type { useSchedule } from "./schedule.fn";
import { CycleBoard } from "./schedule.cycles.ui";

type Schedule = ReturnType<typeof useSchedule>;

interface ScheduleFiltersProps {
    /** A cycle-based timetable has no weekly grid, so the weekday filter is hidden for it. */
    format?: ScheduleFormat;
    filters: Schedule["filters"];
    options: Schedule["options"];
    semester?: { start: string; end: string };
    onChange: Schedule["changeFilters"];
    onReset: Schedule["resetFilters"];
    hasActiveFilters: boolean;
}

const ScheduleFilters: FC<ScheduleFiltersProps> = ({ format, filters, options, semester, onChange, onReset, hasActiveFilters }) => {
    const weekdayOptions = options.weekdays.map((option) => ({ ...option, label: WEEKDAY_SHORT_LABEL[option.value] }));

    return (
        <div className="flex w-full flex-wrap items-end gap-x-5 gap-y-3">
            <CommonFilterSelect
                label="Специальность"
                value={filters.programId}
                onChange={(programId) => onChange({ programId })}
                options={options.programs}
            />
            <CommonFilterSelect
                label="Курс"
                value={filters.course === undefined ? undefined : String(filters.course)}
                onChange={(course) => onChange({ course: course === undefined ? undefined : Number(course) })}
                options={options.courses}
                className="[&_button]:min-w-28"
            />
            {options.variants.length > 0 && (
                <CommonFilterSelect
                    label="Поток / семестр"
                    value={filters.timetableId}
                    onChange={(timetableId) => onChange({ timetableId })}
                    options={options.variants}
                    className="[&_button]:min-w-56"
                />
            )}
            <CommonFilterSelect
                label="Группа"
                value={filters.groupId}
                onChange={(groupId) => onChange({ groupId })}
                options={options.groups}
                allLabel="Все группы"
            />
            <CommonFilterDateRange
                label="Даты"
                from={filters.dateFrom}
                to={filters.dateTo}
                min={semester?.start}
                max={semester?.end}
                onChange={({ from, to }) => onChange({ dateFrom: from, dateTo: to })}
            />
            {format !== "cycles" && (
                <CommonFilterChips
                    label="Дни недели"
                    options={weekdayOptions}
                    value={filters.weekdays}
                    onChange={(weekdays) => onChange({ weekdays })}
                />
            )}
            <CommonFilterChips
                label="Предметы"
                options={options.subjects}
                value={filters.subjectIds}
                onChange={(subjectIds) => onChange({ subjectIds })}
                className="basis-full"
            />
            {hasActiveFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
                    <FilterXIcon className="size-4" />
                    Сбросить фильтры
                </Button>
            )}
        </div>
    );
};

interface ScheduleOverviewProps {
    timetable: NonNullable<Schedule["timetable"]>;
    view: NonNullable<Schedule["view"]>;
}

/** Everything the paper header carried: which timetable this is, the term's
 * calendar, exams and credits, and who approved it. */
const ScheduleOverview: FC<ScheduleOverviewProps> = ({ timetable, view }) => {
    return (
        <Card className="gap-4 p-5">
            <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {timetable.faculty}
                </p>
                <h2 className="text-lg font-semibold leading-snug">
                    {timetable.title}: {timetable.program.code} {timetable.program.name}
                </h2>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {timetable.course} курс{timetable.stream ? ` (${timetable.stream})` : ""} · {timetable.semester.label}
                    {timetable.format === "cycles" && (
                        <Badge className="bg-violet-600 text-white">Старший курс · лекции и циклы</Badge>
                    )}
                </p>
            </div>

            <SchedulePeriods periods={view.periods} />

            <details className="group rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
                    Экзамены, зачёты и утверждение
                    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>

                <div className="mt-4 flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <ListBlock title="Экзамены" items={timetable.exams} />
                        <ListBlock title="Зачёты" items={timetable.credits} />
                    </div>

                    {timetable.note && <p className="text-xs leading-relaxed text-muted-foreground">{timetable.note}</p>}

                    {(timetable.approvedBy || timetable.agreedBy.length > 0) && (
                        <div className="flex flex-col gap-0.5 border-t pt-3 text-xs text-muted-foreground">
                            {timetable.approvedBy && (
                                <p>
                                    Утверждаю: {timetable.approvedBy}
                                    {timetable.approvedOn ? `, ${timetable.approvedOn}` : ""}
                                </p>
                            )}
                            {timetable.agreedBy.length > 0 && <p>Согласовано: {timetable.agreedBy.join("; ")}</p>}
                        </div>
                    )}
                </div>
            </details>
        </Card>
    );
};

const ListBlock: FC<{ title: string; items: string[] }> = ({ title, items }) => {
    if (items.length === 0) return null;

    return (
        <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <ul className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                    <li key={item} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
};

interface ScheduleBoardProps {
    view: NonNullable<Schedule["view"]>;
    viewModeState: ReturnType<typeof useCommonWrapperViewMode>;
    /** Senior courses: the groups to offer when none is picked yet. */
    groups?: Schedule["options"]["groups"];
    onPickGroup?: (groupId: string) => void;
}

/** The timetable itself: the grid ("Таблица") or day cards ("Карточки"); for a
 * senior course, its lectures and cycles in one panel. */
const ScheduleBoard: FC<ScheduleBoardProps> = ({ view, viewModeState, groups = [], onPickGroup = () => {} }) => {
    if (view.cycles) {
        return <CycleBoard view={view.cycles} viewModeState={viewModeState} groups={groups} onPickGroup={onPickGroup} />;
    }

    if (view.emptyReason) {
        return (
            <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CalendarSearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>Занятий нет</EmptyTitle>
                    <EmptyDescription>{view.emptyReason}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <CommonWrapperViewMode
            {...viewModeState}
            cards={<ScheduleAgenda sections={view.agendaSections} />}
            tables={<ScheduleGrid columns={view.columns} sections={view.gridSections} slotHeading="Время" />}
        />
    );
};

interface ScheduleExportButtonProps {
    label: string;
    exporting: boolean;
    disabled?: boolean;
    onExport: () => void;
}

/** Downloads the timetable as Word; the label says what will go into the file. */
const ScheduleExportButton: FC<ScheduleExportButtonProps> = ({ label, exporting, disabled, onExport }) => (
    <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={disabled || exporting}>
        <DownloadIcon className="size-4" />
        {exporting ? "Выгружаем…" : label}
    </Button>
);

export { ScheduleBoard, ScheduleExportButton, ScheduleFilters, ScheduleOverview };
