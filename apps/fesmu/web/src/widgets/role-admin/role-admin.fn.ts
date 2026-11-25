import { useFetchState } from "@/features/lib/fetch";
import type { UserPermissionGroup, User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { UserRole } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import { connectTransport } from "@/shared/config/api";
import { ConnectError, createClient } from "@connectrpc/connect";
import { useState } from "react";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { toast } from "sonner";

const userClient = createClient(UserService, connectTransport);

/** Роли, которые назначаются вручную, в порядке колонок таблицы. */
const ROLES = [UserRole.STUDENT, UserRole.STAFF, UserRole.TEACHER, UserRole.ADMIN] as const;

const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
    [UserRole.STUDENT]: "Студент",
    [UserRole.STAFF]: "Сотрудник",
    [UserRole.TEACHER]: "Преподаватель",
    [UserRole.ADMIN]: "Администратор",
};

const formatUserFullName = (item: User) =>
    `${item.lastName} ${item.firstName} ${item.patronymic || ""}`.trim();

const withRole = (roles: UserRole[], role: UserRole, on: boolean) =>
    on ? [...new Set([...roles, role])].sort((a, b) => a - b) : roles.filter((r) => r !== role);

const withGroup = (ids: bigint[], id: bigint, on: boolean) =>
    on ? [...new Set([...ids, id])].sort((a, b) => (a < b ? -1 : 1)) : ids.filter((g) => g !== id);

/** Массовое действие над отмеченными: добавить/убрать роль или доступ (набор). */
type BulkAction =
    | { kind: "role"; on: boolean; role: UserRole }
    | { kind: "group"; on: boolean; id: bigint };

// Одновременных запросов в MDM при массовом действии.
const BULK_CONCURRENCY = 5;

const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));

type BulkTarget = { user: User; save: () => Promise<{ user?: User }> };

