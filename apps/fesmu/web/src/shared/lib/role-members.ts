import type { User } from "@dvgmu/mdm/entity/user.entity_pb";
import type { UserRole } from "@dvgmu/mdm/enum/user.enum_pb";

/* Раздел «Сотрудники»/«Студенты» = записи раздела плюс люди с его ролью, у
 * которых записи ещё нет: роль, выданная на странице «Роли», сама делает
 * человека членом раздела (отдел, группа и т.п. у такого — пустые). */
export const withRoleMembers = <T extends { user?: User }>(
    records: T[],
    users: User[],
    role: UserRole,
    wrap: (user: User) => T,
): T[] => {
    const recorded = new Set(records.flatMap((r) => (r.user ? [r.user.id] : [])));
    const roleOnly = users.filter((u) => u.roles.includes(role) && !recorded.has(u.id)).map(wrap);
    return [...records, ...roleOnly];
};

/** Ключ строки списка: запись раздела, а без неё — пользователь. */
export const memberKey = (recordId: bigint | undefined, user: User | undefined) =>
    recordId !== undefined ? `r${recordId}` : `u${user?.id ?? ""}`;
