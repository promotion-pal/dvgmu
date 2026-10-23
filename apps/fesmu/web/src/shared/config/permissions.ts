import { PermissionAction, PermissionSection } from "@fesmu/contract/fesmu/enum/v1/permission.enum_pb";
import { PurchasePermission } from "@fesmu/contract/fesmu/enum/v3/purchase.enum_pb";

/* Разделы и действия — enum контракта (api/contract/enum/v1/permission.enum.proto),
 * общий с api. Право — строка "раздел.действие" (так оно в MDM и в токене):
 * имя значения в нижнем регистре, perm(PermissionSection.SCHEDULE,
 * PermissionAction.POST) = "schedule.post". Изменение (POST) включает
 * просмотр (FETCH); api сам считает методы ...Fetch/...ByID просмотром.
 *
 * Новый раздел: значение в .proto → buf generate → подпись в SECTIONS, пункт
 * меню с permsFor(), кнопки изменения в <Can section={PermissionSection.X}>. */

export { PermissionAction, PermissionSection };

/** Право action на раздел: "schedule.post". */
export const perm = (section: PermissionSection, action: PermissionAction) =>
    `${PermissionSection[section].toLowerCase()}.${PermissionAction[action].toLowerCase()}`;

/** Права, с которыми действие доступно: просмотр — fetch или post, изменение — post. */
export const permsFor = (section: PermissionSection, action: PermissionAction = PermissionAction.FETCH) =>
    action === PermissionAction.FETCH
        ? [perm(section, PermissionAction.FETCH), perm(section, PermissionAction.POST)]
        : [perm(section, PermissionAction.POST)];

/** Права, с которыми действие доступно хотя бы в одном из разделов. */
export const permsForAny = (sections: readonly PermissionSection[], action: PermissionAction = PermissionAction.FETCH) =>
    sections.flatMap((section) => permsFor(section, action));

/** Разделы закупок v2 — по разделу на роль в процессе; просмотр любого открывает страницу. */
export const PURCHASE_SECTIONS = [
    PermissionSection.PURCHASE_REQUEST,
    PermissionSection.PURCHASE_HEAD,
    PermissionSection.PURCHASE_VICE_RECTOR,
    PermissionSection.PURCHASE_ECONOMIST,
    PermissionSection.PURCHASE_COMMISSION,
] as const;

/** Действия в окне «Доступ», по порядку колонок. */
export const ACTIONS = [PermissionAction.FETCH, PermissionAction.POST] as const;

export const ACTION_LABEL: Record<(typeof ACTIONS)[number], string> = {
    [PermissionAction.FETCH]: "Просмотр",
    [PermissionAction.POST]: "Изменение",
};

/** Группы разделов в окне «Доступ». */
export const SECTION_GROUPS = ["Хозяйство", "Учёба", "Библиотека", "Студентам", "Аналитика", "Демо"] as const;

