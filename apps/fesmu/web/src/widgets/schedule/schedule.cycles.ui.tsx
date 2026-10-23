import { useState } from "react";
import type { FC, ReactNode } from "react";
import { CalendarClockIcon, ChevronUpIcon, HistoryIcon, MapPinIcon, MonitorIcon, UsersIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LESSON_TONE_STYLES } from "@/shared/components/schedule";
import { CommonWrapperViewMode } from "@/shared/components/wrapper";
import type { useCommonWrapperViewMode } from "@/shared/components/wrapper";
import type {
    CycleLectureDay,
    CycleLectureView,
    CycleScheduleView,
    CycleState,
    CycleTimelineItem,
    CycleView,
} from "./schedule.cycles.utils";

const STATE_LABEL: Record<CycleState, string> = {
    past: "завершён",
    current: "идёт сейчас",
    upcoming: "впереди",
};

/* ───────────── pieces ───────────── */

const LecturePlace: FC<{ lecture: Pick<CycleLectureView, "place" | "remote"> }> = ({ lecture }) => (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {lecture.remote ? <MonitorIcon className="size-3.5 shrink-0" /> : <MapPinIcon className="size-3.5 shrink-0" />}
        {lecture.place}
    </span>
);

const LectureLine: FC<{ lecture: CycleLectureView }> = ({ lecture }) => (
    <li className="grid grid-cols-[6.5rem_1fr] items-start gap-2 py-1.5">
        <span className="pt-0.5 font-mono text-xs text-muted-foreground">{lecture.time}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-2 shrink-0 rounded-full", LESSON_TONE_STYLES[lecture.tone].accent)} aria-hidden />
                <span className="truncate">{lecture.title}</span>
                <Badge variant="outline" className="shrink-0 text-[0.65rem]">Лекция</Badge>
            </span>
            <span className="flex flex-wrap gap-x-3 pl-4">
                <LecturePlace lecture={lecture} />
                {lecture.audience && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <UsersIcon className="size-3.5" />
                        {lecture.audience}
                    </span>
                )}
            </span>
        </div>
    </li>
);

const LectureDayBlock: FC<{ day: CycleLectureDay; compact?: boolean }> = ({ day, compact }) => (
    <div className={cn("flex flex-col", !compact && "rounded-xl border bg-card px-4 py-2")}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day.label}</span>
        <ul className="divide-y">
            {day.lectures.map((lecture) => (
                <LectureLine key={`${day.date}-${lecture.id}`} lecture={lecture} />
            ))}
        </ul>
    </div>
);

const Progress: FC<{ value: number; className?: string }> = ({ value, className }) => (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/10", className)}>
        <div className="h-full rounded-full bg-current" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
);

const CycleCard: FC<{ cycle: CycleView; children?: ReactNode }> = ({ cycle, children }) => {
    const tone = LESSON_TONE_STYLES[cycle.tone];
    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-xl border px-4 py-3",
                tone.card,
                cycle.state === "current" && "ring-2 ring-current ring-offset-1",
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide opacity-70">Цикл практических занятий</span>
                    <span className="text-base font-semibold leading-snug">{cycle.title}</span>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone.pill)}>{STATE_LABEL[cycle.state]}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{cycle.range}</span>
                <span className="opacity-75">{cycle.length}</span>
                <span className="opacity-75">по расписанию кафедры</span>
            </div>
            {cycle.state === "current" && <Progress value={cycle.progress} />}
            {cycle.note && <p className="text-xs opacity-75">{cycle.note}</p>}
            {children}
        </div>
    );
};

/* ───────────── "now" summary ───────────── */

