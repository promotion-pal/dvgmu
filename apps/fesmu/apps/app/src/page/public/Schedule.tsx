import { useEffect } from "react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonShareLink } from "@/shared/components/share";
import { useUrlViewMode } from "@/features/lib/url-state";
import { CommonControlState } from "@/shared/components/state/control-state";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { CalendarOffIcon } from "lucide-react";
import { ScheduleBoard, ScheduleExportButton, ScheduleFilters, ScheduleOverview, useSchedule } from "@/widgets/schedule";

/** Public, read-only view of the group timetable: the same widget and hook the
 * admin page uses, reading the same database. The read RPCs are open without
 * a login; creating, editing and deleting stay behind auth on the server, and
 * this page offers none of them. */
export default function PublicSchedulePage() {
    const schedule = useSchedule();
    const viewModeState = useUrlViewMode("table");

    useEffect(() => {
        schedule.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { timetable, view } = schedule;

    return (
        <CommonWrapper
            title="Расписание"
            description="Учебное расписание по специальностям, курсам и группам"
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <ScheduleExportButton
                        label={schedule.exportLabel}
                        exporting={schedule.exporting}
                        disabled={!timetable}
                        onExport={schedule.download}
                    />
                    <CommonShareLink label="Ссылка на это расписание" />
                </div>
            }
            filter={{
                render: {
                    count: view?.count,
                    className: "w-full",
                    children: (
                        <ScheduleFilters
                            format={timetable?.format}
                            filters={schedule.filters}
                            options={schedule.options}
                            semester={timetable?.semester}
                            onChange={schedule.changeFilters}
                            onReset={schedule.resetFilters}
                            hasActiveFilters={schedule.hasActiveFilters}
                        />
                    ),
                },
            }}
        >
            <CommonControlState
                isLoading={schedule.loading}
                isError={schedule.error}
                isEmpty={schedule.empty}
                empty={
                    <Empty className="rounded-xl border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <CalendarOffIcon />
                            </EmptyMedia>
                            <EmptyTitle>Расписаний пока нет</EmptyTitle>
                            <EmptyDescription>Загляните позже — расписание появится, как только его опубликуют.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                }
            >
                {timetable && view ? (
                    <div className="flex flex-col gap-6">
                        <ScheduleOverview timetable={timetable} view={view} />
                        <ScheduleBoard
                            view={view}
                            viewModeState={viewModeState}
                            groups={schedule.options.groups}
                            onPickGroup={(groupId) => schedule.changeFilters({ groupId })}
                        />
                    </div>
                ) : null}
            </CommonControlState>
        </CommonWrapper>
    );
}
