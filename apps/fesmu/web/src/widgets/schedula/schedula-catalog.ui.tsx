import { useState, type FormEvent, type ReactNode } from "react";
import { ConnectError } from "@connectrpc/connect";
import type { Catalog } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import type { PeriodType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { schedulaClient } from "./schedula.api";
import { periodTypes, readTime } from "./schedula.utils";

const kinds = {
    term: "Семестр", subject: "Дисциплина", site: "Корпус или клиническая база", room: "Площадка",
    period: "Учебный период группы", holiday: "Праздник", travel: "Норматив перехода", booking: "Бронь",
};

type Kind = keyof typeof kinds;

export function SchedulaCatalog({ catalog, onClose, onSaved }: { catalog?: Catalog; onClose: () => void; onSaved: () => void }) {
    const [kind, setKind] = useState<Kind>("term");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "").trim();
        const id = text("id");
        const name = text("name");
        const dateFrom = text("from");
        const dateTo = text("to");
        const roomId = text("room");
        const dates = { dateFrom, dateTo };
        const payload = {
            terms: kind === "term" ? [{ id, name, ...dates }] : [],
            subjects: kind === "subject" ? [{ id, name }] : [],
            sites: kind === "site" ? [{ id, name, address: text("address"), meetingPoint: text("point"), clinical: data.has("clinical") }] : [],
            rooms: kind === "room" ? [{
                id, name, site: { id: text("site") }, capacity: Number(text("capacity")),
                equipment: text("equipment").split(",").map((item) => item.trim()).filter(Boolean),
                opensAt: readTime(text("opens")), closesAt: readTime(text("closes")),
            }] : [],
            periods: kind === "period" ? [{
                id, termId: text("term"), type: Number(text("periodType")) as PeriodType, ...dates,
                audience: { group: text("group"), subgroup: text("subgroup"), course: Number(text("course")) },
            }] : [],
            holidays: kind === "holiday" ? [{ name, date: dateFrom }] : [],
            travelTimes: kind === "travel" ? [{ fromSiteId: text("site"), toSiteId: text("destination"), minutes: Number(text("minutes")) }] : [],
            bookings: kind === "booking" ? [{
                id, roomId, date: dateFrom, title: name, startMinute: readTime(text("opens")),
                durationMinutes: Number(text("minutes")), cancelled: data.has("cancelled"),
            }] : [],
        };
        setBusy(true);
        setError("");
        try {
            await schedulaClient.catalogSave({ catalog: payload });
            onSaved();
        } catch (cause) {
            setError(ConnectError.from(cause).rawMessage);
        } finally {
            setBusy(false);
        }
    };

    return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent>
            <DialogHeader><DialogTitle>Справочники</DialogTitle></DialogHeader>
            <Field label="Раздел"><select className={selectStyle} value={kind} disabled={busy}
                onChange={(event) => { setKind(event.target.value as Kind); setError(""); }}>
                {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select></Field>
            <form key={kind} onSubmit={submit}>
                <fieldset disabled={busy} className="space-y-3">
                    {kind !== "holiday" && kind !== "travel" && <Field label="Код записи"><Input name="id" required maxLength={128} /></Field>}
                    {kind !== "period" && kind !== "travel" && <Field label="Название"><Input name="name" required /></Field>}
                    {(kind === "term" || kind === "period" || kind === "holiday" || kind === "booking") &&
                        <Field label={kind === "holiday" || kind === "booking" ? "Дата" : "Дата начала"}><Input name="from" type="date" required /></Field>}
                    {(kind === "term" || kind === "period") && <Field label="Дата окончания"><Input name="to" type="date" required /></Field>}
                    {kind === "site" && <>
                        <Field label="Адрес"><Input name="address" required /></Field>
                        <Field label="Точка сбора"><Input name="point" /></Field>
                        <label className="flex items-center gap-2"><input name="clinical" type="checkbox" />Клиническая база</label>
                    </>}
                    {(kind === "room" || kind === "travel") && <Field label={kind === "travel" ? "Откуда" : "Корпус"}>
                        <ResourceSelect name="site" rows={catalog?.sites} />
                    </Field>}
                    {kind === "room" && <>
                        <Field label="Вместимость"><Input name="capacity" type="number" min={1} required /></Field>
                        <Field label="Оборудование через запятую"><Input name="equipment" /></Field>
                        <Field label="Открытие"><Input name="opens" type="time" defaultValue="08:00" required /></Field>
                        <Field label="Закрытие"><Input name="closes" type="time" defaultValue="19:00" required /></Field>
                    </>}
                    {kind === "period" && <>
                        <Field label="Семестр"><ResourceSelect name="term" rows={catalog?.terms} /></Field>
                        <Field label="Тип периода"><select name="periodType" className={selectStyle} required>
                            {Object.entries(periodTypes).slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select></Field>
                        <Field label="Группа"><Input name="group" required /></Field>
                        <Field label="Подгруппа"><Input name="subgroup" /></Field>
                        <Field label="Курс"><Input name="course" type="number" min={1} max={6} required /></Field>
                    </>}
                    {kind === "travel" && <>
                        <Field label="Куда"><ResourceSelect name="destination" rows={catalog?.sites} /></Field>
                        <Field label="Норматив, мин"><Input name="minutes" type="number" min={0} max={1440} required /></Field>
                    </>}
                    {kind === "booking" && <>
                        <Field label="Площадка"><ResourceSelect name="room" rows={catalog?.rooms} /></Field>
                        <Field label="Начало брони"><Input name="opens" type="time" required /></Field>
                        <Field label="Длительность, мин"><Input name="minutes" type="number" min={1} max={1440} required /></Field>
                        <label className="flex items-center gap-2"><input name="cancelled" type="checkbox" />Бронь отменена</label>
                    </>}
                    {error && <p role="alert" className="text-destructive">{error}</p>}
                    <Button type="submit" disabled={busy}>Сохранить запись</Button>
                </fieldset>
            </form>
        </DialogContent>
    </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}

function ResourceSelect({ name, rows }: { name: string; rows?: { id: string; name: string }[] }) {
    return <select name={name} className={selectStyle} required>
        <option value="">Выберите запись</option>
        {rows?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
    </select>;
}

const selectStyle = "h-9 w-full rounded-md border bg-background px-2 text-sm";