const NowCard: FC<{ now: NonNullable<CycleScheduleView["now"]>; groupId: string }> = ({ now, groupId }) => {
    const { cycle, nextCycle, nextLecture } = now;
    if (!cycle && !nextCycle && !nextLecture) return null;

    return (
        <Card className="gap-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClockIcon className="size-4 text-muted-foreground" />
                Группа {groupId}: сейчас и дальше
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                <NowTile label="Идёт цикл" empty="Сейчас цикла нет">
                    {cycle && (
                        <>
                            <span className="font-semibold">{cycle.title}</span>
                            <span className="text-xs text-muted-foreground">до {cycle.range.split(" – ")[1]}</span>
                            <Progress value={cycle.progress} className={cn("mt-1", LESSON_TONE_STYLES[cycle.tone].card)} />
                        </>
                    )}
                </NowTile>
                <NowTile label="Следующий цикл" empty="Циклов больше нет">
                    {nextCycle && (
                        <>
                            <span className="font-semibold">{nextCycle.title}</span>
                            <span className="text-xs text-muted-foreground">{nextCycle.range}</span>
                        </>
                    )}
                </NowTile>
                <NowTile label="Ближайшая лекция" empty="Лекций больше нет">
                    {nextLecture && (
                        <>
                            <span className="font-semibold">{nextLecture.lecture.title}</span>
                            <span className="text-xs text-muted-foreground">
                                {nextLecture.day.label}, {nextLecture.lecture.time}
                            </span>
                            <LecturePlace lecture={nextLecture.lecture} />
                        </>
                    )}
                </NowTile>
            </div>
        </Card>
    );
};

const NowTile: FC<{ label: string; empty: string; children?: ReactNode }> = ({ label, empty, children }) => (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {children ?? <span className="text-sm text-muted-foreground">{empty}</span>}
    </div>
);

/* ───────────── timeline ───────────── */

const itemState = (item: CycleTimelineItem): CycleState => (item.kind === "cycle" ? item.cycle.state : item.day.state);

const TodayMarker: FC = () => (
    <li className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-primary" aria-label="Сегодня">
        <span className="h-px flex-1 bg-primary" />
        сегодня
        <span className="h-px flex-1 bg-primary" />
    </li>
);

/** The group's whole term in one column: lecture days and cycles by date,
 * with a "today" line between what is behind and what is ahead. What is
 * already behind is folded away until asked for — mid-term it's most of the list. */
const CycleTimeline: FC<{ items: CycleTimelineItem[] }> = ({ items }) => {
    const [showPast, setShowPast] = useState(false);
    const firstAhead = items.findIndex((item) => itemState(item) !== "past");
    const pastCount = firstAhead === -1 ? items.length : firstAhead;
    const visible = showPast ? items : items.slice(pastCount);

    return (
        <ol className="flex max-w-3xl flex-col gap-3">
            {pastCount > 0 && (
                <li>
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowPast((v) => !v)}>
                        {showPast ? <ChevronUpIcon className="size-4" /> : <HistoryIcon className="size-4" />}
                        {showPast ? "Скрыть прошедшее" : `Показать прошедшее (${pastCount})`}
                    </Button>
                </li>
            )}
            {visible.map((item) => (
                <FragmentWithMarker key={item.id} marker={item === items[firstAhead] && pastCount > 0 && showPast}>
                    <li className={cn(itemState(item) === "past" && "opacity-55")}>
                        {item.kind === "cycle" ? (
                            <CycleCard cycle={item.cycle}>
                                {item.lectureDays.length > 0 && (
                                    <div className="flex flex-col gap-2 rounded-lg bg-background/70 px-3 py-2 text-foreground">
                                        {item.lectureDays.map((day) => (
                                            <LectureDayBlock key={day.date} day={day} compact />
                                        ))}
                                    </div>
                                )}
                            </CycleCard>
                        ) : (
                            <LectureDayBlock day={item.day} />
                        )}
                    </li>
                </FragmentWithMarker>
            ))}
            {firstAhead === -1 && showPast && <TodayMarker />}
        </ol>
    );
};

const FragmentWithMarker: FC<{ marker: boolean; children: ReactNode }> = ({ marker, children }) => (
    <>
        {marker && <TodayMarker />}
        {children}
    </>
);

/* ───────────── matrix & lecture table ───────────── */

