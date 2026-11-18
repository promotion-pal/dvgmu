import type { ComponentType } from "react";
import type { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";
import { BookOpenTextIcon, ChartColumnIcon, QrCodeIcon, BriefcaseIcon, LibraryIcon, Building2Icon, FileCheckIcon, CalendarDaysIcon, CalendarRangeIcon, ClipboardListIcon, FileTextIcon, GraduationCapIcon, HourglassIcon, ListChecksIcon, ListTodoIcon, MonitorIcon, ReceiptTextIcon, ShieldCheckIcon, ShoppingBagIcon, ShoppingCartIcon, TicketIcon, UsersIcon } from "lucide-react";
import { ACCESS } from "@/shared/config/access";
import { PermissionSection, PURCHASE_SECTIONS, PURCHASE_V3_PERMS, permsFor, permsForAny } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";

interface NavItem {
    title: string;
    url: string;
    icon: ComponentType<{ className?: string }>;
    /** Only for these roles (ADMIN sees everything); none — for every signed-in user. */
    roles?: UserRole[];
    /** And/or only with one of these rights (ADMIN has all). */
    permissions?: string[];
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
        label: "Студенту",
        items: [
            { title: "Заказать справку", url: ROUTE.MY.CERTIFICATE, icon: FileTextIcon, roles: [...ACCESS.STUDENT] },
            { title: "Расписание", url: ROUTE.MY.SCHEDULE, icon: CalendarDaysIcon, roles: [...ACCESS.STUDENT] },
        ],
    },
    {
        label: "Навигация",
        items: [
            // Разделы сотрудников открывают права из наборов доступа.
            { title: "Инфраструктура", url: ROUTE.USER.INFRASTRUCTURE, icon: Building2Icon, permissions: permsFor(PermissionSection.INFRASTRUCTURE) },
            { title: "Инвентарь", url: ROUTE.USER.INVENTORY, icon: ClipboardListIcon, permissions: permsFor(PermissionSection.INVENTORY) },
            // Люди — персональные данные: только администратор.
            { title: "Пользователи", url: ROUTE.USER.USERS, icon: UsersIcon, roles: [...ACCESS.ADMIN] },
            { title: "Студенты", url: ROUTE.USER.STUDENTS, icon: GraduationCapIcon, roles: [...ACCESS.ADMIN] },
            { title: "Сотрудники", url: ROUTE.USER.EMPLOYEES, icon: BriefcaseIcon, roles: [...ACCESS.ADMIN] },
            { title: "Заявки", url: ROUTE.USER.TICKETS, icon: TicketIcon, permissions: permsFor(PermissionSection.TICKETS) },
        ],
    },
    {
        label: "Учёба",
        items: [
            { title: "Расписание", url: ROUTE.STUDY.SCHEDULE, icon: CalendarDaysIcon, permissions: permsFor(PermissionSection.SCHEDULE) },
            // Страница доступна всем вошедшим: halls.post открывает общее
            // расписание и модерацию, остальные видят форму личной заявки.
            { title: "Заявка / расписание лекционных залов", url: ROUTE.STUDY.SCHEDULE_HALL, icon: CalendarRangeIcon },
            { title: "Расписание (компьютерные классы)", url: ROUTE.STUDY.COMPUTER_CLASS, icon: MonitorIcon, permissions: permsFor(PermissionSection.COMPUTER_CLASSES) },
        ],
    },
    {
        label: "Тесты",
        items: [
            { title: "Тесты V1 · Банк вопросов", url: ROUTE.TESTS.BUILDER, icon: ListChecksIcon, permissions: permsFor(PermissionSection.TESTS) },
            { title: "Тесты V2 · Верные и неверные", url: ROUTE.TESTS.BUILDER_V2, icon: ListTodoIcon, permissions: permsFor(PermissionSection.TESTS) },
            { title: "Сессии тестирования", url: ROUTE.TESTS.SESSIONS, icon: HourglassIcon, permissions: permsFor(PermissionSection.TESTS) },
            { title: "Экзаменационное тестирование V2", url: ROUTE.EXAM_TESTS.V2, icon: FileCheckIcon, permissions: permsFor(PermissionSection.EXAM_TESTS) },
 {title:"Мои результаты экзаменов",url:ROUTE.EXAM_TESTS.MY_RESULTS,icon:ListChecksIcon,roles:[...ACCESS.STUDENT]},
 { title: "Экзаменационное тестирование", url: ROUTE.EXAM_TESTS.BUILDER, icon: FileCheckIcon, permissions: permsFor(PermissionSection.EXAM_TESTS) },
            { title: "Сессии экзаменов", url: ROUTE.EXAM_TESTS.SESSIONS, icon: HourglassIcon, permissions: permsFor(PermissionSection.EXAM_TESTS) },
        ],
    },
    {
        label: "Закупки",
        items: [
            // Любое право закупок v3 (purchase.*); этапы и кнопки — по правам, отделу и направлению.
            { title: "Закупки", url: ROUTE.PURCHASE.V3, icon: ShoppingBagIcon, permissions: PURCHASE_V3_PERMS },
        ],
    },
    {
        label: "Аналитика",
        items: [
            { title: "Опросы", url: ROUTE.ANALYTICS.SURVEYS, icon: QrCodeIcon, permissions: permsFor(PermissionSection.ANALYTICS) },
            { title: "Отчёт по полям", url: ROUTE.ANALYTICS.REPORT, icon: ChartColumnIcon, permissions: permsFor(PermissionSection.ANALYTICS) },
        ],
    },
    {
        label: "Демо",
        items: [
            // Старый демо-процесс закупок (v2): разделы «Демо» в доступах.
            { title: "Закупки (демо)", url: ROUTE.PURCHASE.V2, icon: ShoppingCartIcon, permissions: permsForAny(PURCHASE_SECTIONS) },
        ],
    },
    {
        label: "Библиотека",
        items: [
            // Читать — всем, кто вошёл; добавлять и писать — по правам library/manuals.
            { title: "Каталог", url: ROUTE.LIBRARY.CATALOG, icon: LibraryIcon },
            { title: "Методички", url: ROUTE.LIBRARY.MANUALS, icon: BookOpenTextIcon },
        ],
    },
    {
        label: "Деканат",
        items: [
            { title: "Студенты и входы", url: ROUTE.DEANERY.STUDENTS, icon: UsersIcon, permissions: permsFor(PermissionSection.DEANERY) },
        ],
    },
    {
        label: "Администрирование",
        items: [
            { title: "Справки", url: ROUTE.ADMIN.CERTIFICATES, icon: FileCheckIcon, permissions: permsFor(PermissionSection.CERTIFICATE) },
            { title: "Авторизация", url: ROUTE.ADMIN.AUTH, icon: ShieldCheckIcon, roles: [...ACCESS.ADMIN] },
            { title: "Задолженность студентов", url: ROUTE.ADMIN.DEBTORS, icon: ReceiptTextIcon, roles: [...ACCESS.ADMIN] },
        ],
    },
];

type HasRole = (...roles: UserRole[]) => boolean;
type HasPermission = (...permissions: string[]) => boolean;

/** Разделы меню, доступные пользователю с такими ролями и правами. */
export const visibleGroups = (hasRole: HasRole, hasPermission: HasPermission) =>
    NAV_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    (!item.roles || hasRole(...item.roles)) &&
                    (!item.permissions || hasPermission(...item.permissions)),
            ),
        }))
        .filter((group) => group.items.length > 0);

/** Куда вести с главной: первый доступный раздел, без ролей — профиль. */
export const firstAllowedUrl = (hasRole: HasRole, hasPermission: HasPermission) =>
    visibleGroups(hasRole, hasPermission)[0]?.items[0]?.url ?? ROUTE.USER.PROFILE;
