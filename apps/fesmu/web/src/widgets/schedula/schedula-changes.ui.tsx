import { useEffect, useState, type FormEvent } from "react";
import { ConnectError } from "@connectrpc/connect";
import { toast } from "sonner";
import type { Change, Event, Issue } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { ChangeStatus, ChangeType, EventStatus } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import type { CatalogFetchResponse } from "@fesmu/contract/schedula/service/schedula.service_pb";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { schedulaClient } from "./schedula.api";
import { SchedulaIssues } from "./schedula-issues.ui";
import { changeTypes, dateLabel, eventTime, readTime, timeLabel } from "./schedula.utils";

const statuses = {
    [ChangeStatus.UNSPECIFIED]: "",
    [ChangeStatus.PENDING]: "На согласовании",
    [ChangeStatus.APPROVED]: "Утверждено",
    [ChangeStatus.REJECTED]: "Отклонено",
};
const changeTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Vladivostok" });

interface Props {
    event: Event;
    catalog: CatalogFetchResponse;
    canDecide: boolean;
    canSubmit: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export function SchedulaChanges({ event, catalog, canDecide, canSubmit, onClose, onSaved }: Props) {
    const [type, setType] = useState(ChangeType.MOVE);
    const [changes, setChanges] = useState<Change[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [issues, setIssues] = useState<Issue[]>([]);
    const [decision, setDecision] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        schedulaClient.changeHistoryFetch({ eventId: event.id }, { signal: controller.signal }).then(
            (result) => { if (!controller.signal.aborted) setChanges(result.changes); },
            (cause: unknown) => { if (!controller.signal.aborted) setError(ConnectError.from(cause).rawMessage); },
        ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [event.id]);

    const perform = async (operation: () => Promise<void>) => {
        setError("");
        setIssues([]);
        setBusy(true);
        try {
            await operation();
        } catch (cause) {
            setError(ConnectError.from(cause).rawMessage);
        } finally {
            setBusy(false);
        }
    };

    const submit = (form: FormEvent<HTMLFormElement>) => {
        form.preventDefault();
        const values = new FormData(form.currentTarget);
        const value = (key: string) => String(values.get(key) ?? "").trim();
        void perform(async () => {
            const result = await schedulaClient.changeCreate({
                eventId: event.id, revision: event.revision, type, reason: value("reason"),
                date: value("date"), startMinute: value("start") ? readTime(value("start")) : undefined,
                instructorId: value("teacher"), roomId: value("room"), meetingPoint: value("point"),
            });
            setIssues(result.issues);
            if (result.change) {
                const change = result.change;
                setChanges((items) => [...items, change]);
            }
        });
    };

    const decide = (id: string, approve: boolean) => void perform(async () => {
        const result = await schedulaClient.changeDecide({ id, approve, decision });
        setIssues(result.issues);
        if (result.change) {
            if (result.issues.length) toast.warning("Изменение утверждено с предупреждением", { description: result.issues[0].message });
            onSaved();
            onClose();
        }
    });
    const names = new Map(catalog.instructors.map(({ id, name }) => [id, name]));
    const describe = (item?: Event) => {
        const detail = item?.details;
        if (!detail) return "";
        return [dateLabel(detail.date), eventTime(detail.startMinute, detail.durationMinutes), item.room?.name,
            names.get(detail.instructorId), detail.meetingPoint].filter(Boolean).join(" · ");
    };

    return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>Изменения · {event.subject?.name}</DialogTitle></DialogHeader>
            {loading && <p className="text-muted-foreground">Загрузка истории</p>}
            {!loading && !error && !changes.length && <p className="text-muted-foreground">Заявок по занятию пока нет.</p>}
            {changes.map((change) => <article key={change.id} className="space-y-2 rounded-lg border p-3">
                <h3 className="font-medium">{changeTypes[change.type]} · {statuses[change.status]}</h3>
                <p className="text-muted-foreground">Было · {describe(change.before)}</p>
                <p className="text-muted-foreground">{change.type === ChangeType.CANCEL ? "Предложена отмена занятия" : `Предложено · ${describe(change.after)}`}</p>
                <p className="break-words">Причина · {change.reason}</p>
                <p className="break-words text-xs text-muted-foreground">
                    Инициатор · {names.get(change.authorId) ?? change.authorId} · {changeTime.format(new Date(change.submittedAt))}
                </p>
                {change.decidedAt && <p className="break-words text-xs text-muted-foreground">
                    Согласующий · {names.get(change.reviewerId) ?? change.reviewerId} · {changeTime.format(new Date(change.decidedAt))}
                </p>}
                {change.decision && <p className="break-words">Решение · {change.decision}</p>}
                {change.status === ChangeStatus.PENDING && canDecide && <div className="space-y-2">
                    <Textarea aria-label="Причина отклонения" placeholder="Причина отклонения" value={decision}
                        onChange={(e) => setDecision(e.target.value)} disabled={busy} />
                    <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={busy} onClick={() => decide(change.id, true)}>Утвердить</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy || !decision.trim()} onClick={() => decide(change.id, false)}>Отклонить</Button>
                    </div>
                </div>}
            </article>)}
            {canSubmit && !changes.some((item) => item.status === ChangeStatus.PENDING) && event.status !== EventStatus.CANCELLED && !loading &&
                <form onSubmit={submit} className="space-y-3 border-t pt-3">
                    <label className="grid gap-1 font-medium">Что изменить
                        <select className={selectStyle} value={type} onChange={(e) => setType(Number(e.target.value))}>
                            {Object.entries(changeTypes).slice(1).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                        </select>
                    </label>
                    {type === ChangeType.MOVE && <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1">Новая дата<Input name="date" type="date" required defaultValue={event.details?.date} /></label>
                        <label className="grid gap-1">Новое время<Input name="start" type="time" required
                            defaultValue={event.details?.startMinute === undefined ? undefined : timeLabel(event.details.startMinute)} /></label>
                    </div>}
                    {type === ChangeType.INSTRUCTOR && <label className="grid gap-1">Новый преподаватель
                        <select className={selectStyle} required name="teacher">
                            <option value="">Выберите преподавателя</option>
                            {catalog.instructors.filter((item) => item.id !== event.details?.instructorId)
                                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </label>}
                    {type === ChangeType.ROOM && <>
                        <label className="grid gap-1">Новая площадка
                            <select className={selectStyle} required name="room">
                                <option value="">Выберите площадку</option>
                                {catalog.catalog?.rooms.filter((item) => item.id !== event.room?.id)
                                    .map((item) => <option key={item.id} value={item.id}>{item.name} · {item.site?.name}</option>)}
                            </select>
                        </label>
                        <label className="grid gap-1">Новая точка сбора<Input name="point" /></label>
                    </>}
                    <label className="grid gap-1">Причина<Textarea name="reason" required /></label>
                    <Button type="submit" disabled={busy}>Подать заявку</Button>
                </form>}
            {issues.length > 0 && <SchedulaIssues issues={issues} />}
            {error && <p role="alert" className="text-destructive">{error}</p>}
        </DialogContent>
    </Dialog>;
}

const selectStyle = "h-9 w-full rounded-md border bg-background px-2 text-sm";
