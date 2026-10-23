import type { FC, ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import { ru } from "react-day-picker/locale";
import { CalendarCheckIcon, ClockIcon } from "lucide-react";
import { PromFieldSelect } from "@/features/lib/form";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import type { useHallBookingPage } from "./schedule_hall.booking.fn";
import { HALL_DAY_END, HALL_DAY_START } from "./schedule_hall.schema";
import type { HallBookingSchema } from "./schedule_hall.schema";
import { HallBookingFields } from "./schedule_hall.ui";
import { formatInterval, formatLongDate, isoToLocalDate } from "./schedule_hall.utils";
import type { HallDayLoad } from "./schedule_hall.utils";

type HallBookingPage = ReturnType<typeof useHallBookingPage>;

/** How a day of the picker is coloured by its load, and what the legend calls it. */
const LOAD_STYLE: Record<HallDayLoad, { cell: string; dot: string; label: string }> = {
    free: { cell: "bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "свободно" },
    partial: { cell: "bg-amber-50 text-amber-900", dot: "bg-amber-500", label: "есть свободное время" },
    full: { cell: "bg-rose-50 text-rose-900 line-through", dot: "bg-rose-500", label: "занято весь день" },
};

const Section: FC<{ title: string; description?: string; children: ReactNode; className?: string }> = ({
    title,
    description,
    children,
    className,
}) => (
    <Card className={cn("p-5", className)}>
        <CardHeader className="px-0 pt-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">{children}</CardContent>
    </Card>
);

const LoadLegend: FC = () => (
    <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        {Object.values(LOAD_STYLE).map(({ dot, label }) => (
            <li key={label} className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", dot)} aria-hidden />
                {label}
            </li>
        ))}
    </ul>
);

/** Step 1: which hall and which day — the picker shows each day's load. */
const HallBookingDayPicker: FC<{ page: HallBookingPage }> = ({ page }) => (
    <Section title="1. Зал и дата" description="Цвет дня показывает, насколько зал уже занят.">
        <PromFieldSelect<HallBookingSchema> name="hallId" label="Зал" placeholder="Выберите зал" options={page.hallOptions} />

        <Calendar
            mode="single"
            locale={ru}
            className="mx-auto rounded-lg border"
            selected={page.date ? isoToLocalDate(page.date) : undefined}
            onSelect={page.selectDate}
            month={page.month}
            onMonthChange={page.setMonth}
            startMonth={isoToLocalDate(page.today)}
            disabled={[{ before: isoToLocalDate(page.today) }, ...(page.hall ? [] : [() => true])]}
            modifiers={page.loadByDay}
            modifiersClassNames={{
                free: LOAD_STYLE.free.cell,
                partial: LOAD_STYLE.partial.cell,
                full: LOAD_STYLE.full.cell,
            }}
        />

        {page.hall ? <LoadLegend /> : <p className="text-sm text-muted-foreground">Сначала выберите зал.</p>}
    </Section>
);

/** Step 2: what is already on that day, the free windows, and the booking itself. */
const HallBookingDayPanel: FC<{ page: HallBookingPage }> = ({ page }) => {
    const { form, handleSubmit, pickInterval } = page.bookingForm;

    if (!page.hall) {
        return (
            <Empty className="border">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CalendarCheckIcon />
                    </EmptyMedia>
                    <EmptyTitle>Выберите зал</EmptyTitle>
                    <EmptyDescription>
                        После этого появятся занятость по дням и свободное время для записи.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <Section
            title={`2. ${page.hall.name}, ${formatLongDate(page.date)}`}
            description={`${page.hall.building}. Зал работает с ${HALL_DAY_START} до ${HALL_DAY_END}.`}
        >
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Занято</h4>
                {page.dayBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">В этот день зал свободен.</p>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {page.dayBookings.map((booking) => (
                            <li key={booking.id} className="flex items-center gap-2 text-sm">
                                <Badge variant="destructive" className="shrink-0 tabular-nums">
                                    {formatInterval({ start: booking.timeStart, end: booking.timeEnd })}
                                </Badge>
                                <span className="truncate">{booking.title}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Свободно — нажмите, чтобы выбрать</h4>
                {page.dayFree.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Свободного времени нет — выберите другой день.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {page.dayFree.map((interval) => (
                            <Button
                                key={interval.start}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="tabular-nums"
                                onClick={() => pickInterval(interval)}
                            >
                                <ClockIcon className="size-3.5" />
                                {formatInterval(interval)}
                            </Button>
                        ))}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    Время можно сузить вручную: главное, чтобы оно не пересекалось с занятым.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t pt-4">
                <HallBookingFields hallOptions={page.hallOptions} withDate={false} withHall={false} />

                <Button type="submit" className="ml-auto w-fit" disabled={form.formState.isSubmitting || page.dayFree.length === 0}>
                    {form.formState.isSubmitting ? "Бронирование…" : "Забронировать"}
                </Button>
            </form>
        </Section>
    );
};

/** The public booking page body: hall + day on the left, the day and the form on the right. */
const HallBookingPanel: FC<{ page: HallBookingPage }> = ({ page }) => (
    <FormProvider {...page.bookingForm.form}>
        <div className="grid items-start gap-4 lg:grid-cols-[auto_1fr]">
            <HallBookingDayPicker page={page} />
            <HallBookingDayPanel page={page} />
        </div>
    </FormProvider>
);

export { HallBookingPanel };
