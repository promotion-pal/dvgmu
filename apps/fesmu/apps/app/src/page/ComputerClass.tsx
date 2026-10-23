import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { Can, useCan } from "@/features/access";
import { useUrlViewMode } from "@/features/lib/url-state";
import { CommonShareLink } from "@/shared/components/share";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { PermissionAction, PermissionSection } from "@/shared/config/permissions";
import { ComputerClassBoard, ComputerClassFilters, ComputerClassFormModal, useComputerClass } from "@/widgets/computer-class";

/** Staff page of the computer classes' timetable: everything the public page
 * shows; with computer_classes.post also adding, editing and deleting lessons
 * and testing (and fixing clashes). */
export default function ComputerClassPage() {
    const canEdit = useCan(PermissionSection.COMPUTER_CLASSES, PermissionAction.POST);
    const state = useComputerClass({ editable: canEdit });
    const viewModeState = useUrlViewMode("table");

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CommonWrapper
            title="Расписание компьютерных классов"
            description="Занятия и компьютерное тестирование: когда и в каком кабинете"
            action={
                <div className="flex items-center gap-4">
                    <CommonShareLink label="Ссылка" />
                    {/* Изменять — только с правом computer_classes.post */}
                    <Can section={PermissionSection.COMPUTER_CLASSES}>
                        <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreate} aria-label="Добавить запись" />
                    </Can>
                </div>
            }
            filter={{ render: { count: state.visible.length, className: "w-full", children: <ComputerClassFilters state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false}>
                <ComputerClassBoard state={state} viewModeState={viewModeState} />
            </CommonControlState>
            {canEdit && <ComputerClassFormModal state={state} />}
        </CommonWrapper>
    );
}