/** Подписи разделов для окна «Доступ» и профиля. short — подпись внутри своей группы. */
export const SECTIONS: {
    key: PermissionSection;
    group: (typeof SECTION_GROUPS)[number];
    label: string;
    short?: string;
    description: string;
}[] = [
    { key: PermissionSection.INFRASTRUCTURE, group: "Хозяйство", label: "Инфраструктура", description: "Корпуса, этажи, помещения" },
    { key: PermissionSection.INVENTORY, group: "Хозяйство", label: "Инвентарь", description: "Учёт инвентаря" },
    { key: PermissionSection.TICKETS, group: "Хозяйство", label: "Заявки", description: "Заявки общежития и хозяйственные" },
    { key: PermissionSection.SCHEDULE, group: "Учёба", label: "Расписание", description: "Расписание групп, сбор пожеланий" },
    { key: PermissionSection.HALLS, group: "Учёба", label: "Лекционные залы", description: "Расписание и бронирование залов" },
    { key: PermissionSection.COMPUTER_CLASSES, group: "Учёба", label: "Компьютерные классы", description: "Расписание компьютерных классов" },
    { key: PermissionSection.TESTS, group: "Учёба", label: "Тесты", description: "Просмотр — тесты, сессии и результаты, выгрузка в RTF; изменение — создавать, импортировать, выдавать студентам, удалять" },
    { key: PermissionSection.LIBRARY, group: "Библиотека", label: "Библиотека: каталог", short: "Каталог", description: "Изменение — добавлять, править и удалять издания; читать каталог может любой, кто вошёл" },
    { key: PermissionSection.MANUALS, group: "Библиотека", label: "Библиотека: методички", short: "Методички", description: "Изменение — писать, править, публиковать и снимать методички; опубликованные читает любой, кто вошёл" },
    { key: PermissionSection.CERTIFICATE, group: "Студентам", label: "Справки", description: "Просмотр — журнал; изменение — выдача, справка за любого студента" },
    { key: PermissionSection.VACCINATION, group: "Студентам", label: "Вакцинация", description: "Дни и записи на вакцинацию" },
    { key: PermissionSection.ANALYTICS, group: "Аналитика", label: "Аналитика опросов", short: "Опросы", description: "Просмотр — сводки, ответы и выгрузка по опросам; изменение — заводить опросы и QR-точки" },
    { key: PermissionSection.PURCHASE_REQUEST, group: "Демо", label: "Демо закупок: заявки", short: "Заявки", description: "Старый демо-процесс закупок (v2), роль «Сотрудник»: просмотр — открыть демо, изменение — подавать заявки" },
    { key: PermissionSection.PURCHASE_HEAD, group: "Демо", label: "Демо закупок: начальник отдела", short: "Начальник отдела", description: "Изменение — согласовать, вернуть, править и объединять заявки, выбирать проректора" },
    { key: PermissionSection.PURCHASE_VICE_RECTOR, group: "Демо", label: "Демо закупок: проректор", short: "Проректор", description: "Изменение — формировать закупки из заявок, прикреплять КП" },
    { key: PermissionSection.PURCHASE_ECONOMIST, group: "Демо", label: "Демо закупок: экономист", short: "Экономист", description: "Изменение — коды ОКПД2/КТРУ/ОКВЭД2, источник финансирования, НМЦК" },
    { key: PermissionSection.PURCHASE_COMMISSION, group: "Демо", label: "Демо закупок: комиссия", short: "Комиссия", description: "Изменение — включать закупки в ПФХД или отклонять" },
];

/* Закупки v3 — права на отдельные действия, не раздел×действие (enum
 * api/contract/enum/v3/purchase.enum.proto). Право — "purchase.<имя>":
 * purchasePerm(PurchasePermission.REQUEST_CREATE) = "purchase.request_create".
 * Что можно — право; чьё (отдел, направление проректора) — профиль и справочник. */

export { PurchasePermission };

export const purchasePerm = (p: PurchasePermission) => `purchase.${PurchasePermission[p].toLowerCase()}`;

/** Группы прав закупок в окне «Доступ», по ходу процесса. */
export const PURCHASE_PERMISSION_GROUPS = [
    "Закупки: просмотр",
    "Закупки: заявки и планирование",
    "Закупки: подготовка и исполнение",
    "Закупки: администрирование",
] as const;

