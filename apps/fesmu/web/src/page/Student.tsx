import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { StudentList, exportStudentsToWord, useStudent } from "@/widgets/student";
import { FileDownIcon, PlusIcon } from "lucide-react";
import { UserImportButton } from "@/widgets/user-import";
import { useEffect, useMemo, useState } from "react";

export default function StudentPage() {
    const { fetch, list, loading, error, empty, studentModal, activeMenu } = useStudent();
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredList = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return list;

        return list.filter((row) => {
            const user = row.user;
            const fullName = `${user?.lastName ?? ""} ${user?.firstName ?? ""} ${user?.patronymic ?? ""}`.toLowerCase();
            return (
                fullName.includes(query) ||
                user?.email?.toLowerCase().includes(query) ||
                row.student?.group.toLowerCase().includes(query)
            );
        });
    }, [list, search]);

    const { pageItems, paginationProps } = usePagination(filteredList, { resetKey: search });

    return (
        <CommonWrapper
            title="Студенты"
            description="Список студентов (MDM)"
            action={
                <div className="flex items-center gap-4">
                    <UserImportButton />
                    <span
                        className="icon-inline cursor-pointer"
                        onClick={() => exportStudentsToWord(filteredList)}
                        title="Экспорт в Word"
                    >
                        <FileDownIcon className="size-4" />
                    </span>
                    <PlusIcon
                        className="size-4 cursor-pointer"
                        onClick={() => studentModal.openModal("create")}
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
                            placeholder="Поиск по ФИО, email или группе"
                        />
                    ),
                },
            }}
        >
            <>
                <StudentList
                    list={pageItems}
                    studentModal={studentModal}
                    activeMenu={activeMenu}
                    isLoading={loading}
                    isError={!!error}
                    isEmpty={empty}
                />

                <CommonPagination {...paginationProps} />
            </>
        </CommonWrapper>
    );
}