const CycleMatrix: FC<{ matrix: CycleScheduleView["matrix"] }> = ({ matrix }) => (
    <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">Циклы практических занятий по группам</div>
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="sticky left-0 z-10 bg-card">Группы</TableHead>
                        {matrix.columns.map((column) => (
                            <TableHead key={column.id} className="min-w-32 whitespace-normal align-bottom text-xs leading-tight">
                                <span className="flex items-start gap-1.5">
                                    <span className={cn("mt-1 size-2 shrink-0 rounded-full", LESSON_TONE_STYLES[column.tone].accent)} aria-hidden />
                                    {column.title}
                                </span>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {matrix.rows.map((row) => (
                        <TableRow key={row.id} className={cn(row.selected && "bg-primary/5")}>
                            <TableCell className={cn("sticky left-0 z-10 bg-card font-medium", row.selected && "text-primary")}>
                                {row.label}
                            </TableCell>
                            {row.cells.map((cell, index) => (
                                <TableCell key={matrix.columns[index].id} className="p-1.5">
                                    {cell && (
                                        <span
                                            className={cn(
                                                "block rounded-md border px-2 py-1 text-center font-mono text-xs",
                                                LESSON_TONE_STYLES[cell.tone].card,
                                                cell.state === "past" && "opacity-45",
                                                cell.state === "current" && "font-semibold ring-2 ring-current",
                                            )}
                                            title={STATE_LABEL[cell.state]}
                                        >
                                            {cell.range}
                                        </span>
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </Card>
);

const LectureTable: FC<{ rows: CycleScheduleView["lectureRows"] }> = ({ rows }) => (
    <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">Лекции потока</div>
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Дисциплина</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Даты</TableHead>
                        <TableHead>Где</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className="max-w-64 whitespace-normal font-medium">
                                <span className="flex items-start gap-2">
                                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", LESSON_TONE_STYLES[row.tone].accent)} aria-hidden />
                                    <span>
                                        {row.title}
                                        {row.audience && <span className="block text-xs font-normal text-muted-foreground">{row.audience}</span>}
                                    </span>
                                </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.time}</TableCell>
                            <TableCell className="whitespace-normal text-xs">
                                {row.dates} <span className="text-muted-foreground">({row.count})</span>
                            </TableCell>
                            <TableCell className="max-w-72 whitespace-normal">
                                <LecturePlace lecture={row} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </Card>
);

/* ───────────── board ───────────── */

interface CycleBoardProps {
    view: CycleScheduleView;
    viewModeState: ReturnType<typeof useCommonWrapperViewMode>;
    groups: { value: string; label: string }[];
    onPickGroup: (groupId: string) => void;
}

/** A senior-course timetable in one panel: "Карточки" — the chosen group's
 * term as a single timeline of lectures and cycles; "Таблица" — every group's
 * cycles side by side plus the stream's lectures. */
const CycleBoard: FC<CycleBoardProps> = ({ view, viewModeState, groups, onPickGroup }) => {
    const pickGroup = (
        <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Выберите группу</EmptyTitle>
                <EmptyDescription>
                    На старших курсах практические занятия идут циклами, и у каждой группы свой порядок. Выберите группу — лекции
                    и её циклы сложатся в одну ленту.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center gap-1.5">
                {groups.map((group) => (
                    <Button key={group.value} type="button" variant="outline" size="sm" onClick={() => onPickGroup(group.value)}>
                        {group.value}
                    </Button>
                ))}
            </EmptyContent>
        </Empty>
    );

    const timeline = view.groupId ? (
        <div className="flex flex-col gap-4">
            {view.now && <NowCard now={view.now} groupId={view.groupId} />}
            {view.timeline.length > 0 ? (
                <CycleTimeline items={view.timeline} />
            ) : (
                <p className="text-sm text-muted-foreground">По выбранным фильтрам ничего не найдено.</p>
            )}
        </div>
    ) : (
        pickGroup
    );

    const tables = (
        <div className="flex flex-col gap-4">
            {view.matrix.columns.length > 0 && <CycleMatrix matrix={view.matrix} />}
            {view.lectureRows.length > 0 && <LectureTable rows={view.lectureRows} />}
        </div>
    );

    return <CommonWrapperViewMode {...viewModeState} cards={timeline} tables={tables} />;
};

export { CycleBoard };
