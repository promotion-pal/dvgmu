import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarPlusIcon } from "lucide-react";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { HallScheduleCalendar, HallScheduleToolbar, useScheduleHall } from "@/widgets/schedule/schedule_hall";

/** Public, read-only view of the lecture-hall calendar — the same widget the
 * admin page uses, fed by the public endpoint (no names of who booked). Booking
 * itself lives on its own page, linked from here. */
export default function PublicScheduleHallPage() {
    const scheduleHall = useScheduleHall({ viewer: "public" });

    useEffect(() => {
        scheduleHall.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Расписание (лекционные залы)"
            description="Занятость лекционных залов и аудиторий по дням месяца"
            action={
                <Button asChild size="sm">
                    <Link to={ROUTE.PUBLIC.HALL_BOOKING}>
                        <CalendarPlusIcon className="size-4" />
                        Записаться в зал
                    </Link>
                </Button>
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
                    <HallScheduleCalendar weeks={scheduleHall.weeks} />
                </div>
            </CommonControlState>
        </CommonWrapper>
    );
}
