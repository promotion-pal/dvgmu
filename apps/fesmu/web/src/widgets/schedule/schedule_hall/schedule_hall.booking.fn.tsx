import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { useHallBookingForm, useHallData } from "./schedule_hall.fn";
import type { HallDayLoad } from "./schedule_hall.utils";
import {
    bookingsOn,
    buildHallOptions,
    dayLoad,
    freeIntervals,
    isoToLocalDate,
    localDateToIso,
    todayIso,
} from "./schedule_hall.utils";

/** Every day of the month `month` falls in, as ISO dates. */
const daysOfMonth = (month: Date) => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => localDateToIso(new Date(month.getFullYear(), month.getMonth(), i + 1)));
};

/** State of the public "book a lecture hall" page: pick a hall, see which days
 * of the month are free / partly / fully booked, pick a day to see what is
 * already on and which windows are left, and book one of them. */
const useHallBookingPage = () => {
    const { halls, events, loading, error, fetch } = useHallData("public");

    const [today] = useState(todayIso);
    const [month, setMonth] = useState(() => isoToLocalDate(today));

    const bookingForm = useHallBookingForm({ defaultDate: today, onBooked: fetch });
    const { control, setValue } = bookingForm.form;
    const hallId = useWatch({ control, name: "hallId" });
    const date = useWatch({ control, name: "date" });

    const hallOptions = useMemo(() => buildHallOptions(halls), [halls]);
    const hall = halls.find((item) => item.id === hallId);

    /** Load of each upcoming day of the viewed month, for the day picker's colours. */
    const loadByDay = useMemo(() => {
        const load: Record<HallDayLoad, Date[]> = { free: [], partial: [], full: [] };
        if (!hallId) return load;
        for (const iso of daysOfMonth(month)) {
            if (iso < today) continue;
            load[dayLoad(bookingsOn(events, hallId, iso))].push(isoToLocalDate(iso));
        }
        return load;
    }, [events, hallId, month, today]);

    const dayBookings = useMemo(() => (hallId && date ? bookingsOn(events, hallId, date) : []), [events, hallId, date]);
    const dayFree = useMemo(() => freeIntervals(dayBookings), [dayBookings]);

    const selectDate = (day: Date | undefined) => {
        if (!day) return;
        setValue("date", localDateToIso(day), { shouldValidate: true });
        setValue("timeStart", "");
        setValue("timeEnd", "");
    };

    return {
        fetch,
        loading,
        error,
        empty: halls.length === 0,
        hall,
        hallOptions,
        today,
        month,
        setMonth,
        date,
        selectDate,
        loadByDay,
        dayBookings,
        dayFree,
        bookingForm,
    };
};

export { useHallBookingPage };
