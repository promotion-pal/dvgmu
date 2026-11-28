import { useRef, useState, type ReactNode } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";
import type { Event, PublicEvent } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { EventStatus, EventType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { useUserProvider } from "@/features/provider/user.provider";
import { CommonFilter, CommonFilterDateRange, CommonFilterSelect } from "@/shared/components/filter";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { ROUTE } from "@/shared/config/path";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { SchedulaCatalog } from "./schedula-catalog.ui";
import { SchedulaChanges } from "./schedula-changes.ui";
import { SchedulaCompleteness } from "./schedula-completeness.ui";
import { SchedulaEditor } from "./schedula-editor.ui";
import { useSchedula } from "./schedula.fn";
import { addDays, changeTypes, dateLabel, eventFields, eventStatuses, eventTime, eventTypes, periodTypes, publicScheduleParams, scheduleDate, scheduleWeek, timeLabel, today } from "./schedula.utils";

type EditorState = { kind: "event"; event?: Event } | { kind: "slots" } | { kind: "catalog" } | { kind: "completeness" } | { kind: "change"; event: Event };
type CalendarEvent = Event | PublicEvent;
type AudienceLink = (group?: string, course?: number, subgroup?: string) => string;
type VenueLink = (event: Event) => string;

export function Schedula({ publicView = false }: { publicView?: boolean }) {
    const roles = useUserProvider((s) => s.user?.roles);
    const userId = useUserProvider((s) => s.user?.uuid);
    const teacher = roles?.includes(UserRole.TEACHER) ?? false;
    const student = roles?.includes(UserRole.STUDENT) ?? false;
    const admin = roles?.includes(UserRole.ADMIN) ?? false;
    const { search, hash, state: locationState } = useLocation();
    const navigate = useNavigate();
    const mobile = useIsMobile();
    const { filter, setFilter, personal, state, catalog, catalogError, reload } = useSchedula(publicView, !admin && (student || teacher));
    const [editor, setEditor] = useState<EditorState>();
    const cardTrigger = useRef<HTMLAnchorElement>(null);
    const internal = state?.kind === "private" ? state.result : undefined;
    const external = state?.kind === "public" ? state.result : undefined;
    const showSubgroupFilter = !publicView && (!student || teacher || !!(internal?.canEdit || internal?.canPublish ||
        internal?.canSearchSlots || internal?.canReviewChanges || internal?.canViewReports || internal?.canEditCatalog));
    const events = internal?.events ?? external?.events ?? [];
    const transfers = internal?.transfers ?? [];
    const periods = internal?.periods ?? [];
    const from = filter.dateFrom ?? filter.dateTo ?? internal?.dateFrom ?? external?.dateFrom;
    const to = filter.dateTo ?? filter.dateFrom ?? internal?.dateTo ?? external?.dateTo;
    const week = internal?.academicWeek ?? external?.academicWeek ?? 0;
    const lists = catalog?.catalog;
    const currentTerm = lists?.terms.find((term) => term.dateFrom === from && term.dateTo === to);
    const sites = lists?.sites ?? external?.sites;
    const siteNames = new Map(sites?.map(({ id, name }) => [id, name]));
    const rooms = lists?.rooms.map(({ id, name, site }) => ({ id, name, siteId: site?.id ?? "" })) ?? external?.rooms;
    const selectOptions = (rows: { id: string; name: string }[] = [], selected?: string) => {
        const options = rows.map(({ id, name }) => ({ value: id, label: name }));
        if (selected && !options.some((item) => item.value === selected)) options.push({ value: selected, label: selected });
        return options;
    };

    const close = () => setEditor(undefined);
    const saved = () => { close(); reload(); };
    const calendarDay = today();
    const oneDay = Boolean(from && to && from === to);
    const weekRange = Boolean(from && to && to > from && to <= addDays(from, 6));
    const showGrid = weekRange && (filter.layout === "grid" || (!mobile && filter.layout !== "list"));
    const selectRange = (dateFrom: string, dateTo = dateFrom) => setFilter((f) => ({ ...f, dateFrom, dateTo }));
    const move = (step: number) => {
        if (!from || !to) return;
        const first = scheduleDate(addDays(from, step));
        const last = scheduleDate(addDays(to, step));
        if (first && last) selectRange(first, last);
    };
    const jumpToWeek = (date: string) => {
        const range = scheduleWeek(date);
        if (scheduleDate(range.from) && scheduleDate(range.to)) selectRange(range.from, range.to);
    };

    const publicLink = (event?: CalendarEvent) => {
        if (!from || !to) return undefined;
        const url = new URL(ROUTE.PUBLIC.SCHEDULA, window.location.origin);
        const params = publicScheduleParams(search, from, to);
        if (personal && student && event?.$typeName === "contract.schedula.entity.Event" && event.details?.audiences.length === 1) {
            params.set("group", event.details.audiences[0].group);
        }
        url.search = params.toString();
        if (event) url.hash = new URLSearchParams({ event: event.id }).toString();
        return url.toString();
    };
    const shareUrl = publicLink();
    const back = new URLSearchParams(search).get("back");
    const backParams = new URLSearchParams(back ?? search);
    backParams.delete("back");
    const scopeBack = backParams.toString();
    const scopeLink = (filters: Record<string, string | undefined>) => {
        const params = new URLSearchParams(search);
        for (const [key, value] of Object.entries(filters)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        if (from && to) {
            params.set("from", from);
            params.set("to", to);
        }
        if (!publicView) params.set("view", "all");
        params.set("back", scopeBack);
        return "?" + params.toString();
    };
    const audienceLink: AudienceLink = (group, course, subgroup) => scopeLink({
        group, course: course ? String(course) : undefined, subgroup: publicView ? undefined : subgroup,
    });
    const venueLink: VenueLink = (event) => {
        const params = new URLSearchParams(scopeLink({
            site: event.room?.site?.id, room: event.room?.id,
            group: undefined, subgroup: undefined, course: undefined, teacher: undefined, subject: undefined, type: undefined, sources: undefined,
        }));
        if (event.details?.date) {
            params.set("from", event.details.date);
            params.set("to", event.details.date);
        }
        return "?" + params.toString();
    };
    const selectedId = new URLSearchParams(hash.slice(1)).get("event");
    const selected = selectedId ? (events.find(({ id }) => id === selectedId) ?? transfers.find(({ id }) => id === selectedId)) : undefined;
    const eventLink = (event: CalendarEvent) => ({
        search,
        hash: new URLSearchParams({ event: event.id }).toString(),
    });
    const closeCard = () => {
        if (locationState?.scheduleCardOpened) navigate(-1);
        else void navigate({ search }, { replace: true, state: locationState, preventScrollReset: true });
    };
    const editEvent = (item: Event): EditorState | undefined => {
        if ((internal?.canEdit || internal?.canPublish) && item.status === EventStatus.DRAFT) return { kind: "event", event: item };
        if ((internal?.canReviewChanges || (internal?.canRequestChange && item.details?.instructorId === userId)) && item.status !== EventStatus.DRAFT) {
            return { kind: "change", event: item };
        }
    };

    const renderEvent = (event: CalendarEvent) => <EventCard key={event.id} event={event} audienceLink={audienceLink}
        venueLink={venueLink} to={eventLink(event)} onOpen={(trigger) => { cardTrigger.current = trigger; }} />;
    const workloads = new Map<string, { name: string; minutes: number }>();
    for (const item of internal?.events ?? []) {
        const minutes = item.details?.durationMinutes ?? 0;
        const instructor = item.details?.instructorId;
        if (item.status === EventStatus.PUBLISHED && instructor && item.instructorName && minutes > 0) {
            workloads.set(instructor, { name: item.instructorName, minutes: (workloads.get(instructor)?.minutes ?? 0) + minutes });
        }
    }
    const days = new Map<string, CalendarEvent[]>();
    for (const item of events) {
        const { date } = eventFields(item);
        const bucket = days.get(date) ?? [];
        bucket.push(item);
        days.set(date, bucket);
    }
    const selectedFields = selected && eventFields(selected);
    const selectedEdit = selected?.$typeName === "contract.schedula.entity.Event" ? editEvent(selected) : undefined;
    const selectedShare = selected && selected.status !== EventStatus.DRAFT && selected.status !== EventStatus.TRANSFER && publicLink(selected);
    const emptySchedule = <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">По выбранным условиям занятий нет.</p>;

    return (
        <div className="min-w-0 space-y-5">
            {back !== null && <Button asChild size="sm" variant="ghost">
                <Link replace to={{ search: scopeBack }}><ChevronLeftIcon />К исходной выборке</Link>
            </Button>}
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <CalendarDaysIcon className="size-5 shrink-0 text-primary" />
                        {publicView ? "Публичное расписание" : personal ? "Моё расписание" : "Расписание"}
                    </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!publicView && shareUrl && <CommonShareLink url={shareUrl} label="Публичная ссылка" />}
                    {internal?.canSearchSlots && catalog && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "slots" })}>Подобрать слот</Button>}
                    {internal?.canEditCatalog && catalog && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "catalog" })}>Справочники</Button>}
                    {internal?.canViewReports && catalog && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "completeness" })}>Полнота расписания</Button>}
                    {internal?.canEdit && catalog && <Button size="sm" onClick={() => setEditor({ kind: "event" })}>Создать черновик</Button>}
                </div>
            </header>

            {!publicView && (student || teacher) && <div className="flex flex-wrap gap-2" role="group" aria-label="Представление расписания">
                <Button size="sm" variant={personal ? "secondary" : "ghost"} aria-pressed={personal} onClick={() => setFilter((f) => ({
                        ...f, view: "mine", group: undefined, subgroup: undefined, course: undefined,
                }))}>Моё расписание</Button>
                <Button size="sm" variant={personal ? "ghost" : "secondary"} aria-pressed={!personal} onClick={() => setFilter((f) => ({ ...f, view: "all" }))}>
                    Общая сетка
                </Button>
            </div>}

            <div className="flex flex-wrap items-center gap-2">
                {(oneDay || weekRange) && <Button size="icon-sm" variant="ghost" aria-label="Предыдущий период"
                    onClick={() => move(oneDay ? -1 : -7)}><ChevronLeftIcon /></Button>}
                {from && to && <strong className="text-sm">{oneDay ? dateLabel(from) : `${dateLabel(from)} – ${dateLabel(to)}`}</strong>}
                {(oneDay || weekRange) && <Button size="icon-sm" variant="ghost" aria-label="Следующий период"
                    onClick={() => move(oneDay ? 1 : 7)}><ChevronRightIcon /></Button>}
                <Button size="sm" variant="ghost" onClick={() => selectRange(calendarDay)}>Сегодня</Button>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Масштаб расписания">
                    <Button size="sm" variant={oneDay ? "secondary" : "ghost"} aria-pressed={oneDay}
                        onClick={() => selectRange(from ?? calendarDay)}>День</Button>
                    <Button size="sm" variant={weekRange ? "secondary" : "ghost"} aria-pressed={weekRange}
                        onClick={() => jumpToWeek(from ?? calendarDay)}>Неделя</Button>
                </div>
                {week > 0 && (oneDay || weekRange) && <Badge variant="outline">{week}-я учебная неделя · {week % 2 === 0 ? "чётная" : "нечётная"}</Badge>}
                {weekRange && <div className="flex flex-wrap gap-1" role="group" aria-label="Вид недели">
                    <Button size="sm" variant={showGrid ? "secondary" : "ghost"} aria-pressed={showGrid}
                        onClick={() => setFilter((f) => ({ ...f, layout: "grid" }))}>Сетка</Button>
                    <Button size="sm" variant={showGrid ? "ghost" : "secondary"} aria-pressed={!showGrid}
                        onClick={() => setFilter((f) => ({ ...f, layout: "list" }))}>Список</Button>
                </div>}
            </div>

            <CommonFilter count={state?.kind === "error" || !state ? undefined : events.length} className="w-full">
                <CommonFilterDateRange label="Период" from={from} to={to} onChange={({ from, to }) => {
                    if (from) selectRange(from, to && to >= from ? to : from);
                    else setFilter((f) => ({ ...f, dateFrom: undefined, dateTo: undefined }));
                }} />
                {!!lists?.terms.length && <CommonFilterSelect label="Семестр" value={currentTerm?.id} allLabel="Выбрать семестр"
                    options={selectOptions(lists.terms)} onChange={(id) => {
                        const term = lists.terms.find((item) => item.id === id);
                        if (term) selectRange(term.dateFrom, term.dateTo);
                        else setFilter((f) => ({ ...f, dateFrom: undefined, dateTo: undefined }));
                    }} />}
                <FilterText label="Группа" value={filter.group} onChange={(group) => setFilter((f) => ({ ...f, group }))} />
                {showSubgroupFilter && <FilterText label="Подгруппа" value={filter.subgroup} onChange={(subgroup) => setFilter((f) => ({ ...f, subgroup }))} />}
                <CommonFilterSelect label="Курс" value={filter.course?.toString()} allLabel="Все"
                    onChange={(course) => setFilter((f) => ({ ...f, course: course ? Number(course) : undefined }))}
                    options={Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}-й курс` }))} />
                {!publicView && <CommonFilterSelect label="Преподаватель" allLabel="Все" value={filter.instructorId}
                    options={selectOptions(catalog?.instructors, filter.instructorId)}
                    onChange={(instructorId) => setFilter((f) => ({ ...f, instructorId }))} />}
                <CommonFilterSelect label="Дисциплина" allLabel="Все" value={filter.subjectId}
                    options={selectOptions(lists?.subjects ?? external?.subjects, filter.subjectId)}
                    onChange={(subjectId) => setFilter((f) => ({ ...f, subjectId }))} />
                <CommonFilterSelect label="Корпус или база" allLabel="Все" value={filter.siteId}
                    options={selectOptions(sites, filter.siteId)}
                    onChange={(siteId) => setFilter((f) => ({ ...f, siteId }))} />
                <CommonFilterSelect label="Площадка" allLabel="Все" value={filter.roomId}
                    options={selectOptions(rooms?.map(({ id, name, siteId }) => ({
                        id, name: [name, siteNames.get(siteId)].filter(Boolean).join(" · "),
                    })), filter.roomId)}
                    onChange={(roomId) => setFilter((f) => ({ ...f, roomId }))} />
                <CommonFilterSelect label="Тип события" allLabel="Все" value={filter.type?.toString()}
                    options={Object.entries(eventTypes).slice(1).map(([value, label]) => ({ value, label }))}
                    onChange={(kind) => setFilter((f) => ({ ...f, type: kind ? Number(kind) : undefined }))} />
                {!publicView && <CommonFilterSelect label="Источники" allLabel="Учёба и тестирование"
                    value={filter.sources?.includes(EventType.COMPUTER_CLASS_TEST) ? "testing" : filter.sources?.length ? "study" : undefined}
                    options={[{ value: "study", label: "Учебное расписание" }, { value: "testing", label: "Компьютерные классы" }]}
                    onChange={(source) => setFilter((f) => ({
                        ...f,
                        sources: source === "testing" ? [EventType.COMPUTER_CLASS_TEST]
                            : source === "study" ? Object.keys(eventTypes).map(Number).filter((type) => type > 0 && type !== EventType.COMPUTER_CLASS_TEST) : undefined,
                    }))} />}
                <Button size="sm" variant="ghost" onClick={() => setFilter({ view: filter.view, layout: filter.layout })}>Сбросить</Button>
            </CommonFilter>

            {catalogError && !publicView && <p role="alert" className="text-sm text-destructive">{catalogError.rawMessage}</p>}
            <CommonControlState isLoading={!state} isError={state?.kind === "error"} isEmpty={!events.length && !transfers.length && !periods.length}
                empty={emptySchedule}
                error={<CommonServiceError service="schedula" hint={state?.kind === "error" ? state.error.rawMessage : undefined} onRetry={reload} />}>
                {periods.length > 0 && <section className="mb-4 flex flex-wrap gap-2" aria-label="Учебные периоды">
                    {periods.map((period) => {
                        const audience = period.audience;
                        const label = [audience?.group, audience?.subgroup].filter(Boolean).join(" ") || (audience?.course ? `${audience.course}-й курс` : "");
                        return <Badge key={period.id} variant="secondary" className="whitespace-normal">
                            {[label, periodTypes[period.type], `${dateLabel(period.dateFrom)} – ${dateLabel(period.dateTo)}`].filter(Boolean).join(" · ")}
                        </Badge>;
                    })}
                </section>}
                {!events.length ? emptySchedule :
                    showGrid && from && to ? <WeekGrid from={from} to={to} today={calendarDay} days={days} onDay={selectRange} renderEvent={renderEvent} /> :
                    <div className="max-w-4xl space-y-4">
                        {[...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => <section key={day} className="min-w-0 space-y-2">
                            <h2 className="text-sm font-semibold">{dateLabel(day)}</h2>
                            {items.map(renderEvent)}
                        </section>)}
                    </div>}
                {internal?.canViewReports && workloads.size > 0 && weekRange && <details className="mt-4 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Нагрузка преподавателей за выбранный период</summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {[...workloads].map(([id, { name, minutes }]) => <li key={id}>{name} · {new Intl.NumberFormat("ru-RU", {
                            maximumFractionDigits: 2,
                        }).format(minutes / 60)} ч.</li>)}
                    </ul>
                </details>}
                {transfers.length > 0 && <section className="mt-6 space-y-2">
                    <h2 className="font-semibold">Перенос</h2>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{transfers.map(renderEvent)}</div>
                </section>}
            </CommonControlState>

            <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) closeCard(); }}>
                <DialogContent onCloseAutoFocus={(event) => {
                    const trigger = cardTrigger.current;
                    cardTrigger.current = null;
                    if (trigger?.isConnected) {
                        event.preventDefault();
                        trigger.focus({ preventScroll: true });
                    }
                }}>
                    <DialogHeader>
                        <DialogTitle>{selected?.subject?.name ?? (state ? "Занятие недоступно" : "Загрузка занятия")}</DialogTitle>
                        <DialogDescription>
                            {selectedFields ? dateLabel(selectedFields.date) : state ? "Проверьте ссылку или откройте занятие из расписания." : "Загружаем выбранный период."}
                        </DialogDescription>
                    </DialogHeader>
                    {selected && <EventCard event={selected} audienceLink={audienceLink} venueLink={venueLink} />}
                    {(selectedEdit || (!publicView && selectedShare)) && <div className="flex flex-wrap gap-2">
                        {selectedEdit && <Button size="sm" onClick={() => { closeCard(); setEditor(selectedEdit); }}>
                            {selectedEdit.kind === "event" ? "Открыть черновик" : "Изменения"}
                        </Button>}
                        {!publicView && selectedShare && <CommonShareLink url={selectedShare} label="Публичная ссылка" />}
                    </div>}
                </DialogContent>
            </Dialog>

            {internal?.canViewReports && lists && editor?.kind === "completeness" && <SchedulaCompleteness terms={lists.terms} date={from} onClose={close}
                onEvent={internal.canEdit || internal.canPublish ? (event) => setEditor({ kind: "event", event }) : undefined}
                onAudience={(term, audience) => {
                    setFilter({ view: "all", dateFrom: term.dateFrom, dateTo: term.dateTo, course: audience.course,
                        group: audience.group || undefined, subgroup: audience.subgroup || undefined });
                    close();
                }} />}
            {internal?.canEditCatalog && catalog && editor?.kind === "catalog" && <SchedulaCatalog catalog={catalog.catalog} onClose={close} onSaved={saved} />}
            {internal && catalog && editor && ((editor.kind === "slots" && internal.canSearchSlots) ||
                (editor.kind === "event" && (internal.canEdit || (internal.canPublish && editor.event)))) && <SchedulaEditor catalog={catalog}
                event={editor.kind === "event" ? editor.event : undefined} slotsOnly={editor.kind === "slots"}
                canEdit={internal.canEdit} canPublish={internal.canPublish}
                suggestedDate={from} suggestedRoomId={filter.roomId} onClose={close} onSaved={saved} />}
            {catalog && editor?.kind === "change" && <SchedulaChanges event={editor.event} catalog={catalog} canDecide={internal?.canReviewChanges ?? false}
                canSubmit={!!internal?.canReviewChanges || (!!internal?.canRequestChange && editor.event.details?.instructorId === userId)}
                onClose={close} onSaved={reload} />}
        </div>
    );
}

function FilterText({ label, value, onChange }: { label: string; value?: string; onChange: (value: string | undefined) => void }) {
    return <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <Input key={value} defaultValue={value} className="h-9 w-28 bg-background"
            onBlur={(e) => {
                const next = e.currentTarget.value.trim() || undefined;
                if (next !== value) onChange(next);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
    </label>;
}

function WeekGrid({ from, to, today, days, onDay, renderEvent }: {
    from: string; to: string; today: string; days: Map<string, CalendarEvent[]>;
    onDay: (date: string) => void; renderEvent: (event: CalendarEvent) => ReactNode;
}) {
    const columns: { date: string; slots: Map<number | undefined, CalendarEvent[]> }[] = [];
    const startTimes = new Set<number>();
    let hasUntimed = false;
    for (let date = from; date <= to; date = addDays(date, 1)) {
        const slots = new Map<number | undefined, CalendarEvent[]>();
        for (const event of days.get(date) ?? []) {
            const { start } = eventFields(event);
            if (start === undefined) hasUntimed = true;
            else startTimes.add(start);
            const events = slots.get(start) ?? [];
            events.push(event);
            slots.set(start, events);
        }
        columns.push({ date, slots });
    }
    const rows: (number | undefined)[] = Array.from(startTimes).sort((a, b) => a - b);
    if (hasUntimed) rows.push(undefined);
    const unscheduled = days.get("") ?? [];

    return <>
        <div className="overflow-x-auto rounded-xl border" role="region" aria-label="Недельная сетка" tabIndex={0}>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/70">
                        <th scope="col" className="sticky left-0 min-w-20 bg-muted px-3 py-2 font-medium">Время</th>
                        {columns.map(({ date }) => <th scope="col" key={date} className={cn("min-w-40 border-l px-1 py-1", date === today && "bg-primary/10")}>
                            <Button size="sm" variant="ghost" onClick={() => onDay(date)}>{dateLabel(date)}</Button>
                        </th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((start) => <tr key={start ?? "untimed"} className="border-b last:border-b-0">
                        <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 align-top text-xs">
                            {start === undefined ? "Без времени" : timeLabel(start)}
                        </th>
                        {columns.map(({ date, slots }) => <td key={date} className="border-l p-1 align-top">
                            <div className="space-y-1">{slots.get(start)?.map(renderEvent)}</div>
                        </td>)}
                    </tr>)}
                </tbody>
            </table>
        </div>
        {unscheduled.length > 0 && <section className="mt-4 max-w-4xl space-y-2">
            <h2 className="text-sm font-semibold">Дата не назначена</h2>
            {unscheduled.map(renderEvent)}
        </section>}
    </>;
}

function EventCard({ event, audienceLink, venueLink, to, onOpen }: {
    event: CalendarEvent;
    audienceLink: AudienceLink;
    venueLink: VenueLink;
    to?: { search: string; hash: string };
    onOpen?: (trigger: HTMLAnchorElement) => void;
}) {
    const { date, start, duration, kind, groups, location, point, instructor } = eventFields(event);
    const item = event.$typeName === "contract.schedula.entity.Event" ? event : undefined;
    const status = eventStatuses[event.status];
    const variant = event.status === EventStatus.CANCELLED ? "destructive" : "secondary";
    const title = event.subject?.name || eventTypes[kind];
    const linkStyle = "underline-offset-4 hover:underline focus-visible:underline";
    const content = <>
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">{eventTime(start, duration)}</span>
            <Badge variant="outline" className="whitespace-normal">{eventTypes[kind]}</Badge>
            {status && <Badge variant={variant}>{status}</Badge>}
        </div>
        {to && <h3 className="mt-2 font-semibold break-words">
            <Link to={to} state={{ scheduleCardOpened: true }} preventScrollReset className={linkStyle}
                onClick={(click) => onOpen?.(click.currentTarget)}>{title}</Link>
        </h3>}
        {groups.length > 0 && <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {groups.map(({ group, subgroup, course }) => <span key={`${group}/${subgroup}`} className="inline-flex flex-wrap items-center gap-x-1">
                <Link to={audienceLink(group, course)} replace={!to} preventScrollReset className={linkStyle}>{group}</Link>
                {subgroup && <Link to={audienceLink(group, course, subgroup)} replace={!to} preventScrollReset className={linkStyle}>
                    Подгруппа {subgroup}
                </Link>}
            </span>)}
            {[...new Set(groups.flatMap(({ course }) => course ? [course] : []))].map((course) =>
                <Link key={course} to={audienceLink(undefined, course)} replace={!to} preventScrollReset className={linkStyle}>{course}-й курс</Link>)}
        </div>}
        {instructor && <p className="mt-2 break-words text-xs">{instructor}</p>}
        {location && <p className="mt-1 break-words text-xs">
            {item?.room?.id && !to ? <Link to={venueLink(item)} replace preventScrollReset className={linkStyle}
                title="Открыть расписание площадки на эту дату">{location}</Link> : location}
        </p>}
        {event.status === EventStatus.TRANSFER && date && to && <p className="mt-1 text-xs text-muted-foreground">{dateLabel(date)}</p>}
        {point && <p className="mt-1 break-words text-xs text-muted-foreground">Точка сбора · {point}</p>}
        {event.change !== 0 && event.status !== EventStatus.CANCELLED && <p className="mt-1 text-xs text-primary">{changeTypes[event.change]}</p>}
    </>;
    return to ? <article className="min-w-0 rounded-xl border bg-card p-3 text-sm shadow-xs">{content}</article>
        : <div className="min-w-0 text-sm">{content}</div>;
}
