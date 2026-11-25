import type { FC } from "react";
import { CalendarXIcon, ClockIcon, MapPinIcon, Trash2Icon, UserPlusIcon, XIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { Link } from "react-router-dom";
import { PromFieldCheckbox, PromFieldInput, PromFieldTextArea } from "@/features/lib/form";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { CommonFilterSelect } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import type { useVaccination } from "./vaccination.fn";
import type { VaccinationDayForm, VaccinationSignupForm, VaccinationSlot } from "./vaccination.schema";

type Vaccination = ReturnType<typeof useVaccination>;

const formatLongDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/* ───────────── day picker & header ───────────── */

const VaccinationDayFilter: FC<{ state: Vaccination }> = ({ state }) => (
    <CommonFilterSelect
        label="День вакцинации"
        value={state.day?.id}
        onChange={state.selectDay}
        options={state.dayOptions}
        className="[&_button]:min-w-72"
    />
);

const VaccinationDayHeader: FC<{ state: Vaccination }> = ({ state }) => {
    const { day } = state;
    if (!day) return null;
    const taken = day.slots.reduce((sum, slot) => sum + slot.signups.length, 0);
    const capacity = day.slots.reduce((sum, slot) => sum + slot.capacity, 0);

    return (
        <Card className="gap-2 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatLongDate(day.date)}</span>
                    <h2 className="text-lg font-semibold leading-snug">{day.title}</h2>
                    {day.place && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPinIcon className="size-4" />
                            {day.place}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="tabular-nums">
                        Записано {taken} из {capacity}
                    </Badge>
                    {state.editable && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => state.removeDay(day)}>
                            <Trash2Icon className="size-4" />
                            Удалить день
                        </Button>
                    )}
                </div>
            </div>
            {day.note && <p className="text-sm text-muted-foreground">{day.note}</p>}
            {state.past && <p className="text-sm font-medium text-destructive">Этот день уже прошёл — запись закрыта.</p>}
        </Card>
    );
};

/* ───────────── slots ───────────── */

const SlotCard: FC<{ state: Vaccination; slot: VaccinationSlot }> = ({ state, slot }) => {
    const taken = slot.signups.length;
    const full = taken >= slot.capacity;
    const share = Math.min(taken / slot.capacity, 1);

    return (
        <Card className={cn("gap-3 p-4", full && "bg-muted/40")}>
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-base font-semibold tabular-nums">
                    <ClockIcon className="size-4 text-muted-foreground" />
                    {slot.timeStart}–{slot.timeEnd}
                </span>
                <Badge variant={full ? "destructive" : "secondary"} className="tabular-nums">
                    {full ? "мест нет" : `свободно ${slot.capacity - taken} из ${slot.capacity}`}
                </Badge>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-emerald-500")} style={{ width: `${share * 100}%` }} />
            </div>

            {slot.signups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока никто не записался.</p>
            ) : (
                <ol className="flex flex-col gap-1 text-sm">
                    {slot.signups.map((signup, index) => (
                        <li key={signup.id} className="group flex items-center gap-2">
                            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{index + 1}.</span>
                            <span className="truncate">{signup.fullName}</span>
                            {state.editable && (
                                <button
                                    type="button"
                                    onClick={() => state.removeSignup(signup.id, signup.fullName)}
                                    className="ml-auto text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                                    aria-label={`Удалить запись: ${signup.fullName}`}
                                >
                                    <XIcon className="size-3.5" />
                                </button>
                            )}
                        </li>
                    ))}
                </ol>
            )}

            <Button type="button" className="mt-auto" disabled={full || state.past} onClick={() => state.openSignup(slot)}>
                <UserPlusIcon className="size-4" />
                {full ? "Мест нет" : "Записаться"}
            </Button>
        </Card>
    );
};

/** The open day: its header and one card per slot with the names on it. */
const VaccinationBoard: FC<{ state: Vaccination }> = ({ state }) => {
    if (!state.day) {
        return (
            <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CalendarXIcon />
                    </EmptyMedia>
                    <EmptyTitle>Записи на вакцинацию пока нет</EmptyTitle>
                    <EmptyDescription>Когда появится день вакцинации, здесь можно будет выбрать время и записаться.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <VaccinationDayHeader state={state} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {state.day.slots.map((slot) => (
                    <SlotCard key={slot.id} state={state} slot={slot} />
                ))}
            </div>
        </div>
    );
};

/* ───────────── forms ───────────── */

const VaccinationSignupModal: FC<{ state: Vaccination }> = ({ state }) => {
    const { signupForm, slot } = state;

    return (
        <CommonModal
            open={state.signupModal.open}
            onOpenChange={state.signupModal.onOpenChange}
            title={slot ? `Запись на ${slot.timeStart}–${slot.timeEnd}` : "Запись"}
            description="ФИО появится в списке записавшихся сразу после записи. На один день можно записаться только один раз."
        >
            <FormProvider {...signupForm}>
                <form onSubmit={state.submitSignup} className="flex flex-col gap-4">
                    <PromFieldInput<VaccinationSignupForm> name="fullName" label="Фамилия, имя, отчество" placeholder="Иванов Иван Иванович" maxLength={255} />
                    <PromFieldCheckbox<VaccinationSignupForm>
                        name="consent"
                        label={
                            <span>
                                Даю согласие на обработку ФИО и его публикацию в списке записавшихся в соответствии с{" "}
                                <Link to={ROUTE.DOCS.LEGAL.PRIVACY} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                                    политикой конфиденциальности
                                </Link>
                            </span>
                        }
                    />
                    <Button type="submit" className="ml-auto w-fit" disabled={signupForm.formState.isSubmitting}>
                        {signupForm.formState.isSubmitting ? "Записываем…" : "Записаться"}
                    </Button>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

/** Staff: add a vaccination day; it gets 10:00–12:00 in half-hour slots, 12 places each. */
const VaccinationDayModal: FC<{ state: Vaccination }> = ({ state }) => {
    const FieldInput = PromFieldInput<VaccinationDayForm>;

    return (
        <CommonModal
            open={state.dayModal.open}
            onOpenChange={state.dayModal.onOpenChange}
            title="Новый день вакцинации"
            description="У дня сразу появятся слоты 10:00–10:30, 10:30–11:00, 11:00–11:30 и 11:30–12:00 по 12 мест."
        >
            <FormProvider {...state.dayForm}>
                <form onSubmit={state.submitDay} className="flex flex-col gap-4">
                    <FieldInput name="date" label="Дата" type="date" />
                    <FieldInput name="title" label="Название" placeholder="Вакцинация против гриппа" maxLength={255} />
                    <FieldInput name="place" label="Где" placeholder="Необязательно, например: здравпункт, учебный корпус № 1" maxLength={255} />
                    <PromFieldTextArea<VaccinationDayForm> name="note" label="Примечание" placeholder="Необязательно" rows={2} />
                    <Button type="submit" className="ml-auto w-fit" disabled={state.dayForm.formState.isSubmitting}>
                        Добавить
                    </Button>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

export { VaccinationBoard, VaccinationDayFilter, VaccinationDayModal, VaccinationSignupModal };
