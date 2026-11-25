import { useEffect, useMemo, useState } from "react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { BulkBar, IssuedCodeDialog, ROLES, ROLE_LABEL, RoleUserTable, formatUserFullName, useRoleAdmin } from "@/widgets/role-admin";

const ALL = "all";
const NO_ROLE = "none";
const NO_GROUP = "none";

export function RoleAdmin() {
    const admin = useRoleAdmin();
    const { fetch, users, selected } = admin;
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>(ALL);
    const [groupFilter, setGroupFilter] = useState<string>(ALL);

    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const query = search.trim().toLowerCase();

    const filteredUsers = useMemo(() => {
        return users.list.filter((user) => {
            if (roleFilter === NO_ROLE && user.roles.length > 0) return false;
            if (roleFilter !== ALL && roleFilter !== NO_ROLE && !user.roles.includes(Number(roleFilter))) return false;
            const groupIds = admin.groupIdsForUser(user.id);
            if (groupFilter === NO_GROUP && groupIds.length > 0) return false;
            if (groupFilter !== ALL && groupFilter !== NO_GROUP && !groupIds.some((id) => String(id) === groupFilter)) return false;
            if (!query) return true;
            return [formatUserFullName(user), user.email.split("@")[0], user.email]
                .some((value) => value.toLowerCase().includes(query));
        });
    }, [users.list, query, roleFilter, groupFilter, admin.groupIdsForUser]);

    const usersPage = usePagination(filteredUsers, { resetKey: `${query}|${roleFilter}|${groupFilter}` });
    const allFoundSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selected.has(user.id));

    return (
        <CommonWrapper
            title="Роли и группы прав пользователей"
            description="Роль определяет тип пользователя, группа прав открывает функции портала. Подразделения и должности сотрудника настраиваются в кадровом разделе. Изменения сохраняются сразу."
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
                    groupIdsForUser={admin.groupIdsForUser}
                    saving={admin.saving}
                    locked={admin.bulkProgress !== null}
                    selected={selected}
                    onCheck={admin.setChecked}
                    onToggleRole={admin.toggleRole}
                    onToggleGroup={admin.toggleGroup}
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
