import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";
import type { Event, PublicEvent } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { EventStatus, EventType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { useUserProvider } from "@/features/provider/user.provider";
import { CommonFilter, CommonFilterDateRange, CommonFilterSelect } from "@/shared/components/filter";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { SchedulaCatalog } from "./schedula-catalog.ui";
import { SchedulaChanges } from "./schedula-changes.ui";
import { SchedulaCompleteness } from "./schedula-completeness.ui";
import { SchedulaEditor } from "./schedula-editor.ui";
import { useSchedula } from "./schedula.fn";
import { addDays, changeTypes, dateLabel, eventStatuses, eventTime, eventTypes, periodTypes, today } from "./schedula.utils";

type EditorState = { kind: "event"; event?: Event } | { kind: "slots" } | { kind: "catalog" } | { kind: "completeness" } | { kind: "change"; event: Event };

export function Schedula({ publicView = false }: { publicView?: boolean }) {
    const roles = useUserProvider((s) => s.user?.roles);
    const userId = useUserProvider((s) => s.user?.uuid);
    const teacher = roles?.includes(UserRole.TEACHER) ?? false;
    const student = roles?.includes(UserRole.STUDENT) ?? false;
    const admin = roles?.includes(UserRole.ADMIN) ?? false;
    const { search } = useLocation();
    const { filter, setFilter, personal, state, catalog, catalogError, reload } = useSchedula(publicView, !admin && (student || teacher));
    const [editor, setEditor] = useState<EditorState>();
    const internal = state?.kind === "private" ? state.result : undefined;
    const external = state?.kind === "public" ? state.result : undefined;
    const events = internal?.events ?? external?.events ?? [];
    const transfers = internal?.transfers ?? [];
    const periods = internal?.periods ?? [];
    const from = filter.dateFrom ?? internal?.dateFrom ?? external?.dateFrom;
    const to = filter.dateTo ?? internal?.dateTo ?? external?.dateTo;
    const week = internal?.academicWeek ?? external?.academicWeek ?? 0;
    const lists = catalog?.catalog;
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
    const move = (days: number) => {
        const first = from ?? today();
        const last = to ?? first;
        setFilter((f) => ({ ...f, dateFrom: addDays(first, days), dateTo: addDays(last, days) }));
    };
    const periodWidth = !from || !to || from === to ? 1 : to <= addDays(from, 6) ? 7 : 0;
    const sharedParams = new URLSearchParams(search);
    for (const key of ["teacher", "subgroup", "view"]) sharedParams.delete(key);
    if (from) sharedParams.set("from", from);
    if (to) sharedParams.set("to", to);
    const shareUrl = new URL(ROUTE.PUBLIC.SCHEDULA, window.location.origin);
    shareUrl.search = sharedParams.toString();
    const audienceLink = (group?: string, course?: number) => {
        const params = new URLSearchParams(search);
        if (group) params.set("group", group);
        else params.delete("group");
        if (course) params.set("course", String(course));
        else params.delete("course");
        params.delete("subgroup");
        if (!publicView) params.set("view", "all");
        return "?" + params.toString();
    };

    const renderEvent = (event: Event | PublicEvent) => {
        if (event.$typeName === "contract.schedula.entity.Event") {
            const item = event;
            return <EventCard key={item.id} event={item} audienceLink={audienceLink}
                onEdit={internal?.canEdit && item.status === EventStatus.DRAFT ? () => setEditor({ kind: "event", event: item }) : undefined}
                onChange={(internal?.canEdit || (internal?.canRequestChange && item.details?.instructorId === userId)) && item.status !== EventStatus.DRAFT
                    ? () => setEditor({ kind: "change", event: item }) : undefined} />;
        }
        const item = event;
        return <EventCard key={item.id} event={item} audienceLink={audienceLink} />;
    };

    const days = new Map<string, (Event | PublicEvent)[]>();
    if (from && to && periodWidth === 7 && filter.layout !== "list") {
        for (let day = from; day <= to; day = addDays(day, 1)) days.set(day, []);
    }
    const workloads = new Map<string, { name: string; minutes: number }>();
    for (const item of internal?.events ?? []) {
        const minutes = item.details?.durationMinutes ?? 0;
        const instructor = item.details?.instructorId;
        if (item.status === EventStatus.PUBLISHED && instructor && item.instructorName && minutes > 0) {
            workloads.set(instructor, { name: item.instructorName, minutes: (workloads.get(instructor)?.minutes ?? 0) + minutes });
        }
    }
    for (const item of events) {
        const date = item.$typeName === "contract.schedula.entity.Event" ? item.details?.date ?? "" : item.date;
        const bucket = days.get(date) ?? [];
        bucket.push(item);
        days.set(date, bucket);
    }

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <CalendarDaysIcon className="size-5 text-primary" />{publicView ? "Публичное расписание" : "Расписание"}
                    </h1>
                    {week > 0 && <p className="mt-1 text-sm text-muted-foreground">{week}-я учебная неделя · {week % 2 === 0 ? "чётная" : "нечётная"}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {!publicView && <CommonShareLink url={shareUrl.toString()} label="Публичная ссылка" />}
                    {internal?.canSearchSlots && catalog && <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "slots" })}>Подобрать слот</Button>}
                    {internal?.canEdit && catalog && <>
                        <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "catalog" })}>Справочники</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "completeness" })}>Полнота расписания</Button>
                        <Button size="sm" onClick={() => setEditor({ kind: "event" })}>Создать черновик</Button>
                    </>}
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                {!publicView && (student || teacher) && <>
                    <Button size="sm" variant={personal ? "secondary" : "ghost"} onClick={() => setFilter((f) => ({
                        ...f, view: "mine", group: undefined, subgroup: undefined, course: undefined,
                    }))}>Моё расписание</Button>
                    <Button size="sm" variant={personal ? "ghost" : "secondary"} onClick={() => setFilter((f) => ({ ...f, view: "all" }))}>Общая сетка</Button>
                </>}
                <Button size="icon-sm" variant="ghost" aria-label="Предыдущий период" onClick={() => move(periodWidth === 1 ? -1 : -7)}><ChevronLeftIcon /></Button>
                <Button size="sm" variant="outline" onClick={() => setFilter((f) => ({ ...f, dateFrom: today(), dateTo: today() }))}>Сегодня</Button>
                <Button size="sm" variant="outline" onClick={() => setFilter((f) => ({ ...f, dateFrom: undefined, dateTo: undefined }))}>Текущая неделя</Button>
                <Button size="icon-sm" variant="ghost" aria-label="Следующий период" onClick={() => move(periodWidth === 1 ? 1 : 7)}><ChevronRightIcon /></Button>
                <Button size="sm" variant="ghost" aria-pressed={filter.layout === "list"}
                    onClick={() => setFilter((f) => ({ ...f, layout: f.layout === "list" ? undefined : "list" }))}>Список</Button>
            </div>

            <CommonFilter count={events.length} className="w-full">
                <CommonFilterDateRange label="Период" from={from} to={to} onChange={(range) => setFilter((f) => ({
                    ...f, dateFrom: range.from, dateTo: range.from ? range.to && range.to >= range.from ? range.to : range.from : undefined,
                }))} />
                <FilterText label="Группа" value={filter.group} onChange={(group) => setFilter((f) => ({ ...f, group }))} />
                {!publicView && <FilterText label="Подгруппа" value={filter.subgroup} onChange={(subgroup) => setFilter((f) => ({ ...f, subgroup }))} />}
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
                <Button variant="ghost" className="self-end" onClick={() => setFilter({ view: filter.view, layout: filter.layout })}>Сбросить</Button>
            </CommonFilter>

            {catalogError && !publicView && <p role="alert" className="text-sm text-destructive">{catalogError.rawMessage}</p>}
            <CommonControlState isLoading={!state} isError={state?.kind === "error"} isEmpty={!events.length && !transfers.length && !periods.length}
                empty={<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">По выбранным условиям занятий нет.</p>}
                error={<CommonServiceError service="schedula" hint={state?.kind === "error" ? state.error.rawMessage : undefined} onRetry={reload} />}>
                {periods.length > 0 && <section className="mb-4 flex flex-wrap gap-2" aria-label="Учебные периоды">
                    {periods.map((period) => <Badge key={period.id} variant="secondary">
                        {period.audience?.group} {period.audience?.subgroup} · {periodTypes[period.type]} · {dateLabel(period.dateFrom)} – {dateLabel(period.dateTo)}
                    </Badge>)}
                </section>}
                <div className={periodWidth === 7 && filter.layout !== "list" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7" : "space-y-4"}>
                    {[...days].map(([day, items]) => <section key={day} className="min-w-0 space-y-2">
                        <h2 className="text-sm font-semibold">{dateLabel(day)}</h2>
                        {items.length ? items.map(renderEvent) : <p className="text-xs text-muted-foreground">Занятий нет</p>}
                    </section>)}
                </div>
                {internal?.canEdit && workloads.size > 0 && periodWidth === 7 && <details className="mt-4 rounded-lg border p-3">
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

            {lists && editor?.kind === "completeness" && <SchedulaCompleteness terms={lists.terms} date={from} onClose={close}
                onEvent={(event) => setEditor({ kind: "event", event })}
                onAudience={(term, audience) => {
                    setFilter({ view: "all", dateFrom: term.dateFrom, dateTo: term.dateTo, course: audience.course,
                        group: audience.group || undefined, subgroup: audience.subgroup || undefined });
                    close();
                }} />}
            {catalog && editor?.kind === "catalog" && <SchedulaCatalog catalog={catalog.catalog} onClose={close} onSaved={saved} />}
            {catalog && editor && (editor.kind === "slots" || editor.kind === "event") && <SchedulaEditor catalog={catalog}
                event={editor.kind === "event" ? editor.event : undefined} slotsOnly={editor.kind === "slots"}
                suggestedDate={from} onClose={close} onSaved={saved} />}
            {catalog && editor?.kind === "change" && <SchedulaChanges event={editor.event} catalog={catalog} canDecide={internal?.canEdit ?? false}
                canSubmit={!!internal?.canEdit || (!!internal?.canRequestChange && editor.event.details?.instructorId === userId)}
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

function EventCard({ event, audienceLink, onEdit, onChange }: {
    event: Event | PublicEvent; audienceLink: (group?: string, course?: number) => string; onEdit?: () => void; onChange?: () => void;
}) {
    const item = event.$typeName === "contract.schedula.entity.Event" ? event : undefined;
    const external = event.$typeName === "contract.schedula.entity.PublicEvent" ? event : undefined;
    const detail = item?.details;
    const kind = detail?.type ?? external?.type ?? EventType.UNSPECIFIED;
    const groups = detail?.audiences.map(({ group, subgroup, course }) => ({ group, course, label: [group, subgroup].filter(Boolean).join(" · ") }))
        ?? external?.groups.map((group) => ({ group, course: undefined, label: group })) ?? [];
    const place = item?.room?.name ?? external?.room;
    const site = item?.room?.site?.name ?? external?.site;
    const address = item?.room?.site?.address ?? external?.address;
    const point = detail?.meetingPoint || item?.room?.site?.meetingPoint;
    const status = eventStatuses[event.status];
    const variant = event.status === EventStatus.CANCELLED ? "destructive" : "secondary";
    return <article className="rounded-xl border bg-card p-3 text-sm shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
            <time className="font-mono text-xs font-semibold">{eventTime(detail?.startMinute ?? external?.startMinute, detail?.durationMinutes ?? external?.durationMinutes)}</time>
            <Badge variant="outline" className="whitespace-normal">{eventTypes[kind]}</Badge>
            {status && <Badge variant={variant}>{status}</Badge>}
        </div>
        <h3 className="mt-2 font-semibold break-words">{event.subject?.name}</h3>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {groups.map(({ group, course, label }) => <Link key={label} to={audienceLink(group, course)} className="underline-offset-4 hover:underline">{label}</Link>)}
            {[...new Set(groups.flatMap(({ course }) => course ? [course] : []))].map((course) =>
                <Link key={course} to={audienceLink(undefined, course)} className="underline-offset-4 hover:underline">{course}-й курс</Link>)}
        </div>
        {(item?.instructorName || detail?.department) && <p className="mt-2 text-xs">{[item?.instructorName, detail?.department].filter(Boolean).join(" · ")}</p>}
        {place && <p className="mt-1 text-xs">{[place, site, address].filter(Boolean).join(" · ")}</p>}
        {event.status === EventStatus.TRANSFER && detail?.date && <p className="mt-1 text-xs text-muted-foreground">{dateLabel(detail.date)}</p>}
        {point && <p className="mt-1 text-xs text-muted-foreground">Точка сбора · {point}</p>}
        {event.change !== 0 && event.status !== EventStatus.CANCELLED && <p className="mt-1 text-xs text-primary">{changeTypes[event.change]}</p>}
        {onEdit && <Button size="xs" className="mt-2" variant="outline" onClick={onEdit}>Открыть черновик</Button>}
        {onChange && <Button size="xs" className="mt-2" variant="outline" onClick={onChange}>Изменения</Button>}
    </article>;
}
