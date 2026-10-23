import type { FC } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { Link } from "react-router-dom";
import { PromFieldCheckbox, PromFieldInput, PromFieldSelect } from "@/features/lib/form";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { LESSON_TONE_STYLES } from "@/shared/components/schedule";
import { CommonFilterSelect } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import type { useHallBookingForm, useScheduleHall } from "./schedule_hall.fn";
import type { HallBookingSchema } from "./schedule_hall.schema";
import { WEEKDAY_HEADERS } from "./schedule_hall.utils";
import type { HallCalendarDay, HallCalendarEvent } from "./schedule_hall.utils";

type ScheduleHall = ReturnType<typeof useScheduleHall>;

/** Month navigation and the hall filter — everything above the grid. */
interface HallScheduleToolbarProps {
    monthTitle: string;
    isCurrentMonth: boolean;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    hallOptions: ScheduleHall["hallOptions"];
    hallId?: string;
    onChangeHall: (hallId: string | undefined) => void;
}

const HallScheduleToolbar: FC<HallScheduleToolbarProps> = ({
    monthTitle,
    isCurrentMonth,
    onPrev,
    onNext,
    onToday,
    hallOptions,
    hallId,
    onChangeHall,
}) => (
    <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onToday} disabled={isCurrentMonth}>
            Сегодня
        </Button>
        <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onPrev} aria-label="Предыдущий месяц">
                <ChevronLeftIcon className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onNext} aria-label="Следующий месяц">
                <ChevronRightIcon className="size-4" />
            </Button>
        </div>
        <h3 className="min-w-40 text-base font-semibold capitalize">{monthTitle}</h3>

        <CommonFilterSelect
            label="Аудитория"
            value={hallId}
            onChange={onChangeHall}
            options={hallOptions}
            allLabel="Все аудитории"
            className="ml-auto"
        />
    </div>
);

const HallEventDot: FC<{ tone: HallCalendarEvent["tone"] }> = ({ tone }) => (
    <span className={cn("size-1.5 shrink-0 rounded-full", LESSON_TONE_STYLES[tone].accent)} aria-hidden />
);

/** Cancels a booking; the calendar is read-only when it isn't passed. */
type OnRemoveBooking = (id: string) => void;

/** "Иванов И.И., +7 900 …" — present only for staff (the public fetch leaves it out). */
const bookedBy = (event: HallCalendarEvent) => [event.organizer, event.contact].filter(Boolean).join(", ");

const HallEventRow: FC<{ event: HallCalendarEvent; onRemove?: OnRemoveBooking }> = ({ event, onRemove }) => (
    <p
        className="group flex items-center gap-1.5 truncate text-xs leading-tight"
        title={bookedBy(event) ? `Забронировал: ${bookedBy(event)}` : undefined}
    >
        <HallEventDot tone={event.tone} />
        <span className="shrink-0 font-medium text-muted-foreground">
            {event.timeStart}–{event.timeEnd}
        </span>
        <span className="truncate">
            {event.hallName}. {event.title}
        </span>
        {onRemove && (
            <button
                type="button"
                onClick={() => onRemove(event.id)}
                className="ml-auto shrink-0 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Отменить бронирование: ${event.title}`}
            >
                <XIcon className="size-3" />
            </button>
        )}
    </p>
);

const MAX_VISIBLE_EVENTS = 4;

/** One day cell: date number, up to a handful of bookings, and a "+N ещё"
 * popover for the rest — the same overflow behaviour as the source calendar. */
const HallCalendarDayCell: FC<{ day: HallCalendarDay; onRemove?: OnRemoveBooking }> = ({ day, onRemove }) => {
    const visible = day.events.slice(0, MAX_VISIBLE_EVENTS);
    const hidden = day.events.slice(MAX_VISIBLE_EVENTS);

    return (
        <div
            className={cn(
                "flex min-h-28 flex-col gap-1 border-b border-r p-1.5 last:border-r-0",
                !day.inCurrentMonth && "bg-muted/20",
            )}
        >
            <span
                className={cn(
                    "flex size-6 items-center justify-center rounded-full text-sm",
                    day.isToday && "bg-primary font-semibold text-primary-foreground",
                    !day.isToday && !day.inCurrentMonth && "text-muted-foreground",
                    !day.isToday && day.inCurrentMonth && day.isWeekend && "text-destructive",
                )}
            >
                {day.day}
            </span>

            <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                    <HallEventRow key={event.id} event={event} onRemove={onRemove} />
                ))}
            </div>

            {hidden.length > 0 && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="w-fit text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                            + ещё {hidden.length}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="flex w-64 flex-col gap-1.5">
                        {day.events.map((event) => (
                            <HallEventRow key={event.id} event={event} onRemove={onRemove} />
                        ))}
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};

