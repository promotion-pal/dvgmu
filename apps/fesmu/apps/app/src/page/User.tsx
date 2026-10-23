import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { UserList, exportUsersToWord, useUser } from "@/widgets/user";
import { FileDownIcon, PlusIcon, SquareCheckBigIcon, Trash2Icon } from "lucide-react";
import { UserImportButton } from "@/widgets/user-import";
import { useEffect, useMemo, useState } from "react";

export default function UserPage() {
    const {
        fetch, list, loading, error, empty, userModal, activeMenu,
        selectedIds, toggleSelected, clearSelected, selectAll, removeSelected,
    } = useUser();
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredList = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return list;

        return list.filter((item) => {
            const fullName = `${item.lastName} ${item.firstName} ${item.patronymic ?? ""}`.toLowerCase();
            return (
                fullName.includes(query) ||
                item.email?.toLowerCase().includes(query) ||
                item.phone?.toLowerCase().includes(query)
            );
        });
    }, [list, search]);

    const { pageItems, paginationProps } = usePagination(filteredList, { resetKey: search });

    const allSelected = filteredList.length > 0 && filteredList.every((item) => selectedIds.has(item.id));

    const handleExport = () => {
        const target =
            selectedIds.size > 0
                ? filteredList.filter((item) => selectedIds.has(item.id))
                : filteredList;

        exportUsersToWord(target);
    };

    return (
        <CommonWrapper
            title="Пользователи"
            description="Список пользователей (MDM)"
            action={
                <div className="flex items-center gap-4">
                    <UserImportButton />
                    {selectedIds.size > 0 && (
                        <span
                            className="icon-inline gap-1 cursor-pointer text-destructive text-xs"
                            onClick={removeSelected}
                            title={`Удалить выбранных (${selectedIds.size})`}
                        >
                            <Trash2Icon className="size-4" />
                            {selectedIds.size}
                        </span>
                    )}
                    <span
                        className="icon-inline cursor-pointer"
                        onClick={() => (allSelected ? clearSelected() : selectAll(filteredList.map((item) => item.id)))}
                        title={allSelected ? "Снять выделение" : `Выбрать всех (${filteredList.length})`}
                    >
                        <SquareCheckBigIcon className="size-4" />
                    </span>
                    <span
                        className="icon-inline cursor-pointer"
                        onClick={handleExport}
                        title={
                            selectedIds.size > 0
                                ? `Экспорт выбранных (${selectedIds.size}) в Word`
                                : "Экспорт всех в Word"
                        }
                    >
                        <FileDownIcon className="size-4" />
                    </span>
                    <PlusIcon
                        className="size-4 cursor-pointer"
                        onClick={() => userModal.openModal("create")}
                    />
                </div>
            }
            filter={{
                render: {
                    count: filteredList.length,
                    children: (
                        <CommonSearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Поиск по ФИО, email или телефону"
                        />
                    ),
                },
            }}
        >
            <>
                <UserList
                    list={pageItems}
                    userModal={userModal}
                    activeMenu={activeMenu}
                    selectedIds={selectedIds}
                    toggleSelected={toggleSelected}
                    isLoading={loading}
                    isError={!!error}
                    isEmpty={empty}
                />

                <CommonPagination {...paginationProps} />
            </>
        </CommonWrapper>
    );
}
