import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { EmployeeList, exportEmployeesToWord, useEmployee } from "@/widgets/employee";
import { FileDownIcon, PlusIcon } from "lucide-react";
import { UserImportButton } from "@/widgets/user-import";
import { useEffect, useMemo, useState } from "react";
import { DepartmentFilter, matchesDepartment } from "@/shared/components/department";
import type { DepartmentFilterValue } from "@/shared/components/department";

export default function EmployeePage() {
    const { fetch, list, loading, error, empty, employeeModal, activeMenu } = useEmployee();
    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilterValue>("all");

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredList = useMemo(() => {
        const query = search.trim().toLowerCase();

        return list.filter((row) => {
            // Строка — одна запись сотрудника (одно подразделение); у сотрудника только по роли записи нет.
            const department = row.employee?.department;
            if (!matchesDepartment(department ? [department] : [], departmentFilter)) return false;
            if (!query) return true;
            const user = row.user;
            const fullName = `${user?.lastName ?? ""} ${user?.firstName ?? ""} ${user?.patronymic ?? ""}`.toLowerCase();
            return fullName.includes(query) || user?.email?.toLowerCase().includes(query);
        });
    }, [list, search, departmentFilter]);

    const { pageItems, paginationProps } = usePagination(filteredList, { resetKey: `${search}|${departmentFilter}` });

    return (
        <CommonWrapper
            title="Сотрудники"
            description="Список сотрудников (MDM)"
            action={
                <div className="flex items-center gap-4">
                    <UserImportButton />
                    <span
                        className="icon-inline cursor-pointer"
                        onClick={() => exportEmployeesToWord(filteredList)}
                        title="Экспорт в Word"
                    >
                        <FileDownIcon className="size-4" />
                    </span>
                    <PlusIcon
                        className="size-4 cursor-pointer"
                        onClick={() => employeeModal.openModal("create")}
                    />
                </div>
            }
            filter={{
                render: {
                    count: filteredList.length,
                    children: (
                        <>
                            <CommonSearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="Поиск по ФИО или email"
                            />
                            <DepartmentFilter value={departmentFilter} onChange={setDepartmentFilter} />
                        </>
                    ),
                },
            }}
        >
            <>
                <EmployeeList
                    list={pageItems}
                    employeeModal={employeeModal}
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
