import { useState } from "react";
import { CalendarIcon, CalendarSearchIcon, ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { useLocation, useSearchParams } from "react-router-dom";
import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import { CommonFilterChips, CommonFilterDateRange, CommonFilterSelect } from "@/shared/components/filter";
import { ScheduleLessonCard, SchedulePeriods } from "@/shared/components/schedule";
import { CommonShareLink } from "@/shared/components/share";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { CALENDAR_MODES, calendarDays, calendarLessons, calendarPeriod, semesterDate } from "./schedule.calendar.utils";
import type { CalendarLesson, CalendarMode } from "./schedule.calendar.utils";
import type { useSchedule } from "./schedule.fn";
import { WEEKDAY_LABEL, WEEKDAY_SHORT_LABEL } from "./schedule.schema";
import type { ScheduleFilters as ScheduleFilterValues } from "./schedule.schema";
import { ScheduleFilters, ScheduleOverview } from "./schedule.ui";
import { formatDate, formatDayMonth, formatRange, isoWeekday, offsetDate, resolveDateRange, todayIso, toMinutes } from "./schedule.utils";

type Schedule = ReturnType<typeof useSchedule>;

const KIND_LABELS = { lecture: "Лекция", practice: "Практическое занятие", cycle: "Учебный цикл" };
const MODES = [
    { value: "day", label: "День" },
    { value: "week", label: "Неделя" },
    { value: "term", label: "Семестр" },
] as const;

interface CalendarUrl {
    mode?: CalendarMode;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    layout?: "grid" | "list";
    event?: string;
    kind?: keyof typeof KIND_LABELS;
    room?: string;
}

const CALENDAR_URL: UrlStateSchema<CalendarUrl> = {
    mode: { key: "period", codec: urlCodec.oneOf(CALENDAR_MODES) },
    date: { key: "date", codec: urlCodec.isoDate },
    dateFrom: { key: "from", codec: urlCodec.isoDate },
    dateTo: { key: "to", codec: urlCodec.isoDate },
    layout: { key: "layout", codec: urlCodec.oneOf(["grid", "list"] as const) },
    event: { key: "event", codec: urlCodec.text },
    kind: { key: "type", codec: urlCodec.oneOf(["lecture", "practice", "cycle"] as const) },
    room: { key: "room", codec: urlCodec.text },
};

type FilterDraft = Pick<CalendarUrl, "kind" | "room"> & Pick<ScheduleFilterValues, "subjectIds" | "weekdays" | "dateFrom" | "dateTo">;

const EMPTY_URL: CalendarUrl = {};
const validDate = (date?: string) => date && !Number.isNaN(Date.parse(date)) ? date : undefined;
const dateLabel = (date: string) => `${WEEKDAY_LABEL[isoWeekday(date)]}, ${formatDate(date)}`;
const lessonDate = (lesson: CalendarLesson) => lesson.from === lesson.to ? dateLabel(lesson.from) : formatRange(lesson.from, lesson.to);
const pickerDate = (date: string) => new Date(`${date}T00:00:00`);
const pickerDateFormat = new Intl.DateTimeFormat("sv-SE");

function useCalendar() {
    const [state, setState] = useUrlState(CALENDAR_URL, EMPTY_URL);
    const [today] = useState(todayIso);
    const [defaultMode] = useState<CalendarMode>(() => window.matchMedia("(max-width: 649px)").matches ? "day" : "week");
    return { state, setState, today, defaultMode };
}

export function SchedulePublicLink({ schedule }: { schedule: Schedule }) {
    const { search } = useLocation();
    const { state, today, defaultMode } = useCalendar();
    const url = new URL(ROUTE.PUBLIC.SCHEDULE, window.location.origin);
    for (const [key, value] of new URLSearchParams(search)) url.searchParams.set(key, value);
    url.searchParams.delete("section");
    const { timetable, filters } = schedule;
    if (timetable) {
        const { semester } = timetable;
        const range = resolveDateRange(filters);
        url.searchParams.set("period", state.mode ?? (range ? "range" : defaultMode));
        url.searchParams.set("date", semesterDate(validDate(state.date) ?? validDate(range?.from) ?? today, semester));
    }
    return <CommonShareLink url={url.href} label="Публичная ссылка" />;
}

export function ScheduleCalendar({ schedule, staff = false, showAudience = staff }: { schedule: Schedule; staff?: boolean; showAudience?: boolean }) {
    const { state, setState, today, defaultMode } = useCalendar();
    const [params, setParams] = useSearchParams();
    const [draft, setDraft] = useState<FilterDraft>();
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const { timetable, filters, options, changeFilters, view } = schedule;
    if (!timetable || !view) return null;

    const { semester } = timetable;
    const legacyRange = resolveDateRange(filters);
    const mode = state.mode ?? (legacyRange ? "range" : defaultMode);
    const date = semesterDate(validDate(state.date) ?? validDate(legacyRange?.from) ?? today, semester);
    const range = calendarPeriod(mode, date, semester, filters);
    const lessons = calendarLessons(timetable, filters, range)
        .filter((lesson) => (!state.kind || state.kind === lesson.kind) && (!state.room || state.room === lesson.location));
    const periodIds = new Set(timetable.periods.filter((period) => period.from <= range.to && period.to >= range.from).map(({ id }) => id));
    const periods = view.periods.filter(({ id }) => periodIds.has(id));
    const selected = lessons.find((lesson) => lesson.id === state.event);
    const list = (state.layout ?? (params.get("view") === "cards" ? "list" : "grid")) === "list";
    const days = calendarDays(range);
    const step = mode === "week" ? 7 : 1;
    const paged = mode === "day" || mode === "week";
    const weekStart = offsetDate(date, 1 - isoWeekday(date));
    const weekOptions: { value: string; label: string }[] = [];
    for (let start = offsetDate(semester.start, 1 - isoWeekday(semester.start)); start <= semester.end; start = offsetDate(start, 7)) {
        const from = semesterDate(start, semester);
        const to = semesterDate(offsetDate(start, 6), semester);
        weekOptions.push({ value: start, label: `${weekOptions.length + 1} · ${formatDayMonth(from)} – ${formatDayMonth(to)}` });
    }
    const week = weekOptions.findIndex((option) => option.value === weekStart) + 1;
    const rooms = [...new Set([...timetable.entries, ...timetable.lectures].flatMap((entry) => entry.room ? [entry.room] : []))].sort();
    const activeFilters = [
        ...(!showAudience && filters.groupId ? [{ label: `Группа ${filters.groupId}`, clear: () => changeFilters({ groupId: undefined }) }] : []),
        ...options.subjects.filter(({ value }) => filters.subjectIds.includes(value)).map(({ label, value }) => ({
            label, clear: () => changeFilters({ subjectIds: filters.subjectIds.filter((id) => id !== value) }),
        })),
        ...(state.kind ? [{ label: KIND_LABELS[state.kind], clear: () => setState({ ...state, kind: undefined }) }] : []),
        ...(state.room ? [{ label: state.room, clear: () => setState({ ...state, room: undefined }) }] : []),
    ];

    const selectPeriod = (nextMode: CalendarMode, nextDate = date) => {
        setDraft(undefined);
        setState({ ...state, mode: nextMode, date: semesterDate(nextDate, semester), dateFrom: undefined, dateTo: undefined, event: undefined });
    };
    const applyFilters = (nextFilters: FilterDraft) => {
        setDraft(undefined);
        setParams((current) => {
            const next = new URLSearchParams(current);
            const values = {
                subjects: nextFilters.subjectIds.filter((id) => options.subjects.some(({ value }) => value === id)).join(","),
                days: nextFilters.weekdays.join(","),
                type: nextFilters.kind,
                room: rooms.includes(nextFilters.room ?? "") ? nextFilters.room : undefined,
                from: nextFilters.dateFrom,
                to: nextFilters.dateTo,
            };
            for (const [key, value] of Object.entries(values)) {
                if (value) next.set(key, value);
                else next.delete(key);
            }
            if (nextFilters.dateFrom !== filters.dateFrom || nextFilters.dateTo !== filters.dateTo) {
                if (nextFilters.dateFrom || nextFilters.dateTo) next.set("period", "range");
                else if (mode === "range") next.delete("period");
            }
            next.delete("event");
            return next;
        }, { replace: true });
    };
    const renderLesson = (lesson: CalendarLesson, compact = false) => (
        <button
            type="button"
            key={lesson.id}
            className={cn("block w-full min-w-0 cursor-pointer rounded-lg text-left hover:brightness-95 dark:hover:brightness-110", compact && "h-full")}
            onClick={() => setState({ ...state, event: lesson.id })}
        >
            <ScheduleLessonCard lesson={lesson} compact={compact} className={compact ? "h-full" : undefined} />
        </button>
    );

    return (
        <div className="grid min-w-0 gap-4">
            <Card className="gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {paged ? (
                            <div className="inline-flex items-center gap-2">
                                <Button type="button" size="icon-sm" variant="outline" aria-label="Предыдущий период" disabled={range.from <= semester.start} onClick={() => selectPeriod(mode, offsetDate(date, -step))}>
                                    <ChevronLeftIcon />
                                </Button>
                                <strong className="whitespace-nowrap text-sm tabular-nums">
                                    {mode === "day" ? dateLabel(date) : formatRange(range.from, range.to)}
                                </strong>
                                <Button type="button" size="icon-sm" variant="outline" aria-label="Следующий период" disabled={range.to >= semester.end} onClick={() => selectPeriod(mode, offsetDate(date, step))}>
                                    <ChevronRightIcon />
                                </Button>
                            </div>
                        ) : (
                            <strong className="text-sm tabular-nums">{mode === "term" ? semester.label : formatRange(range.from, range.to)}</strong>
                        )}
                        <Button type="button" size="sm" variant="ghost" onClick={() => selectPeriod(mode === "range" ? "day" : mode, today)}>Сегодня</Button>
                        {mode === "week" && <Badge variant="outline">Неделя {week} из {weekOptions.length}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Период">
                            {MODES.map(({ value, label }) => (
                                <Button key={value} type="button" size="sm" variant={mode === value ? "outline" : "ghost"} aria-pressed={mode === value} onClick={() => selectPeriod(value)}>{label}</Button>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" aria-expanded={Boolean(draft)} aria-controls="schedule-filters" onClick={() => setDraft(draft ? undefined : { ...filters, kind: state.kind, room: state.room })}>
                            <SlidersHorizontalIcon /> {staff ? "Другие фильтры" : "Фильтры"}
                        </Button>
                    </div>
                </div>

                {(showAudience || paged) && <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                    {showAudience && <div className="flex flex-wrap items-end gap-2">
                        <ScheduleFilters schedule={schedule} />
                    </div>}
                    <div className="flex flex-wrap items-end gap-2">
                        {mode === "week" && (
                            <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Вид недели">
                                <Button type="button" size="sm" variant={list ? "ghost" : "outline"} aria-pressed={!list} onClick={() => setState({ ...state, layout: "grid" })}>Сетка</Button>
                                <Button type="button" size="sm" variant={list ? "outline" : "ghost"} aria-pressed={list} onClick={() => setState({ ...state, layout: "list" })}>Список</Button>
                            </div>
                        )}
                        {paged && (
                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="gap-3 font-normal tabular-nums" aria-label={`Перейти к дате, выбрано ${formatDate(date)}`}>
                                        {formatDate(date)}
                                        <CalendarIcon className="text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" collisionPadding={12} className="w-auto rounded-lg p-0" aria-label="Выбор даты">
                                    <Calendar
                                        mode="single"
                                        required
                                        autoFocus
                                        locale={ru}
                                        today={pickerDate(today)}
                                        selected={pickerDate(date)}
                                        defaultMonth={pickerDate(date)}
                                        startMonth={pickerDate(semester.start)}
                                        endMonth={pickerDate(semester.end)}
                                        disabled={{ before: pickerDate(semester.start), after: pickerDate(semester.end) }}
                                        onSelect={(day) => {
                                            selectPeriod(mode, pickerDateFormat.format(day));
                                            setDatePickerOpen(false);
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </div>}
                <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                    <div className="grid gap-2">
                        <p className="text-xs text-muted-foreground">{semester.label} · {formatRange(semester.start, semester.end)} · {weekOptions.length} нед.</p>
                        {weekOptions.length > 1 && (
                            <div className="inline-flex w-fit flex-wrap gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Чётность недели">
                                {[{ label: "Нечётные недели", parity: 1 }, { label: "Чётные недели", parity: 0 }].map(({ label, parity }) => {
                                    const current = week % 2 === parity;
                                    const target = current ? week : week < weekOptions.length ? week + 1 : week - 1;
                                    return (
                                        <Button key={parity} type="button" size="xs" variant={current ? "outline" : "ghost"} aria-pressed={current} onClick={() => selectPeriod("week", weekOptions[target - 1].value)}>
                                            {label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <CommonFilterSelect label="Неделя семестра" value={weekStart} options={weekOptions} onChange={(value) => value && selectPeriod("week", value)} />
                </div>
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {activeFilters.map(({ label, clear }, index) => <Button key={index} type="button" size="xs" variant="outline" onClick={clear}>{label} ×</Button>)}
                    </div>
                )}
                <div id="schedule-filters" hidden={!draft} className="border-t pt-3">
                    {draft && (
                        <form className="grid gap-3" onSubmit={(event) => {
                            event.preventDefault();
                            applyFilters(draft);
                        }}>
                            <div className="flex flex-wrap items-end gap-3">
                                {!showAudience && <ScheduleFilters schedule={schedule} />}
                                <CommonFilterSelect label="Тип события" value={draft.kind} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))} allLabel="Все типы" onChange={(value) => setDraft({ ...draft, kind: value as CalendarUrl["kind"] })} />
                                <CommonFilterSelect label="Аудитория или площадка" value={draft.room} options={rooms.map((value) => ({ value, label: value }))} allLabel="Все площадки" onChange={(room) => setDraft({ ...draft, room })} />
                                <CommonFilterDateRange label="Даты" from={draft.dateFrom} to={draft.dateTo} min={semester.start} max={semester.end} onChange={({ from, to }) => setDraft({ ...draft, dateFrom: from, dateTo: to })} />
                                {timetable.format === "weekly" && (
                                    <CommonFilterChips label="Дни недели" options={options.weekdays} value={draft.weekdays} onChange={(weekdays) => setDraft({ ...draft, weekdays })} />
                                )}
                                <CommonFilterChips label="Дисциплины" options={options.subjects} value={draft.subjectIds} onChange={(subjectIds) => setDraft({ ...draft, subjectIds })} className="basis-full" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" size="sm">Применить</Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => applyFilters({ subjectIds: [], weekdays: [] })}>Сбросить</Button>
                            </div>
                        </form>
                    )}
                </div>
            </Card>

            {periods.length > 0 && (
                <div className="grid gap-2">
                    {mode === "term" && <h3 className="text-sm font-medium">Периоды семестра</h3>}
                    <SchedulePeriods periods={periods} />
                </div>
            )}
            {mode === "day" && timetable.periods.filter((period) => period.kind === "holiday" && period.from <= date && period.to >= date).map((period) => (
                <Card key={period.id} className="px-4 py-3 text-sm">{period.label}</Card>
            ))}
            <small className="text-muted-foreground" aria-live="polite">Занятий: {lessons.length}</small>
            {lessons.length === 0 && (
                <Empty className="rounded-xl border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><CalendarSearchIcon /></EmptyMedia>
                        <EmptyTitle>По выбранным условиям занятий нет</EmptyTitle>
                        <EmptyDescription>Измените период или снимите один из фильтров.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            {mode === "week" && !list ? (
                <WeekBoard days={days} lessons={lessons} today={today} holidays={timetable.periods.filter(({ kind }) => kind === "holiday")} onDay={(day) => selectPeriod("day", day)} renderLesson={renderLesson} />
            ) : (
                <div className="grid max-w-4xl gap-2">
                    {lessons.map((lesson) => (
                        <div key={lesson.id} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                            <span className="text-xs text-muted-foreground sm:py-2">{lessonDate(lesson)}</span>
                            {renderLesson(lesson)}
                        </div>
                    ))}
                </div>
            )}
            <ScheduleOverview timetable={timetable} view={view} />
            <Dialog open={Boolean(state.event)} onOpenChange={(open) => {
                if (!open) setState({ ...state, event: undefined });
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selected?.title ?? "Занятие недоступно"}</DialogTitle>
                        <DialogDescription>
                            {selected ? `${lessonDate(selected)}${selected.time ? ` · ${selected.time}` : ""}` : "Проверьте ссылку или откройте занятие из расписания."}
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <>
                            <section className="grid gap-2">
                                <h3 className="font-medium">О занятии</h3>
                                <ScheduleLessonCard lesson={{ ...selected, time: undefined, location: undefined }} />
                            </section>
                            {selected.location && <section className="grid gap-1">
                                <h3 className="font-medium">Место проведения</h3>
                                <p>{selected.location}</p>
                            </section>}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function WeekBoard({ days, lessons, today, holidays, onDay, renderLesson }: {
    days: string[];
    lessons: CalendarLesson[];
    today: string;
    holidays: { from: string; to: string }[];
    onDay: (day: string) => void;
    renderLesson: (lesson: CalendarLesson, compact?: boolean) => React.ReactNode;
}) {
    const timeColumns = days.map((day) => {
        const lanes: number[] = [];
        const events = lessons.flatMap((lesson) => {
            if (lesson.from !== day || !lesson.start) return [];
            const start = Math.floor(toMinutes(lesson.start) / 5) * 5;
            const end = Math.max(lesson.end ? Math.ceil(toMinutes(lesson.end) / 5) * 5 : start, start + 30);
            const index = lanes.findIndex((time) => time <= start);
            const lane = index < 0 ? lanes.length : index;
            lanes[lane] = end;
            return [{ lesson, start, end, lane }];
        });
        return { day, events, lanes: Math.max(1, lanes.length) };
    });
    const timed = timeColumns.flatMap(({ events }) => events);
    const morning = 8 * 60 + 30;
    const evening = 20 * 60 + 30;
    const from = Math.min(morning, ...timed.map(({ start }) => morning + Math.floor((start - morning) / 60) * 60));
    const to = Math.max(evening, ...timed.map(({ end }) => evening + Math.ceil((end - evening) / 60) * 60));
    const hourCount = (to - from) / 60;
    const row = (minutes: number) => (minutes - from) / 5 + 1;
    const timeline = {
        gridTemplateRows: `repeat(${(to - from) / 5}, 7px)`,
        backgroundImage: "repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px 84px)",
    };
    const timeLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const blocks = lessons.filter((lesson) => !lesson.start);

    return (
        <Card className="gap-0 overflow-hidden p-0">
            <div className="overflow-x-auto" role="region" aria-label="Недельная сетка" tabIndex={0}>
                <div className="grid" style={{ gridTemplateColumns: `88px ${timeColumns.map(({ lanes }) => `minmax(${lanes * 152}px, ${lanes}fr)`).join(" ")}` }}>
                    <div className="sticky left-0 z-10 bg-card">
                        <div className="flex h-12 items-center border-b bg-muted px-2 text-xs font-medium">Время</div>
                        <div className="grid" style={timeline}>
                            {Array.from({ length: hourCount }, (_, hour) => {
                                const time = from + hour * 60;
                                return (
                                    <div key={time} className="px-2 pt-2 text-xs font-medium tabular-nums" style={{ gridRow: `${row(time)} / span 12` }}>
                                        {timeLabel(time)}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="border-t px-2 py-1 text-xs tabular-nums">{timeLabel(to)}</div>
                    </div>
                    {timeColumns.map(({ day, events, lanes }) => (
                        <section key={day} className="min-w-0 border-l" aria-label={dateLabel(day)}>
                            <div className={cn("flex h-12 flex-wrap items-center gap-1 border-b bg-muted/50 px-1", day === today && "bg-primary/10")}>
                                <Button type="button" variant="ghost" size="sm" aria-label={dateLabel(day)} onClick={() => onDay(day)}>
                                    {WEEKDAY_SHORT_LABEL[isoWeekday(day)]}, {formatDayMonth(day)}
                                </Button>
                                {holidays.some((period) => day >= period.from && day <= period.to)
                                    ? <Badge variant="outline">Праздник</Badge>
                                    : day === today && <Badge variant="secondary">Сегодня</Badge>}
                            </div>
                            <div className="grid" style={{ ...timeline, gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))` }}>
                                {events.map(({ lesson, start, end, lane }) => (
                                    <div key={lesson.id} className="min-w-0 p-0.5" style={{ gridArea: `${row(start)} / ${lane + 1} / ${row(end)}` }}>
                                        {renderLesson(lesson, true)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
            {blocks.length > 0 && (
                <div className="grid gap-2 border-t p-3">
                    <h3 className="text-sm font-medium">Учебные циклы</h3>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {blocks.map((lesson) => (
                            <div key={lesson.id} className="grid gap-1">
                                <span className="text-xs text-muted-foreground">{lessonDate(lesson)}</span>
                                {renderLesson(lesson)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}
