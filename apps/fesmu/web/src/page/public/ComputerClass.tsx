import { useEffect } from "react";
import { useUrlViewMode } from "@/features/lib/url-state";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { ComputerClassBoard, ComputerClassFilters, useComputerClass } from "@/widgets/computer-class";

/** Public, read-only computer classes' timetable — students check where and
 * when their testing is. Filters live in the URL, so a link opens on a room/date. */
export default function PublicComputerClassPage() {
    const state = useComputerClass();
    const viewModeState = useUrlViewMode("cards");

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Расписание компьютерных классов"
            description="Занятия и компьютерное тестирование: когда и в каком кабинете"
            action={<CommonShareLink label="Ссылка на это расписание" />}
            filter={{ render: { count: state.visible.length, className: "w-full", children: <ComputerClassFilters state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false}>
                <ComputerClassBoard state={state} viewModeState={viewModeState} />
            </CommonControlState>
        </CommonWrapper>
    );
}