const useRoleAdmin = () => {
    const userState = useFetchState<User>();
    // id пользователей, по которым сейчас идёт сохранение — их чекбоксы блокируются.
    const [saving, setSaving] = useState<Set<bigint>>(new Set());

    // Наборы доступа — для колонки «Доступы» и массовой выдачи.
    const [groups, setGroups] = useState<UserPermissionGroup[]>([]);
    const [groupAssignments, setGroupAssignments] = useState<Map<bigint, bigint[]>>(new Map());
    const groupIdsForUser = (userID: bigint) => groupAssignments.get(userID) ?? [];

    const fetchUsers = async () => {
        userState.setLoading(true);
        userState.setError(false);

        try {
            const [response, groupResponse, assignmentResponse] = await Promise.all([
                userClient.userFetch({}),
                userClient.userPermissionGroupFetch({}),
                userClient.userPermissionGroupAssignmentsFetch({}),
            ]);
            userState.setList(response.users);
            setGroups(groupResponse.groups);
            const assignments = new Map<bigint, bigint[]>();
            for (const assignment of assignmentResponse.assignments) {
                const userID = assignment.userId;
                assignments.set(userID, [...(assignments.get(userID) ?? []), assignment.groupId]);
            }
            setGroupAssignments(assignments);
        } catch (error) {
            console.error("Ошибка при получении пользователей MDM:", error);
            userState.setError(true);
        } finally {
            userState.setLoading(false);
        }
    };

    const replaceUser = (user: User) =>
        userState.setList((list) => list.map((item) => (item.id === user.id ? user : item)));

    // Сразу отмечаем в таблице, на ошибке возвращаем как было.
    const toggleRole = async (user: User, role: UserRole, on: boolean) => {
        const roles = withRole(user.roles, role, on);
        replaceUser({ ...user, roles });
        setSaving((prev) => new Set(prev).add(user.id));

        try {
            const response = await userClient.userRolesSet({ id: user.id, roles });
            if (response.user) replaceUser(response.user);
        } catch (error) {
            console.error("Ошибка при сохранении ролей:", error);
            replaceUser(user);
            toast.error(`Не удалось сохранить роли: ${formatUserFullName(user)}`);
        } finally {
            setSaving((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
        }
    };

    const toggleGroup = async (user: User, id: bigint, on: boolean) => {
        const previous = groupIdsForUser(user.id);
        const permissionGroupIds = withGroup(previous, id, on);
        setGroupAssignments((current) => new Map(current).set(user.id, permissionGroupIds));
        setSaving((prev) => new Set(prev).add(user.id));

        try {
            const response = await userClient.userPermissionGroupsSet({ id: user.id, groupIds: permissionGroupIds });
            if (response.user) replaceUser(response.user);
        } catch (error) {
            console.error("Ошибка при выдаче набора доступа:", error);
            setGroupAssignments((current) => new Map(current).set(user.id, previous));
            toast.error(`Не удалось сохранить доступы: ${formatUserFullName(user)}`);
        } finally {
            setSaving((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
        }
    };

    // Отмеченные пользователи (между страницами и фильтрами сохраняются).
    const [selected, setSelected] = useState<Set<bigint>>(new Set());
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

    const setChecked = (ids: bigint[], on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
            return next;
        });

    // Каждому отмеченному — свой запрос с его новым набором; кому менять
    // нечего, тех пропускаем. Ошибка по одному не останавливает остальных.
    const applyBulk = async (action: BulkAction) => {
        const targets = userState.list.filter((user) => selected.has(user.id)).flatMap((user): BulkTarget[] => {
            if (action.kind === "role") {
                const roles = withRole(user.roles, action.role, action.on);
                return sameSet(roles, user.roles) ? [] : [{ user, save: () => userClient.userRolesSet({ id: user.id, roles }) }];
            }
            const previous = groupIdsForUser(user.id);
            const groupIds = withGroup(previous, action.id, action.on);
            return sameSet(groupIds, previous)
                ? []
                : [{ user, save: async () => {
                    const response = await userClient.userPermissionGroupsSet({ id: user.id, groupIds });
                    setGroupAssignments((current) => new Map(current).set(user.id, groupIds));
                    return response;
                } }];
        });
        if (targets.length === 0) {
            toast.info("Менять нечего: у всех отмеченных уже так.");
            return;
        }

        let done = 0;
        const failed: User[] = [];
        setBulkProgress({ done, total: targets.length });
        const queue = [...targets];
        const worker = async () => {
            for (let item = queue.shift(); item; item = queue.shift()) {
                try {
                    const response = await item.save();
                    if (response.user) replaceUser(response.user);
                } catch (error) {
                    console.error("Ошибка массового действия:", error);
                    failed.push(item.user);
                }
                setBulkProgress({ done: ++done, total: targets.length });
            }
        };
        await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, targets.length) }, worker));
        setBulkProgress(null);

        if (failed.length === 0) {
            toast.success(`Готово: изменено ${targets.length}.`);
            setSelected(new Set());
        } else {
            // Неудачные остаются отмеченными — можно повторить.
            setSelected(new Set(failed.map((user) => user.id)));
            toast.error(`Изменено ${targets.length - failed.length} из ${targets.length}. Не удалось: ${failed.map(formatUserFullName).slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`);
        }
    };

    // Код показывается один раз: в MDM хранится только его хеш.
    const [issued, setIssued] = useState<{ user: User; code: string; expiresAt: Date } | null>(null);

    const issueCode = async (user: User) => {
        try {
            const response = await userClient.activationIssue({ id: user.id });
            setIssued({
                user,
                code: response.code,
                expiresAt: response.expiresAt ? timestampDate(response.expiresAt) : new Date(),
            });
        } catch (error) {
            console.error("Ошибка при выдаче кода активации:", error);
            toast.error(`Не удалось выдать код: ${ConnectError.from(error).rawMessage}`);
        }
    };

    return {
        fetch: fetchUsers,
        users: userState,
        saving,
        toggleRole,
        toggleGroup,
        groups,
        groupIdsForUser,
        selected,
        setChecked,
        clearSelected: () => setSelected(new Set()),
        applyBulk,
        bulkProgress,
        issued,
        issueCode,
        closeIssued: () => setIssued(null),
    };
};

export { ROLES, ROLE_LABEL, formatUserFullName, useRoleAdmin };
export type { BulkAction };
