import type { FC } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { Link } from "react-router-dom";
import { PromFieldCheckbox, PromFieldInput, PromFieldSelect } from "@/features/lib/form";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { LESSON_TONE_STYLES } from "@/shared/components/schedule";
import { CommonFilterSelect } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import type { useHallBookingForm, useScheduleHall } from "./schedule_hall.fn";
import type { HallBookingSchema } from "./schedule_hall.schema";
import { formatHallDay } from "./schedule_hall.utils";
import type { HallCalendarEvent } from "./schedule_hall.utils";

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

interface HallScheduleCalendarProps {
    weeks: ScheduleHall["weeks"];
    onRemove?: OnRemoveBooking;
}

/** Compact monthly agenda: show only days with bookings, with the full details
 * and controls visible on each booking card. */
const HallScheduleCalendar: FC<HallScheduleCalendarProps> = ({ weeks, onRemove }) => {
    const days = weeks.flatMap((week) => week.days).filter((day) => day.inCurrentMonth && day.events.length > 0);

    if (days.length === 0) {
        return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">В этом месяце бронирований нет.</p>;
    }

    return (
        <div className="flex flex-col gap-3">
            {days.map((day) => (
                <section key={day.iso} className="overflow-hidden rounded-xl border">
                    <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                        <h3 className="font-semibold capitalize">{formatHallDay(day.iso)}</h3>
                        <span className="text-xs text-muted-foreground">{day.events.length} {day.events.length === 1 ? "бронирование" : "бронирования"}</span>
                    </header>
                    <ul className="divide-y">
                        {day.events.map((event) => (
                            <li key={event.id} className="group flex items-start gap-3 p-4 sm:items-center">
                                <div className="flex w-24 shrink-0 flex-col rounded-lg bg-muted/40 px-3 py-2 text-center tabular-nums">
                                    <time className="font-semibold">{event.timeStart}</time>
                                    <span className="text-xs text-muted-foreground">до {event.timeEnd}</span>
                                </div>
                                <HallEventDot tone={event.tone} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">{event.hallName}</p>
                                    {(event.organizer || event.contact) && (
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {[event.organizer, event.contact].filter(Boolean).join(" · ")}
                                        </p>
                                    )}
                                </div>
                                {onRemove && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(event.id)}
                                        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={`Отменить бронирование: ${event.title}`}
                                    >
                                        <XIcon className="size-4" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
};

type HallBookingFormState = ReturnType<typeof useHallBookingForm>;

interface HallBookingFieldsProps {
    hallOptions: ScheduleHall["hallOptions"];
    /** The public page picks the date on its calendar, so it hides this field. */
    withDate?: boolean;
    /** Hides the hall select when the page already has its own. */
    withHall?: boolean;
    readOnlyApplicant?: boolean;
}

/** The fields of a booking — one set for the admin modal and the public page.
 * Must be rendered inside the form's FormProvider. */
const HallBookingFields: FC<HallBookingFieldsProps> = ({ hallOptions, withDate = true, withHall = true, readOnlyApplicant = false }) => {
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
                <FieldInput name="organizer" label="Кто бронирует" placeholder="ФИО, подразделение" maxLength={255} readOnly={readOnlyApplicant} />
                <FieldInput name="contact" label="Телефон или e-mail" placeholder="+7 900 000-00-00" maxLength={255} readOnly={readOnlyApplicant} />
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
    readOnlyApplicant?: boolean;
}

/** Staff booking from the admin calendar: the same fields as the public page. */
const HallBookingModal: FC<HallBookingModalProps> = ({ modal, bookingForm, hallOptions, readOnlyApplicant = false }) => {
    const { form, handleSubmit } = bookingForm;

    return (
        <CommonModal
            open={modal.open}
            onOpenChange={modal.onOpenChange}
            title={readOnlyApplicant ? "Заявка на лекционный зал" : "Бронирование зала"}
            description={readOnlyApplicant ? "После отправки заявку проверит ответственный сотрудник." : "Заявки после одобрения занимают выбранное время."}
        >
            <FormProvider {...form}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <HallBookingFields hallOptions={hallOptions} readOnlyApplicant={readOnlyApplicant} />

                    <Button type="submit" className="ml-auto w-fit" disabled={form.formState.isSubmitting}>
                        {readOnlyApplicant ? "Отправить заявку" : "Отправить заявку"}
                    </Button>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

export { HallScheduleToolbar, HallScheduleCalendar, HallBookingModal, HallBookingFields };
export type { HallBookingFormState };
