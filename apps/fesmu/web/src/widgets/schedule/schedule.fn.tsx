import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useFetchState } from "@/features/lib/fetch";
import { scheduleApi } from "./schedule.api";
import type { ScheduleFilters, ScheduleTimetable } from "./schedule.schema";
import { resolveLinkedFilters, useScheduleUrlFilters } from "./schedule.url";
import { describeExportScope, exportSchedule } from "./schedule.export";
import { buildTimetableView } from "./schedule.cycles.utils";
import {
    applyFilterChange,
    buildOptions,
    resolveTimetable,
    todayIso,
} from "./schedule.utils";
import type { ScheduleView } from "./schedule.utils";

/** State of the schedule page: the loaded timetables, the filters, and the
 * view derived from both. Everything the service knows comes through scheduleApi;
 * the filters live in the URL (see schedule.url.ts), so the page can be shared. */
const useSchedule = () => {
    const listState = useFetchState<ScheduleTimetable>();
    const [filters, setFilters] = useScheduleUrlFilters();
    const [today] = useState(todayIso);

    const fetch = async () => {
        listState.setLoading(true);
        listState.setError(false);

        try {
            const timetables = await scheduleApi.fetch();
            listState.setList(timetables);
            // Keep what the link asked for, as far as the loaded data allows.
            setFilters((asked) => resolveLinkedFilters(timetables, asked));
        } catch (error) {
            console.error("Ошибка при получении расписания:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const remove = async (id: string) => {
        try {
            await scheduleApi.remove(id);
            toast.success("Расписание удалено");
            await fetch();
        } catch (error) {
            console.error("Ошибка при удалении расписания:", error);
            toast.error("Не удалось удалить расписание");
        }
    };

    const timetable = resolveTimetable(listState.list, filters);

    const view = useMemo((): ScheduleView | undefined =>
        timetable && buildTimetableView(timetable, filters, today), [timetable, filters, today]);
    const options = useMemo(
        () => buildOptions(listState.list, filters, timetable),
        [listState.list, filters, timetable],
    );

    const changeFilters = (change: Partial<ScheduleFilters>) =>
        setFilters((current) => applyFilterChange(listState.list, current, change));

    // Program, course and the stream/semester variant pick *which* timetable is shown, so "reset" leaves them alone.
    const resetFilters = () =>
        setFilters((current) => ({
            programId: current.programId,
            course: current.course,
            timetableId: current.timetableId,
            subjectIds: [],
            weekdays: [],
        }));

    const [exporting, setExporting] = useState(false);
    /** Downloads what is filtered, or the whole course when nothing is. */
    const download = async () => {
        if (!timetable) return;
        setExporting(true);
        try {
            const saved = await exportSchedule(listState.list, timetable, filters);
            if (!saved) toast.info("По выбранным фильтрам выгружать нечего");
        } catch (error) {
            console.error("Ошибка при выгрузке расписания:", error);
            toast.error("Не удалось выгрузить расписание");
        } finally {
            setExporting(false);
        }
    };

    const hasActiveFilters =
        filters.subjectIds.length > 0 ||
        filters.weekdays.length > 0 ||
        Boolean(filters.groupId || filters.dateFrom || filters.dateTo);

    return {
        fetch,
        remove,
        error: listState.error,
        empty: listState.empty,
        loading: listState.loading,
        timetable,
        view,
        options,
        filters,
        changeFilters,
        resetFilters,
        hasActiveFilters,
        download,
        exporting,
        exportLabel: describeExportScope(filters),
    };
};

export { useSchedule };
