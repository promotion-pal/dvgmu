import { CommonWrapper } from "@/shared/components/wrapper";
import { ScheduleCollectPanel } from "@/widgets/schedule-collect";

/** Standalone page for teachers to submit their own schedule rows in the
 * university's exchange format — no app-sidebar, no login: only this page's
 * link and a form. Submitted rows are echoed back below it, so it's visible
 * what has already been filled in. */
export default function ScheduleCollectPage() {
    return (
        <CommonWrapper
            title="Сбор данных расписания"
            description="Заполните одно занятие и нажмите «Добавить запись» — можно добавить сколько угодно занятий подряд."
        >
            <ScheduleCollectPanel />
        </CommonWrapper>
    );
}
