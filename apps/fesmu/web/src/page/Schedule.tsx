import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlusIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonShareLink } from "@/shared/components/share";
import { useUrlViewMode } from "@/features/lib/url-state";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { PermissionSection } from "@/shared/config/permissions";
import { Can } from "@/features/access";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { ScheduleBoard, ScheduleExportButton, ScheduleFilters, ScheduleOverview, useSchedule } from "@/widgets/schedule";

export default function SchedulePage() {
    const navigate = useNavigate();
    const schedule = useSchedule();
    const viewModeState = useUrlViewMode("table");

    useEffect(() => {
        schedule.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { timetable, view } = schedule;

    const handleRemove = () => {
        if (!timetable || !confirm(`Удалить расписание «${timetable.title}»?`)) return;
        schedule.remove(timetable.id);
    };

    return (
        <CommonWrapper
            title="Расписание"
            description="Учебное расписание по специальностям, курсам и группам"
            action={
                <div className="flex items-center gap-4">
                    <ScheduleExportButton
                        label={schedule.exportLabel}
                        exporting={schedule.exporting}
                        disabled={!timetable}
                        onExport={schedule.download}
                    />
                    <CommonShareLink label="Ссылка" />
                    {/* Изменять — только с правом schedule.post */}
                    <Can section={PermissionSection.SCHEDULE}>
                        {timetable && (
                            <>
                                <span
                                    className="icon-inline cursor-pointer text-destructive"
                                    onClick={handleRemove}
                                    title="Удалить это расписание"
                                >
                                    <Trash2Icon className="size-4" />
                                </span>
                                {/* The editor builds weekly grids; senior-course lectures and cycles come from the seed for now. */}
                                {timetable.format !== "cycles" && (
                                    <span
                                        className="icon-inline cursor-pointer"
                                        onClick={() => navigate(ROUTE.STUDY.SCHEDULE_EDIT.replace(":id", timetable.id))}
                                        title="Редактировать это расписание"
                                    >
                                        <PencilIcon className="size-4" />
                                    </span>
                                )}
                            </>
                        )}
                        <PlusIcon
                            className="size-4 cursor-pointer"
                            onClick={() => navigate(ROUTE.STUDY.SCHEDULE_NEW)}
                        />
                    </Can>
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
