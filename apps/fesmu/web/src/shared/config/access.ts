import { UserRole } from "@dvgmu/contract/fesmu/enum/v1/user.enum_pb";

/* Кто в какой раздел. Роли назначаются в MDM (страница «Роли»); ADMIN
 * проходит любую проверку. Та же раскладка — в api (auth.Interceptor.Access
 * в internal/app/app.go): здесь только меню и экраны, защищает api. */
export const ACCESS = {
    /** Сотрудник — кто он (вкладка «Сотрудники»). Разделы ему открывают
     *  права из наборов доступа (shared/config/permissions.ts), не роль. */
    STAFF: [UserRole.STAFF],
    /** Конструктор и сессии тестов. */
    TEACHER: [UserRole.TEACHER],
    /** Заказ справки и просмотр расписания. */
    STUDENT: [UserRole.STUDENT],
    /** Роли, связи AD↔MDM, люди (перс. данные), задолженность, закупки. */
    ADMIN: [UserRole.ADMIN],
} as const;
