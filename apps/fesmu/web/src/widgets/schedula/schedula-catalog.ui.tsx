import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { ConnectError } from "@connectrpc/connect";
import type { Catalog } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import type { PeriodType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { schedulaClient } from "./schedula.api";
import { periodTypes, readTime, today } from "./schedula.utils";

const kinds = {
    term: "Семестр", subject: "Дисциплина", site: "Корпус или клиническая база", room: "Площадка",
    period: "Учебный период группы", holiday: "Праздник", travel: "Норматив перехода", booking: "Бронь",
};

type Kind = keyof typeof kinds;

export function SchedulaCatalog({ catalog, onClose, onSaved }: { catalog?: Catalog; onClose: () => void; onSaved: () => void }) {
    const [kind, setKind] = useState<Kind>("term");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const hasEndDate = kind === "term" || kind === "period";
    const hasStartDate = hasEndDate || kind === "holiday" || kind === "booking";
    const startDateLabel = hasEndDate ? "Дата начала" : "Дата";
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "").trim();
        const id = text("id");
        const name = text("name");
        const dateFrom = text("from");
        const dateTo = text("to");
        if ((hasStartDate && !dateFrom) || (hasEndDate && !dateTo)) {
            const missing = !dateFrom ? "from" : "to";
            setError(`Заполните поле «${missing === "from" ? startDateLabel : "Дата окончания"}».`);
            event.currentTarget.querySelector<HTMLButtonElement>(`button[data-date-field="${missing}"]`)?.focus();
            return;
        }
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
            <form className="grid gap-3" onSubmit={submit}>
                <Field label="Раздел"><CatalogSelect value={kind} disabled={busy}
                    onChange={(event) => { setKind(event.target.value as Kind); setError(""); }}>
                    {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </CatalogSelect></Field>
                <fieldset key={kind} disabled={busy} className="grid gap-3">
                    {kind !== "holiday" && kind !== "travel" && <Field label="Код записи"><Input name="id" required maxLength={128} /></Field>}
                    {kind !== "period" && kind !== "travel" && <Field label="Название"><Input name="name" required /></Field>}
                    {hasStartDate && <CatalogDateField label={startDateLabel} name="from" />}
                    {hasEndDate && <CatalogDateField label="Дата окончания" name="to" />}
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
                        <Field label="Тип периода"><CatalogSelect name="periodType" required>
                            {Object.entries(periodTypes).slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </CatalogSelect></Field>
                        <Field label="Группа"><Input name="group" required /></Field>
                        <Field label="Подгруппа"><Input name="subgroup" /></Field>
                        <Field label="Курс"><Input name="course" type="number" min={1} max={6} required /></Field>
                    </>}
                    {kind === "travel" && <>
                        <Field label="Куда"><ResourceSelect name="destination" rows={catalog?.sites} /></Field>
                        <Field label="Норматив, мин"><Input name="minutes" type="number" min={1} max={1440} required /></Field>
                    </>}
                    {kind === "booking" && <>
                        <Field label="Площадка"><ResourceSelect name="room" rows={catalog?.rooms} /></Field>
                        <Field label="Начало брони"><Input name="opens" type="time" required /></Field>
                        <Field label="Длительность, мин"><Input name="minutes" type="number" min={1} max={1440} required /></Field>
                        <label className="flex items-center gap-2"><input name="cancelled" type="checkbox" />Бронь отменена</label>
                    </>}
                    {error && <p role="alert" className="text-destructive">{error}</p>}
                    <Button type="submit" className="justify-self-start" disabled={busy}>Сохранить запись</Button>
                </fieldset>
            </form>
        </DialogContent>
    </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}

function ResourceSelect({ name, rows }: { name: string; rows?: { id: string; name: string }[] }) {
    return <CatalogSelect name={name} required>
        <option value="">Выберите запись</option>
        {rows?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
    </CatalogSelect>;
}

function CatalogSelect(props: ComponentProps<"select">) {
    return <span className="relative block">
        <select className="h-9 w-full appearance-none rounded-md border border-input bg-background pr-8 pl-2.5 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50" {...props} />
        <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>;
}

const formDate = new Intl.DateTimeFormat("sv-SE");
const displayDate = new Intl.DateTimeFormat("ru-RU");

function CatalogDateField({ label, name }: { label: string; name: string }) {
    const id = useId();
    const [date, setDate] = useState<Date>();
    const [open, setOpen] = useState(false);
    const currentDay = new Date(`${today()}T00:00:00`);

    return <div className="grid gap-1 text-sm font-medium">
        <label htmlFor={id}>{label}</label>
        <input type="hidden" name={name} value={date ? formDate.format(date) : ""} />
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" data-date-field={name}
                    className="w-full justify-between font-normal tabular-nums" aria-label={`${label}: ${date ? displayDate.format(date) : "выберите дату"}`}>
                    {date ? displayDate.format(date) : <span className="text-muted-foreground">Выберите дату</span>}
                    <CalendarIcon className="text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={12} className="w-auto rounded-lg p-0" aria-label={label}>
                <Calendar mode="single" required autoFocus locale={ru} today={currentDay} selected={date} defaultMonth={date ?? currentDay}
                    onSelect={(day) => { setDate(day); setOpen(false); }} />
            </PopoverContent>
        </Popover>
    </div>;
}
