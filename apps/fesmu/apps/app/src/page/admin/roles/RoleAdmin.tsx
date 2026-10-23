import { useEffect, useMemo, useState } from "react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { DepartmentFilter, matchesDepartment } from "@/shared/components/department";
import type { DepartmentFilterValue } from "@/shared/components/department";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { BulkBar, IssuedCodeDialog, ROLES, ROLE_LABEL, RoleUserTable, formatUserFullName, useRoleAdmin, isEmployee } from "@/widgets/role-admin";

const ALL = "all";
const NO_ROLE = "none";
const NO_GROUP = "none";

export function RoleAdmin() {
    const admin = useRoleAdmin();
    const { fetch, users, selected } = admin;
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>(ALL);
    const [groupFilter, setGroupFilter] = useState<string>(ALL);
    const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilterValue>("all");

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const query = search.trim().toLowerCase();

    const filteredUsers = useMemo(() => {
        return users.list.filter((user) => {
            if (roleFilter === NO_ROLE && user.roles.length > 0) return false;
            if (roleFilter !== ALL && roleFilter !== NO_ROLE && !user.roles.includes(Number(roleFilter))) return false;
            // «Без подразделения» — сотрудники без него, не все остальные.
            if (departmentFilter === "none" && !isEmployee(user)) return false;
            if (!matchesDepartment(user.departments, departmentFilter)) return false;
            if (groupFilter === NO_GROUP && user.accessGroupIds.length > 0) return false;
            if (groupFilter !== ALL && groupFilter !== NO_GROUP && !user.accessGroupIds.some((id) => String(id) === groupFilter)) return false;
            if (!query) return true;
            return [formatUserFullName(user), user.username ?? "", user.email]
                .some((value) => value.toLowerCase().includes(query));
        });
    }, [users.list, query, roleFilter, groupFilter, departmentFilter]);

    const usersPage = usePagination(filteredUsers, { resetKey: `${query}|${roleFilter}|${groupFilter}|${departmentFilter}` });
    const allFoundSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selected.has(user.id));

    return (
        <CommonWrapper
            title="Роли"
            description="Роль — кто человек (студент, преподаватель, сотрудник), доступ — какие разделы ему открыты. Изменения сохраняются сразу; отметьте нескольких — появится панель массовых действий"
            filter={{
                render: {
                    count: filteredUsers.length,
                    children: (
                        <>
                            <CommonSearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="Поиск по ФИО, логину или email"
                            />
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-auto min-w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>Все пользователи</SelectItem>
                                    <SelectItem value={NO_ROLE}>Без роли</SelectItem>
                                    {ROLES.map((role) => (
                                        <SelectItem key={role} value={String(role)}>{ROLE_LABEL[role]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <DepartmentFilter value={departmentFilter} onChange={setDepartmentFilter} />
                            <Select value={groupFilter} onValueChange={setGroupFilter}>
                                <SelectTrigger className="w-auto min-w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>Любые доступы</SelectItem>
                                    <SelectItem value={NO_GROUP}>Без доступа</SelectItem>
                                    {admin.groups.map((g) => (
                                        <SelectItem key={g.id.toString()} value={g.id.toString()}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    ),
                },
            }}
        >
            <div className="flex flex-col gap-3">
                <BulkBar
                    groups={admin.groups}
                    selectedCount={selected.size}
                    foundCount={filteredUsers.length}
                    allFoundSelected={allFoundSelected}
                    progress={admin.bulkProgress}
                    onSelectFound={() => admin.setChecked(filteredUsers.map((user) => user.id), true)}
                    onClear={admin.clearSelected}
                    onApply={admin.applyBulk}
                />
                <RoleUserTable
                    list={usersPage.pageItems}
                    groups={admin.groups}
                    saving={admin.saving}
                    locked={admin.bulkProgress !== null}
                    selected={selected}
                    onCheck={admin.setChecked}
                    onToggleRole={admin.toggleRole}
                    onToggleGroup={admin.toggleGroup}
                    onSetDepartments={admin.setDepartments}
                    onSetPosition={admin.setPosition}
                    onIssueCode={admin.issueCode}
                    isLoading={users.loading}
                    isError={users.error}
                    isEmpty={filteredUsers.length === 0}
                />
                <CommonPagination {...usersPage.paginationProps} />
                <IssuedCodeDialog issued={admin.issued} onClose={admin.closeIssued} />
            </div>
        </CommonWrapper>
    );
}
