import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlusIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { CalendarSubscription } from "@/shared/components/schedule/calendar-subscription";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { PermissionSection } from "@/shared/config/permissions";
import { Can } from "@/features/access";
import { Button } from "@/shared/ui/button";
import { ScheduleCalendar, ScheduleExportButton, SchedulePublicLink, useSchedule } from "@/widgets/schedule";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

export default function SchedulePage() {
    const navigate = useNavigate();
    const schedule = useSchedule();

    useEffect(() => {
        schedule.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { timetable, filters } = schedule;

    const handleRemove = () => {
        if (!timetable || !confirm(`Удалить расписание «${timetable.title}»?`)) return;
        schedule.remove(timetable.id);
    };

    return (
        <CommonWrapper
            title="Расписание групп"
            styleChildren="mx-auto max-w-[1400px]"
            action={
                <div className="flex flex-wrap items-center gap-2">
                    {timetable && (
                        <CalendarSubscription
                            timetable={timetable.id}
                            group={filters.groupId}
                            title={filters.groupId ? `Группа ${filters.groupId}` : timetable.title}
                        />
                    )}
                    <SchedulePublicLink schedule={schedule} />
                    <ScheduleExportButton
                        label={schedule.exportLabel}
                        exporting={schedule.exporting}
                        disabled={!timetable}
                        onExport={schedule.download}
                    />
                    <Can section={PermissionSection.SCHEDULE}>
                        {timetable && (
                            <>
                                <Button type="button" size="icon-sm" variant="outline" onClick={() => navigate(ROUTE.STUDY.SCHEDULE_EDIT.replace(":id", timetable.id))} aria-label="Редактировать расписание">
                                    <PencilIcon />
                                </Button>
                                <Button type="button" size="icon-sm" variant="outline" onClick={handleRemove} aria-label="Удалить расписание">
                                    <Trash2Icon />
                                </Button>
                            </>
                        )}
                        <Button size="sm" asChild>
                            <Link to={ROUTE.STUDY.SCHEDULE_NEW}><PlusIcon /> Новое расписание</Link>
                        </Button>
                    </Can>
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
                            <EmptyMedia variant="icon">
                                <CalendarPlusIcon />
                            </EmptyMedia>
                            <EmptyTitle>Расписаний пока нет</EmptyTitle>
                            <EmptyDescription>Составьте первое расписание — оно сразу появится и на странице для студентов.</EmptyDescription>
                        </EmptyHeader>
                        <Can section={PermissionSection.SCHEDULE}>
                            <EmptyContent className="flex-row justify-center">
                                <Button asChild>
                                    <Link to={ROUTE.STUDY.SCHEDULE_NEW}>Составить расписание</Link>
                                </Button>
                            </EmptyContent>
                        </Can>
                    </Empty>
                }
            >
                <ScheduleCalendar schedule={schedule} staff />
            </CommonControlState>
        </CommonWrapper>
    );
}
