import { useFetchState } from "@/features/lib/fetch";
import type { AccessGroup, User } from "@dvgmu/contract/packages/mdm/entity/user.entity_pb";
import { UserRole } from "@dvgmu/contract/packages/mdm/enum/user.enum_pb";
import type { UserEmployeeDepartment } from "@dvgmu/contract/packages/mdm/enum/user.enum_pb";
import { UserService } from "@dvgmu/contract/packages/mdm/service/user.service_pb";
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
    | { kind: "group"; on: boolean; id: bigint }
    | { kind: "department"; on: boolean; department: UserEmployeeDepartment };

/** Сотрудник — у кого роль «Сотрудник» или уже есть подразделение (чтобы его
 *  можно было снять). Подразделения — только у сотрудников. */
const isEmployee = (user: User) => user.roles.includes(UserRole.STAFF) || user.departments.length > 0;

const withDepartment = (deps: UserEmployeeDepartment[], d: UserEmployeeDepartment, on: boolean) =>
    on ? [...new Set([...deps, d])].sort((a, b) => a - b) : deps.filter((x) => x !== d);

// Одновременных запросов в MDM при массовом действии.
const BULK_CONCURRENCY = 5;

const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));

type BulkTarget = { user: User; save: () => Promise<{ user?: User }> };

const useRoleAdmin = () => {
    const userState = useFetchState<User>();
    // id пользователей, по которым сейчас идёт сохранение — их чекбоксы блокируются.
    const [saving, setSaving] = useState<Set<bigint>>(new Set());

    // Наборы доступа — для колонки «Доступы» и массовой выдачи.
    const [groups, setGroups] = useState<AccessGroup[]>([]);

    const fetchUsers = async () => {
        userState.setLoading(true);
        userState.setError(false);

        try {
            const [response, groupResponse] = await Promise.all([userClient.userFetch({}), userClient.accessGroupFetch({})]);
            userState.setList(response.users);
            setGroups(groupResponse.groups);
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
        const accessGroupIds = withGroup(user.accessGroupIds, id, on);
        replaceUser({ ...user, accessGroupIds });
        setSaving((prev) => new Set(prev).add(user.id));

        try {
            const response = await userClient.userAccessGroupsSet({ id: user.id, groupIds: accessGroupIds });
            if (response.user) replaceUser(response.user);
        } catch (error) {
            console.error("Ошибка при выдаче набора доступа:", error);
            replaceUser(user);
            toast.error(`Не удалось сохранить доступы: ${formatUserFullName(user)}`);
        } finally {
            setSaving((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
        }
    };

    // Подразделения человека: доступы подразделений приходят с ответом MDM.
    const setDepartments = async (user: User, departments: UserEmployeeDepartment[]) => {
        replaceUser({ ...user, departments });
        setSaving((prev) => new Set(prev).add(user.id));

        try {
            const response = await userClient.userDepartmentsSet({ id: user.id, departments });
            if (response.user) replaceUser(response.user);
        } catch (error) {
            console.error("Ошибка при сохранении подразделений:", error);
            replaceUser(user);
            toast.error(`Не удалось сохранить подразделения: ${formatUserFullName(user)}`);
        } finally {
            setSaving((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
        }
    };

    // Должность человека: одна на всех его подразделениях.
    const setPosition = async (user: User, position: string) => {
        position = position.trim();
        if (position === user.position) return;
        replaceUser({ ...user, position });
        setSaving((prev) => new Set(prev).add(user.id));

        try {
            const response = await userClient.userPositionSet({ id: user.id, position });
            if (response.user) replaceUser(response.user);
        } catch (error) {
            console.error("Ошибка при сохранении должности:", error);
            replaceUser(user);
            toast.error(`Не удалось сохранить должность: ${formatUserFullName(user)}`);
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
        let skipped = 0;
        const targets = userState.list.filter((user) => selected.has(user.id)).flatMap((user): BulkTarget[] => {
            if (action.kind === "role") {
                const roles = withRole(user.roles, action.role, action.on);
                return sameSet(roles, user.roles) ? [] : [{ user, save: () => userClient.userRolesSet({ id: user.id, roles }) }];
            }
            if (action.kind === "department") {
                if (action.on && !isEmployee(user)) {
                    skipped++;
                    return [];
                }
                const departments = withDepartment(user.departments, action.department, action.on);
                return sameSet(departments, user.departments)
                    ? []
                    : [{ user, save: () => userClient.userDepartmentsSet({ id: user.id, departments }) }];
            }
            const groupIds = withGroup(user.accessGroupIds, action.id, action.on);
            return sameSet(groupIds, user.accessGroupIds)
                ? []
                : [{ user, save: () => userClient.userAccessGroupsSet({ id: user.id, groupIds }) }];
        });
        const skippedNote = skipped > 0 ? ` Пропущено не-сотрудников: ${skipped} — сначала роль «Сотрудник».` : "";
        if (targets.length === 0) {
            toast.info(`Менять нечего: у всех отмеченных уже так.${skippedNote}`);
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
            toast.success(`Готово: изменено ${targets.length}.${skippedNote}`);
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
        setDepartments,
        setPosition,
        groups,
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

export { ROLES, ROLE_LABEL, formatUserFullName, isEmployee, useRoleAdmin };
export type { BulkAction };
