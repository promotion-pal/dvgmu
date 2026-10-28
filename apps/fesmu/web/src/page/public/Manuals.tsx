import { ROUTE } from "@/shared/config/path";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { ManualFilters, ManualList, useManualList } from "@/widgets/manual";

/** Опубликованные методички кафедр — открыто, без входа. Черновики, создание
 *  и редактор — в кабинете (ROUTE.LIBRARY.MANUALS). */
export default function PublicManualsPage() {
    const state = useManualList({ open: true });
    return (
        <CommonWrapper
            title="Методички"
            description="Методические пособия кафедр ДВГМУ — темы, алгоритмы манипуляций, задачи и самопроверка"
            filter={{ render: { count: state.count, children: <ManualFilters state={state} /> } }}
        >
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={state.count === 0}>
                <ManualList state={state} readPath={ROUTE.PUBLIC.MANUAL} />
            </CommonControlState>
        </CommonWrapper>
    );
}