interface HallScheduleCalendarProps {
    weeks: ScheduleHall["weeks"];
    onRemove?: OnRemoveBooking;
}

/** The month grid itself: a header of weekday names over 5–6 rows of days. */
const HallScheduleCalendar: FC<HallScheduleCalendarProps> = ({ weeks, onRemove }) => (
    <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
            {WEEKDAY_HEADERS.map((label) => (
                <div key={label} className="border-r px-2 py-2 text-center capitalize last:border-r-0">
                    {label}
                </div>
            ))}
        </div>

        <div className="grid grid-cols-1">
            {weeks.map((week) => (
                <div key={week.id} className="grid grid-cols-7">
                    {week.days.map((day) => (
                        <HallCalendarDayCell key={day.iso} day={day} onRemove={onRemove} />
                    ))}
                </div>
            ))}
        </div>
    </div>
);

type HallBookingFormState = ReturnType<typeof useHallBookingForm>;

interface HallBookingFieldsProps {
    hallOptions: ScheduleHall["hallOptions"];
    /** The public page picks the date on its calendar, so it hides this field. */
    withDate?: boolean;
    /** Hides the hall select when the page already has its own. */
    withHall?: boolean;
}

/** The fields of a booking — one set for the admin modal and the public page.
 * Must be rendered inside the form's FormProvider. */
const HallBookingFields: FC<HallBookingFieldsProps> = ({ hallOptions, withDate = true, withHall = true }) => {
    const FieldInput = PromFieldInput<HallBookingSchema>;
    const FieldSelect = PromFieldSelect<HallBookingSchema>;

    return (
        <>
            {withHall && <FieldSelect name="hallId" label="Зал" placeholder="Выберите зал" options={hallOptions} />}

            <div className={cn("grid gap-4", withDate ? "sm:grid-cols-3" : "grid-cols-2")}>
                {withDate && <FieldInput name="date" label="Дата" type="date" />}
                <FieldInput name="timeStart" label="Начало" type="time" />
                <FieldInput name="timeEnd" label="Окончание" type="time" />
            </div>

            <FieldInput name="title" label="Мероприятие" placeholder="Например: Учёный совет" maxLength={255} />

            <div className="grid gap-4 sm:grid-cols-2">
                <FieldInput name="organizer" label="Кто бронирует" placeholder="ФИО, подразделение" maxLength={255} />
                <FieldInput name="contact" label="Телефон или e-mail" placeholder="+7 900 000-00-00" maxLength={255} />
            </div>

            <PromFieldCheckbox<HallBookingSchema>
                name="consent"
                label={
                    <span>
                        Даю согласие на обработку персональных данных (ФИО и контактов) в соответствии с{" "}
                        <Link
                            to={ROUTE.DOCS.LEGAL.PRIVACY}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4"
                        >
                            политикой конфиденциальности
                        </Link>
                    </span>
                }
            />
        </>
    );
};

interface HallBookingModalProps {
    modal: ScheduleHall["bookingModal"];
    bookingForm: HallBookingFormState;
    hallOptions: ScheduleHall["hallOptions"];
}

/** Staff booking from the admin calendar: the same fields as the public page. */
const HallBookingModal: FC<HallBookingModalProps> = ({ modal, bookingForm, hallOptions }) => {
    const { form, handleSubmit } = bookingForm;

    return (
        <CommonModal
            open={modal.open}
            onOpenChange={modal.onOpenChange}
            title="Бронирование зала"
            description="Зал бронируется на интервал времени; пересекаться с другими бронированиями он не может."
        >
            <FormProvider {...form}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <HallBookingFields hallOptions={hallOptions} />

                    <Button type="submit" className="ml-auto w-fit" disabled={form.formState.isSubmitting}>
                        Забронировать
                    </Button>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

export { HallScheduleToolbar, HallScheduleCalendar, HallBookingModal, HallBookingFields };
export type { HallBookingFormState };
