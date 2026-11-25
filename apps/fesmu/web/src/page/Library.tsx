import { PlusIcon } from "lucide-react";
import { Can } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { LibraryContinue, LibraryFilters, LibraryItemFormModal, LibraryList, useLibraryCatalog } from "@/widgets/library";

/** Каталог библиотеки: издания по дисциплинам — файлы открываются в
 *  читалке, ссылки ведут на внешний ресурс. Добавляет и правит — library.post. */
export default function LibraryPage() {
    const state = useLibraryCatalog();
    return (
        <CommonWrapper
            title="Библиотека"
            description="Учебники, пособия и внешние ресурсы по дисциплинам"
            action={
                <Can section={PermissionSection.LIBRARY}>
                    <PlusIcon className="size-4 cursor-pointer" onClick={state.openCreate} aria-label="Добавить издание" />
                </Can>
            }
            filter={{ render: { count: state.visible.length, children: <LibraryFilters state={state} /> } }}
        >
            <LibraryContinue state={state} />
            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={state.visible.length === 0}>
                <LibraryList state={state} />
            </CommonControlState>
            <LibraryItemFormModal state={state} />
        </CommonWrapper>
    );
}
