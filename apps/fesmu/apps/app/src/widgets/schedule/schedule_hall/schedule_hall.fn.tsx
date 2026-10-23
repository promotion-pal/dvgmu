import { useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { hallApi } from "./schedule_hall.api";
import type { HallViewer } from "./schedule_hall.api";
import { EMPTY_HALL_SCHEDULE_FILTERS, hallBookingSchema } from "./schedule_hall.schema";
import type { Hall, HallBookingSchema, HallEvent, HallScheduleFilters } from "./schedule_hall.schema";
import type { HallInterval } from "./schedule_hall.utils";
import {
    buildHallOptions,
    buildMonthWeeks,
    formatMonthTitle,
    monthCursorOf,
    monthCursorToIso,
    shiftMonth,
    todayIso,
} from "./schedule_hall.utils";

/** The server's own wording ("зал уже занят в это время", ...) without the
 * "[already_exists]" code prefix ConnectError adds to `message`. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

/** Halls and their bookings, loaded together — the data every hall page starts from. */
const useHallData = (viewer: HallViewer) => {
    const [halls, setHalls] = useState<Hall[]>([]);
    const [events, setEvents] = useState<HallEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const fetch = async () => {
        setLoading(true);
        setError(false);

        try {
            const [hallList, eventList] = await Promise.all([hallApi.fetchHalls(), hallApi.fetchBookings(viewer)]);
            setHalls(hallList);
            setEvents(eventList);
        } catch (err) {
            console.error("Ошибка при получении расписания залов:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return { halls, events, loading, error, fetch };
};

interface UseHallBookingFormProps {
    defaultDate: string;
    /** Called after a successful booking, e.g. to reload the calendar. */
    onBooked: () => Promise<void> | void;
}

/** The "book a hall" form — shared by the public booking page and the admin
 * modal. A successful booking keeps the hall/date/organizer, since the same
 * person often books several slots in a row. */
const useHallBookingForm = ({ defaultDate, onBooked }: UseHallBookingFormProps) => {
    const emptyValues = (): HallBookingSchema => ({
        hallId: "",
        date: defaultDate,
        timeStart: "",
        timeEnd: "",
        title: "",
        organizer: "",
        contact: "",
        consent: false,
    });

    const form = useForm<HallBookingSchema>({
        resolver: zodResolver(hallBookingSchema),
        defaultValues: emptyValues(),
    });

    const handleSubmit = form.handleSubmit(async (values) => {
        try {
            await hallApi.createBooking(values);
            toast.success("Зал забронирован");
            form.reset({
                ...emptyValues(),
                hallId: values.hallId,
                date: values.date,
                organizer: values.organizer,
                contact: values.contact,
                consent: values.consent,
            });
            await onBooked();
        } catch (error) {
            console.error("Ошибка при бронировании зала:", error);
            toast.error(errorText(error, "Не удалось забронировать зал"));
        }
    });

    /** Fills the time fields from a free window the viewer clicked. */
    const pickInterval = ({ start, end }: HallInterval) => {
        form.setValue("timeStart", start, { shouldValidate: true });
        form.setValue("timeEnd", end, { shouldValidate: true });
    };

    return { form, handleSubmit, pickInterval };
};

interface UseScheduleHallProps {
    /** Staff see who booked and may book/cancel; the public calendar is read-only. */
    viewer: HallViewer;
}

/** State of the hall-occupancy calendar: the loaded halls/bookings, the month
 * being viewed and the hall filter — plus, for staff, booking and cancelling. */
const useScheduleHall = ({ viewer }: UseScheduleHallProps) => {
    const { halls, events, loading, error, fetch } = useHallData(viewer);

    const [today] = useState(todayIso);
    const [cursor, setCursor] = useState(() => monthCursorOf(today));
    const [filters, setFilters] = useState<HallScheduleFilters>(EMPTY_HALL_SCHEDULE_FILTERS);

    const bookingModal = useCommonModal();
    const bookingForm = useHallBookingForm({
        defaultDate: today,
        onBooked: async () => {
            bookingModal.closeModal();
            await fetch();
        },
    });

    const openBooking = () => {
        // Preselect the hall the calendar is filtered by, if any.
        bookingForm.form.setValue("hallId", filters.hallId ?? "");
        bookingModal.openModal("create");
    };

    const removeBooking = async (id: string) => {
        if (!confirm("Отменить бронирование зала?")) return;

        try {
            await hallApi.removeBooking(id);
            toast.success("Бронирование отменено");
            await fetch();
        } catch (err) {
            console.error("Ошибка при отмене бронирования:", err);
            toast.error(errorText(err, "Не удалось отменить бронирование"));
        }
    };

    const weeks = useMemo(
        () => buildMonthWeeks(cursor, events, halls, filters, today),
        [cursor, events, halls, filters, today],
    );
    const hallOptions = useMemo(() => buildHallOptions(halls), [halls]);

    const goToday = () => setCursor(monthCursorOf(today));
    const goPrevMonth = () => setCursor((current) => shiftMonth(current, -1));
    const goNextMonth = () => setCursor((current) => shiftMonth(current, 1));

    const changeHall = (hallId: string | undefined) => setFilters({ hallId });

    return {
        fetch,
        loading,
        error,
        empty: halls.length === 0,
        halls,
        hallOptions,
        filters,
        changeHall,
        monthTitle: formatMonthTitle(cursor),
        monthIso: monthCursorToIso(cursor),
        weeks,
        goToday,
        goPrevMonth,
        goNextMonth,
        isCurrentMonth: monthCursorOf(today).year === cursor.year && monthCursorOf(today).month === cursor.month,
        bookingModal,
        bookingForm,
        openBooking,
        removeBooking,
    };
};

export { useScheduleHall, useHallData, useHallBookingForm };
