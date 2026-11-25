import { useState, type FormEvent, type ReactNode } from "react";
import { ConnectError } from "@connectrpc/connect";
import type { Event, Issue, Slot } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { EventType, IssueType, Recurrence } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import type { CatalogFetchResponse } from "@fesmu/contract/schedula/service/schedula.service_pb";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { schedulaClient } from "./schedula.api";
import { SchedulaIssues } from "./schedula-issues.ui";
import { addDays, dateLabel, eventTime, eventTypes, readTime, timeLabel, today } from "./schedula.utils";

interface Props {
    catalog: CatalogFetchResponse;
    event?: Event;
    slotsOnly: boolean;
    suggestedDate?: string;
    onClose: () => void;
    onSaved: () => void;
}

export function SchedulaEditor({ catalog, event, slotsOnly, suggestedDate, onClose, onSaved }: Props) {
    const initial = event?.details;
    const resources = catalog.catalog;
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [issues, setIssues] = useState<Issue[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [audiences, setAudiences] = useState(() => initial?.audiences.map((a, id) => ({ ...a, id })) ?? [{ id: 0, group: "", subgroup: "", course: 1 }]);
    const [room, setRoom] = useState(initial?.roomId ?? "");
    const [point, setPoint] = useState(initial?.meetingPoint ?? "");
    const [day, setDay] = useState(initial?.date ?? suggestedDate ?? today());
    const [start, setStart] = useState(initial?.startMinute === undefined ? "" : timeLabel(initial.startMinute));
    const [recurrence, setRecurrence] = useState(Recurrence.UNSPECIFIED);
    const [duration, setDuration] = useState(initial?.durationMinutes ?? 90);

    const clearFeedback = () => {
        setError("");
        setIssues([]);
        setSlots([]);
        setStatus("");
    };
    const edit = () => {
        setDirty(true);
        clearFeedback();
    };
    const perform = async (operation: () => Promise<void>) => {
        setBusy(true);
        clearFeedback();
        try {
            await operation();
        } catch (cause) {
            setError(ConnectError.from(cause).rawMessage);
        } finally {
            setBusy(false);
        }
    };

    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "").trim();
        const details = {
            termId: text("term"), subjectId: text("subject"), type: Number(text("kind")) as EventType,
            audiences: audiences.map(({ id, course }) => ({ group: text(`group-${id}`), subgroup: text(`subgroup-${id}`), course: Number(text(`course-${id}`)) || course })),
            instructorId: text("teacher"), department: text("department"), date: slotsOnly ? undefined : day,
            startMinute: start ? readTime(start) : undefined, durationMinutes: duration, roomId: room,
            meetingPoint: point.trim(), expectedAttendance: Number(text("count")),
            equipment: text("equipment").split(",").map((item) => item.trim()).filter(Boolean),
        };
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const find = slotsOnly || submitter?.value === "find";
        void perform(async () => {
            if (find) {
                const term = resources?.terms.find((item) => item.id === details.termId);
                const suggested = suggestedDate ?? today();
                const first = day || (term && (suggested < term.dateFrom || suggested > term.dateTo) ? term.dateFrom : suggested);
                const weekEnd = addDays(first, 6);
                const found = await schedulaClient.slotsFetch({
                    details: { ...details, date: day || undefined, startMinute: day ? details.startMinute : undefined, roomId: slotsOnly ? room : undefined },
                    dateFrom: first,
                    dateTo: slotsOnly ? text("until") || first : term && term.dateTo < weekEnd ? term.dateTo : weekEnd,
                    excludeEventId: event?.id,
                });
                setSlots(found.slots);
                setIssues(found.issues);
                setStatus(found.slots.length ? "" : "Подходящих слотов нет.");
                return;
            }
            if (recurrence && (!day || !start || !text("until"))) {
                setError("Укажите начало, время и конец повторения.");
                return;
            }
            await schedulaClient.eventSave({
                id: event?.id, revision: event?.revision, details,
                series: recurrence ? {
                    recurrence, dateTo: text("until"), slots: [{
                        weekday: (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7 + 1, startMinute: readTime(start), durationMinutes: duration,
                    }],
                } : undefined,
            });
            onSaved();
        });
    };

    const check = () => event && void perform(async () => {
        const result = await schedulaClient.eventCheckFetch({ id: event.id });
        setIssues(result.issues);
        if (!result.issues.length) setStatus("Конфликтов и пропусков не обнаружено.");
        if (result.issues.every((item) => item.type === IssueType.HOLIDAY) && result.issues.length) {
            setStatus("После публикации занятие появится в колонке «Перенос».");
        }
    });
    const publish = (series = false) => event && void perform(async () => {
        const result = await schedulaClient.eventPublish({ id: event.id, revision: event.revision, series });
        setIssues(result.issues);
        if (result.events.length) onSaved();
    });

    return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>{slotsOnly ? "Подбор свободного слота" : event ? "Черновик занятия" : "Создать черновик"}</DialogTitle></DialogHeader>
            {!resources?.terms.length || !resources.subjects.length ? <p className="text-muted-foreground">Добавьте семестр и дисциплины в справочники.</p> :
                <form onSubmit={submit} onChange={edit} className="space-y-4">
                    <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
                        <Field label="Семестр"><select required className={selectStyle} name="term" defaultValue={initial?.termId ?? resources.terms.find((term) => day >= term.dateFrom && day <= term.dateTo)?.id}>
                            {resources.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                        </select></Field>
                        <Field label="Дисциплина"><select required className={selectStyle} name="subject" defaultValue={initial?.subjectId}>
                            {resources.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                        </select></Field>
                        <Field label="Тип события"><select required name="kind" className={selectStyle} defaultValue={initial?.type ?? (slotsOnly ? EventType.EXAM : EventType.LECTURE)}>
                            {Object.entries(eventTypes).slice(1).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                        </select></Field>
                        <Field label="Число участников"><Input type="number" name="count" min={1} required={slotsOnly} defaultValue={initial?.expectedAttendance || undefined} /></Field>
                        <Field label="Преподаватель или наставник"><select name="teacher" className={selectStyle} defaultValue={initial?.instructorId}>
                            <option value="">Без назначения</option>
                            {catalog.instructors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select></Field>
                        <Field label="Кафедра"><Input name="department" defaultValue={initial?.department} /></Field>
                        <Field label={slotsOnly ? "Начало периода" : "Дата"}><Input type="date" required={slotsOnly} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
                        <Field label="Длительность, мин"><Input type="number" min={1} max={1440} required={slotsOnly} value={duration || ""} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
                        {slotsOnly ? <Field label="Конец периода"><Input type="date" name="until" min={day} defaultValue={day} required /></Field>
                            : <Field label="Начало занятия"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>}
                        <Field label="Площадка"><select name="room" className={selectStyle} value={room} onChange={(e) => setRoom(e.target.value)}>
                            <option value="">{slotsOnly ? "Все площадки" : "Без площадки"}</option>
                            {resources.rooms.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.site?.name}</option>)}
                        </select></Field>
                        <Field label="Точка сбора"><Input value={point} onChange={(e) => setPoint(e.target.value)} /></Field>
                        <Field label="Оборудование через запятую"><Input name="equipment" defaultValue={initial?.equipment.join(", ")} /></Field>
                        {!slotsOnly && !event && <Field label="Повторение"><select className={selectStyle} value={recurrence} onChange={(e) => setRecurrence(Number(e.target.value))}>
                            <option value={Recurrence.UNSPECIFIED}>Однократно</option>
                            <option value={Recurrence.WEEKLY}>Каждую неделю</option>
                            <option value={Recurrence.ODD}>Нечётные недели</option>
                            <option value={Recurrence.EVEN}>Чётные недели</option>
                        </select></Field>}
                        {!slotsOnly && recurrence !== Recurrence.UNSPECIFIED && <Field label="Повторять до"><Input type="date" name="until" min={day} required /></Field>}
                    </fieldset>

                    <fieldset disabled={busy} className="space-y-2">
                        <legend className="mb-2 text-sm font-semibold">Группы</legend>
                        {audiences.map((a) => <div key={a.id} className="grid grid-cols-[2fr_2fr_1fr_auto] items-end gap-2">
                            <Field label="Группа"><Input name={`group-${a.id}`} required defaultValue={a.group} /></Field>
                            <Field label="Подгруппа"><Input name={`subgroup-${a.id}`} defaultValue={a.subgroup} /></Field>
                            <Field label="Курс"><Input name={`course-${a.id}`} type="number" min={1} max={6} required defaultValue={a.course} /></Field>
                            {audiences.length > 1 && <Button type="button" size="icon-sm" variant="ghost" aria-label="Удалить группу" onClick={() => {
                                edit();
                                setAudiences((items) => items.filter((item) => item.id !== a.id));
                            }}>×</Button>}
                        </div>)}
                        <Button type="button" size="sm" variant="outline" onClick={() => {
                            edit();
                            setAudiences((items) => [...items, { id: Math.max(...items.map((item) => item.id)) + 1, group: "", subgroup: "", course: 1 }]);
                        }}>Добавить группу</Button>
                    </fieldset>

                    {slots.map((slot) => <div key={`${slot.date}-${slot.startMinute}-${slot.room?.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                        <span>{dateLabel(slot.date)} · {eventTime(slot.startMinute, slot.durationMinutes)} · {slot.room?.name}</span>
                        {!slotsOnly && <Button type="button" size="sm" variant="outline" onClick={() => {
                            const site = resources.rooms.find((item) => item.id === room)?.site;
                            if (!point.trim() || site?.id !== slot.room?.site?.id) setPoint(slot.room?.site?.meetingPoint ?? "");
                            edit();
                            setDay(slot.date);
                            setStart(timeLabel(slot.startMinute));
                            setRoom(slot.room?.id ?? "");
                        }}>Выбрать</Button>}
                    </div>)}
                    {issues.length > 0 && <SchedulaIssues issues={issues} />}
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
                    {event && dirty && <p className="text-sm text-muted-foreground">Сохраните изменения перед проверкой и публикацией.</p>}
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="action" value="save" disabled={busy}>{slotsOnly ? "Найти слоты" : "Сохранить черновик"}</Button>
                        {!slotsOnly && event && <>
                            <Button type="button" variant="outline" onClick={check} disabled={busy || dirty}>Проверить сохранённое</Button>
                            <Button type="submit" value="find" variant="outline" disabled={busy}>Найти время или площадку</Button>
                            <Button type="button" variant="outline" onClick={() => publish()} disabled={busy || dirty}>Опубликовать</Button>
                            {event.seriesId && <Button type="button" variant="outline" onClick={() => publish(true)} disabled={busy || dirty}>Опубликовать серию</Button>}
                        </>}
                    </div>
                </form>}
        </DialogContent>
    </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <label className="grid min-w-0 gap-1 text-sm font-medium">{label}{children}</label>;
}

const selectStyle = "h-9 w-full rounded-md border bg-background px-2 text-sm";
