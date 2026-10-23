import { useNavigate, generatePath } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { ManualCreateModal, ManualFilters, ManualList, useManualList } from "@/widgets/manual";

/** Методички по дисциплинам. Студенты видят опубликованные; с manuals.post —
 *  ещё черновики, создание и редактор. */
export default function ManualsPage() {
    const state = useManualList();
    const navigate = useNavigate();
    return (
        <CommonWrapper
            title="Методички"
            description="Методические пособия кафедр — темы, задачи, алгоритмы и самопроверка"
            action={
                <Can section={PermissionSection.MANUALS}>
                    <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreate} aria-label="Создать методичку" />
                </Can>
            }
            filter={{ render: { count: state.count, children: <ManualFilters state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={state.count === 0}>
                <ManualList state={state} />
            </CommonControlState>
            <ManualCreateModal state={state} onCreated={(id) => navigate(generatePath(ROUTE.LIBRARY.MANUAL_EDIT, { id }))} />
        </CommonWrapper>
    );
}
