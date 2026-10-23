import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { HallBookingModal, HallScheduleCalendar, HallScheduleToolbar, useScheduleHall } from "@/widgets/schedule/schedule_hall";

export default function ScheduleHallPage() {
    const scheduleHall = useScheduleHall({ viewer: "staff" });

    useEffect(() => {
        scheduleHall.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Расписание (лекционные залы)"
            description="Занятость лекционных залов и аудиторий по дням месяца"
            action={
                <PlusIcon
                    className="size-4 cursor-pointer"
                    onClick={scheduleHall.openBooking}
                    aria-label="Забронировать зал"
                />
            }
        >
            <CommonControlState isLoading={scheduleHall.loading} isError={scheduleHall.error} isEmpty={scheduleHall.empty}>
                <div className="flex flex-col gap-4">
                    <HallScheduleToolbar
                        monthTitle={scheduleHall.monthTitle}
                        isCurrentMonth={scheduleHall.isCurrentMonth}
                        onPrev={scheduleHall.goPrevMonth}
                        onNext={scheduleHall.goNextMonth}
                        onToday={scheduleHall.goToday}
                        hallOptions={scheduleHall.hallOptions}
                        hallId={scheduleHall.filters.hallId}
                        onChangeHall={scheduleHall.changeHall}
                    />
                    <HallScheduleCalendar weeks={scheduleHall.weeks} onRemove={scheduleHall.removeBooking} />
                </div>
            </CommonControlState>

            <HallBookingModal
                modal={scheduleHall.bookingModal}
                bookingForm={scheduleHall.bookingForm}
                hallOptions={scheduleHall.hallOptions}
            />
        </CommonWrapper>
    );
}