export const PURCHASE_PERMISSIONS: {
    key: PurchasePermission;
    group: (typeof PURCHASE_PERMISSION_GROUPS)[number];
    label: string;
    description: string;
}[] = [
    { key: PurchasePermission.VIEW_DEPARTMENT, group: "Закупки: просмотр", label: "Просмотр закупок своего отдела", description: "Заявки, поданные сотрудниками отдела, и закупки, которые отдел реализует" },
    { key: PurchasePermission.VIEW_DIRECTION, group: "Закупки: просмотр", label: "Просмотр общих страниц закупок проректором", description: "Заявки и закупки курируемых отделов, актуальные закупки после бюджетной комиссии, сводка по финансам. Направление — по справочнику проректоров" },
    { key: PurchasePermission.VIEW_ALL, group: "Закупки: просмотр", label: "Просмотр всех закупок университета", description: "Все заявки и закупки всех отделов" },
    { key: PurchasePermission.VIEW_PLAN, group: "Закупки: просмотр", label: "Просмотр ПФХД и протоколов", description: "План финансово-хозяйственной деятельности и протоколы бюджетной комиссии" },
    { key: PurchasePermission.REQUEST_CREATE, group: "Закупки: заявки и планирование", label: "Подача заявки на закупку", description: "Подать заявку от своего отдела, дорабатывать возвращённые" },
    { key: PurchasePermission.REQUEST_HEAD_REVIEW, group: "Закупки: заявки и планирование", label: "Согласование заявок отдела начальником", description: "Править, объединять, согласовать, вернуть сотруднику или отклонить заявки своего отдела" },
    { key: PurchasePermission.REQUEST_CURATOR_REVIEW, group: "Закупки: заявки и планирование", label: "Согласование заявок проректором", description: "Согласовать заявки курируемых отделов и направить в реализующий отдел, вернуть, отклонить" },
    { key: PurchasePermission.LOT_MANAGE, group: "Закупки: заявки и планирование", label: "Ведение закупок реализующим отделом", description: "Объединять заявки в закупки, назначать исполнителя, проверять характеристики, КП и ТЗ" },
    { key: PurchasePermission.LOT_PREPARE, group: "Закупки: заявки и планирование", label: "Подготовка закупки исполнителем", description: "Характеристики, стандартизация, КП и ТЗ по порученным закупкам" },
    { key: PurchasePermission.LOT_CURATOR_REVIEW, group: "Закупки: заявки и планирование", label: "Согласование закупок проректором", description: "Согласовать закупку с обоснованием для комиссии, подтвердить ТЗ" },
    { key: PurchasePermission.LOT_ECONOMIST, group: "Закупки: заявки и планирование", label: "Экономическая экспертиза", description: "Коды, источник финансирования, КОСГУ, бюджет и НМЦК; после ТЗ — конечная стоимость" },
    { key: PurchasePermission.LOT_COMMISSION, group: "Закупки: заявки и планирование", label: "Бюджетная комиссия", description: "Решения по закупкам, протокол заседания, ПФХД" },
    { key: PurchasePermission.LOT_CONTRACT_SERVICE, group: "Закупки: подготовка и исполнение", label: "Контрактная служба", description: "Закон (44-ФЗ / 223-ФЗ) и способ определения поставщика" },
    { key: PurchasePermission.LOT_PROCUREMENT, group: "Закупки: подготовка и исполнение", label: "Проведение закупки отделом закупок", description: "Размещение, определение поставщика, контракт, исполнение" },
    { key: PurchasePermission.LOT_ACCEPTANCE, group: "Закупки: подготовка и исполнение", label: "Приёмка", description: "Приёмка поставленного товара или оказанной услуги" },
    { key: PurchasePermission.LOT_INVENTORY, group: "Закупки: подготовка и исполнение", label: "Постановка на учёт в инвентаре", description: "Внесение принятых товаров в инвентарь портала ДВГМУ" },
    { key: PurchasePermission.DIRECTORIES, group: "Закупки: администрирование", label: "Справочники закупок", description: "Проректоры и их направления, отделы, виды закупок" },
];

/** Любое право закупок v3 открывает страницу «Закупки»; что на ней можно — решает api. */
export const PURCHASE_V3_PERMS = PURCHASE_PERMISSIONS.map((p) => purchasePerm(p.key));

/** Права человека/доступа по разделам: «Расписание: изменение», «Справки: просмотр»;
 *  права закупок — подписью действия. */
export const summarizePermissions = (codes: string[]) => [
    ...SECTIONS.flatMap((s) =>
        codes.includes(perm(s.key, PermissionAction.POST))
            ? [`${s.label}: ${ACTION_LABEL[PermissionAction.POST].toLowerCase()}`]
            : codes.includes(perm(s.key, PermissionAction.FETCH))
              ? [`${s.label}: ${ACTION_LABEL[PermissionAction.FETCH].toLowerCase()}`]
              : [],
    ),
    ...PURCHASE_PERMISSIONS.filter((p) => codes.includes(purchasePerm(p.key))).map((p) => p.label),
];
