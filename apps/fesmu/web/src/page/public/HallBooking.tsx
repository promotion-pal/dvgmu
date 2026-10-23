import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarDaysIcon } from "lucide-react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { HallBookingPanel, useHallBookingPage } from "@/widgets/schedule/schedule_hall";

/** Public page to book a lecture hall — no login, no app-sidebar: pick a hall
 * and a day, see what is taken and what is free, book a free window. */
export default function HallBookingPage() {
    const page = useHallBookingPage();

    useEffect(() => {
        page.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Запись в лекционные залы"
            description="Выберите зал и день, затем свободное время — и оставьте контакты, чтобы с вами могли связаться."
            action={
                <Button asChild variant="outline" size="sm">
                    <Link to={ROUTE.PUBLIC.SCHEDULE_HALL}>
                        <CalendarDaysIcon className="size-4" />
                        Занятость залов
                    </Link>
                </Button>
            }
        >
            <CommonControlState isLoading={page.loading} isError={page.error} isEmpty={page.empty}>
                <HallBookingPanel page={page} />
            </CommonControlState>
        </CommonWrapper>
    );
}
