import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarDaysIcon, CalendarOffIcon } from "lucide-react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { ScheduleCalendar, ScheduleExportButton, SchedulePublicLink, useSchedule } from "@/widgets/schedule";

/** Read-only group timetable, shared by the public page and the cabinet. */
export default function PublicSchedulePage() {
    const schedule = useSchedule();
    const { pathname } = useLocation();
    const inCabinet = pathname === ROUTE.MY.SCHEDULE;

    useEffect(() => {
        schedule.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { timetable, filters } = schedule;
    return (
        <div className={cn("w-full min-w-0 bg-background text-foreground", !inCabinet && "min-h-dvh")}>
            <div className="mx-auto w-full min-w-0 max-w-[1400px]">
                {!inCabinet && (
                    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
                        <Link to={ROUTE.PUBLIC.SCHEDULE} className="flex items-center gap-2 rounded-md">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background"><CalendarDaysIcon className="size-4" /></span>
                            <span>
                                <span className="block text-sm font-semibold">ДВГМУ</span>
                                <span className="block text-xs text-muted-foreground">Публичное расписание</span>
                            </span>
                        </Link>
                    </header>
                )}
                <CommonWrapper
                    title={filters.groupId ? `Расписание группы ${filters.groupId}` : "Расписание занятий"}
                    description={timetable ? `${timetable.course}-й курс · ${timetable.program.name}` : "Дальневосточный государственный медицинский университет"}
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <SchedulePublicLink schedule={schedule} />
                            <ScheduleExportButton
                                label={schedule.exportLabel}
                                exporting={schedule.exporting}
                                disabled={!timetable}
                                onExport={schedule.download}
                            />
                        </div>
                    }
                >
                    <CommonControlState
                        isLoading={schedule.loading}
                        isError={schedule.error}
                        isEmpty={schedule.empty}
                        empty={
                            <Empty className="rounded-xl border border-dashed">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon"><CalendarOffIcon /></EmptyMedia>
                                    <EmptyTitle>Расписаний пока нет</EmptyTitle>
                                    <EmptyDescription>Загляните позже — расписание появится, как только его опубликуют.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <ScheduleCalendar schedule={schedule} showAudience />
                    </CommonControlState>
                </CommonWrapper>
            </div>
        </div>
    );
}
