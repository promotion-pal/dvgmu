import { useEffect, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCommonModal } from "@/shared/components/modal";
import { vaccinationApi } from "./vaccination.api";
import { vaccinationDaySchema, vaccinationSignupSchema } from "./vaccination.schema";
import type { VaccinationDay, VaccinationDayForm, VaccinationSignupForm, VaccinationSlot } from "./vaccination.schema";
import { useVaccinationUrlFilters } from "./vaccination.url";

/** How often the open page picks up other people's sign-ups. */
const REFRESH_MS = 30_000;

/** The server's own wording ("в этом времени не осталось мест", "вы уже записаны…")
 * without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

/** Today in the viewer's own calendar (not UTC). */
const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

interface UseVaccinationProps {
    /** Staff add/remove days and remove sign-ups; everyone signs up. */
    editable?: boolean;
}

/** State of the vaccination sign-up page: the upcoming days with their slots
 * and names, the open day (kept in the URL), and signing up. */
const useVaccination = ({ editable = false }: UseVaccinationProps = {}) => {
    const [days, setDays] = useState<VaccinationDay[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [today] = useState(todayIso);
    const [filters, setFilters] = useVaccinationUrlFilters();

    const load = async () => {
        const list = await vaccinationApi.fetch(editable ? undefined : today);
        setDays(list);
        return list;
    };

    const fetch = async () => {
        setLoading(true);
        setError(false);
        try {
            const list = await load();
            setFilters((current) =>
                list.some((day) => day.id === current.dayId)
                    ? current
                    : { dayId: (list.find((day) => day.date >= today) ?? list[0])?.id },
            );
        } catch (err) {
            console.error("Ошибка при получении записи на вакцинацию:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    // Other people sign up too: keep the lists current while the page is open.
    useEffect(() => {
        const timer = setInterval(() => load().catch(() => undefined), REFRESH_MS);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const day = days.find((item) => item.id === filters.dayId);
    const past = day ? day.date < today : false;

    /* ── sign-up ── */
    const signupModal = useCommonModal();
    const [slot, setSlot] = useState<VaccinationSlot>();
    const signupForm = useForm<VaccinationSignupForm>({
        resolver: zodResolver(vaccinationSignupSchema),
        defaultValues: { fullName: "", consent: false },
    });

    const openSignup = (target: VaccinationSlot) => {
        setSlot(target);
        signupForm.reset({ fullName: signupForm.getValues("fullName"), consent: signupForm.getValues("consent") });
        signupModal.openModal("create");
    };

    const submitSignup = signupForm.handleSubmit(async (values) => {
        if (!slot) return;
        try {
            await vaccinationApi.signup(slot.id, values.fullName, values.consent);
            toast.success(`Вы записаны на ${slot.timeStart}–${slot.timeEnd}`);
            signupForm.reset({ fullName: "", consent: false });
            signupModal.closeModal();
        } catch (err) {
            console.error("Ошибка при записи на вакцинацию:", err);
            toast.error(errorText(err, "Не удалось записаться"));
        } finally {
            // Show the result — or why it failed (the slot may have just filled up) — right away.
            await load().catch(() => undefined);
        }
    });

    /* ── staff ── */
    const dayModal = useCommonModal();
    const dayForm = useForm<VaccinationDayForm>({
        resolver: zodResolver(vaccinationDaySchema),
        defaultValues: { date: today, title: "Вакцинация", place: "", note: "" },
    });

    const openCreateDay = () => {
        dayForm.reset({ date: today, title: "Вакцинация", place: "", note: "" });
        dayModal.openModal("create");
    };

    const submitDay = dayForm.handleSubmit(async (values) => {
        try {
            await vaccinationApi.createDay(values);
            toast.success("День вакцинации добавлен");
            dayModal.closeModal();
            const list = await load();
            const created = list.find((item) => item.date === values.date && item.title === values.title.trim());
            if (created) setFilters({ dayId: created.id });
        } catch (err) {
            console.error("Ошибка при добавлении дня вакцинации:", err);
            toast.error(errorText(err, "Не удалось добавить день"));
        }
    });

    const removeDay = async (target: VaccinationDay) => {
        if (!confirm(`Удалить день ${target.date} вместе со всеми записями?`)) return;
        try {
            await vaccinationApi.removeDay(target.id);
            toast.success("День удалён");
            await fetch();
        } catch (err) {
            toast.error(errorText(err, "Не удалось удалить день"));
        }
    };

    const removeSignup = async (id: string, name: string) => {
        if (!confirm(`Удалить запись «${name}»?`)) return;
        try {
            await vaccinationApi.removeSignup(id);
            toast.success("Запись удалена");
            await load();
        } catch (err) {
            toast.error(errorText(err, "Не удалось удалить запись"));
        }
    };

    return {
        fetch,
        loading,
        error,
        editable,
        days,
        day,
        past,
        dayOptions: days.map((item) => ({ value: item.id, label: `${item.date.split("-").reverse().join(".")} — ${item.title}` })),
        selectDay: (dayId: string | undefined) => setFilters({ dayId }),
        signupModal,
        slot,
        signupForm,
        openSignup,
        submitSignup,
        dayModal,
        dayForm,
        openCreateDay,
        submitDay,
        removeDay,
        removeSignup,
    };
};

export { useVaccination };
