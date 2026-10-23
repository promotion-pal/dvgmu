import {
  InformationSecurityInfoType,
  InformationSecurityOs,
  InformationSecurityResource,
  AnalyticType,
} from "@dvgmu/contract/analytics/enum/analytic.enum_pb";
import type { AnalyticRating } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";

/**
 * Универсальный реестр полей опроса (AnalyticRating).
 *
 * Идея «IsField»: карточка аналитики не знает заранее, какой это опрос — она
 * берёт все поля, чьи `types` включают её AnalyticType, и оставляет только те,
 * что реально заполнены хотя бы одним ответом (`isPresent`). Так один и тот же
 * компонент выгружает WORKPLACE / INFORMATION_SECURITY / TECHNICAL_SUPPLY без
 * отдельного кода на каждый тип — новое поле в контракте достаточно добавить сюда.
 */

export type AnalyticFieldKind =
  | "rating" // int 1..5
  | "bool" // да / нет
  | "enum" // одно значение перечисления
  | "enumList" // несколько значений перечисления (в порядке выбора)
  | "text"; // свободный текст

export type AnalyticFieldRole = "metric" | "identity";

export interface AnalyticFieldDef {
  /** Имя поля в AnalyticRating (camelCase, как в сгенерированном протобуфе). */
  key: RatingFieldKey;
  label: string;
  kind: AnalyticFieldKind;
  /** Секция для группировки в интерфейсе. */
  group: string;
  /** Типы опросов, к которым относится поле. */
  types: AnalyticType[];
  /** identity-поля описывают опрошенного, а не метрику — в статистику не идут. */
  role?: AnalyticFieldRole;
  /** Подписи значений для kind === "enum" | "enumList". */
  enumLabels?: Record<number, string>;
  /**
   * Признак «поле заполнено» для конкретного ответа. По умолчанию выводится из
   * kind. bool переопределить нельзя (proto3 не отличает false от «не заполнено»),
   * поэтому bool-поля считаются присутствующими по совпадению типа опроса.
   */
  isPresent?: (rating: AnalyticRating) => boolean;
}

type RatingFieldKey = {
  [K in keyof AnalyticRating]: AnalyticRating[K] extends
    | number
    | string
    | boolean
    | number[]
    ? K
    : never;
}[keyof AnalyticRating] &
  string;

const IS = AnalyticType.INFORMATION_SECURITY;
const WP = AnalyticType.WORKPLACE;
const TS = AnalyticType.TECHNICAL_SUPPLY;
const TL = AnalyticType.TOILET;
const LC = AnalyticType.LECTURE;

// Общий блок респондента — присутствует во всех типах опросов.
const ALL_TYPES = [TL, LC, WP, IS, TS];

export const INFO_TYPE_LABELS: Record<number, string> = {
  [InformationSecurityInfoType.DSP]: "Для служебного пользования",
  [InformationSecurityInfoType.PDN]: "Персональные данные",
  [InformationSecurityInfoType.DSP_AND_PDN]:
    "Для служебного пользования и персональные данные",
  [InformationSecurityInfoType.NONE]:
    "Не работаю с информацией ограниченного доступа",
};

export const RESOURCE_LABELS: Record<number, string> = {
  [InformationSecurityResource.FIS_GIA_PRIEM]: "ФИС ГИА и приёма",
  [InformationSecurityResource.ONE_C]: "1С",
  [InformationSecurityResource.ROSIMUSHCHESTVO]: "Росимущество",
  [InformationSecurityResource.ELECTRONIC_BUDGET]: "Электронный бюджет",
  [InformationSecurityResource.GIS_FRDO_SPO]: "ГИС ФРДО СПО",
  [InformationSecurityResource.FRDO_VO]: "ФРДО ВО",
  [InformationSecurityResource.SMEV]: "СМЭВ",
  [InformationSecurityResource.TRUD_ROSSII]: "Труд России",
  [InformationSecurityResource.FRMR]: "ФРМР",
  [InformationSecurityResource.FRMO]: "ФРМО",
  [InformationSecurityResource.EGISU_NIOKTR]: "ЕГИСУ НИОКТР",
  [InformationSecurityResource.MIS_MEDIALOG]: "МИС Медиолог",
  [InformationSecurityResource.SFR]: "СФР",
};

export const OS_LABELS: Record<number, string> = {
  [InformationSecurityOs.ASTRA]: "Astra Linux",
  [InformationSecurityOs.WINDOWS]: "Windows",
  [InformationSecurityOs.RED_OS]: "РЭД ОС",
};

const rating = (
  key: RatingFieldKey,
  label: string,
  group: string,
  types: AnalyticType[],
): AnalyticFieldDef => ({ key, label, kind: "rating", group, types });

const bool = (
  key: RatingFieldKey,
  label: string,
  group: string,
  types: AnalyticType[],
): AnalyticFieldDef => ({ key, label, kind: "bool", group, types });

const text = (
  key: RatingFieldKey,
  label: string,
  group: string,
  types: AnalyticType[],
  role: AnalyticFieldRole = "metric",
): AnalyticFieldDef => ({ key, label, kind: "text", group, types, role });

export const ANALYTIC_FIELD_DEFS: AnalyticFieldDef[] = [
  // --- Общий блок: респондент ------------------------------------------
  text("respondentLastName", "Фамилия", "Опрошенный", ALL_TYPES, "identity"),
  text("respondentFirstName", "Имя", "Опрошенный", ALL_TYPES, "identity"),
  text("respondentMiddleName", "Отчество", "Опрошенный", ALL_TYPES, "identity"),
  text("respondentOffice", "Кабинет", "Опрошенный", ALL_TYPES, "identity"),
  text("respondentDepartment", "Отдел", "Опрошенный", ALL_TYPES, "identity"),

  // --- Туалет -------------------------------------------------------------
  rating("purityRating", "Чистота", "Туалет", [TL]),
  rating("smellRating", "Запах", "Туалет", [TL]),
  bool("hasToiletPaper", "Туалетная бумага", "Туалет", [TL]),
  bool("hasSoap", "Мыло", "Туалет", [TL]),

  // --- Лекционный зал ------------------------------------------------------
  rating("comfort", "Комфорт", "Лекционный зал", [LC]),
  rating("equipment", "Оснащение", "Лекционный зал", [LC]),
  rating("cleanliness", "Чистота", "Лекционный зал", [LC]),

  // --- Рабочее место ------------------------------------------------------
  rating("workplacePcPowerRating", "Мощность ПК", "Техника", [WP]),
  rating("workplaceOsBootRating", "Скорость загрузки ОС", "Техника", [WP]),
  rating("workplaceSoftwareStableRating", "Стабильность ПО", "Техника", [WP]),
  rating("workplaceNetworkSpeedRating", "Скорость сети", "Техника", [WP]),
  rating("workplaceMonitorRating", "Монитор", "Периферия", [WP]),
  rating("workplaceKeyboardMouseRating", "Клавиатура и мышь", "Периферия", [WP]),
  rating("workplaceMediaDevicesRating", "Гарнитура и камера", "Периферия", [WP]),
  rating("workplaceOfficeEquipmentRating", "Оргтехника", "Периферия", [WP]),
  rating("workplaceFurnitureRating", "Мебель", "Эргономика", [WP]),
  rating("workplaceSpaceOrgRating", "Организация места", "Эргономика", [WP]),
  rating("workplaceEnvironmentRating", "Свет / шум / температура", "Эргономика", [WP]),
  bool("workplaceHasNetwork", "Есть интернет", "Техника", [WP]),

  // --- Информационная безопасность --------------------------------------
  text("informationSecurityPosition", "Должность", "Опрошенный", [IS], "identity"),
  {
    key: "informationSecurityInfoType",
    label: "Вид информации ограниченного доступа",
    kind: "enum",
    group: "Информационная безопасность",
    types: [IS],
    enumLabels: INFO_TYPE_LABELS,
  },
  {
    key: "informationSecurityResources",
    label: "Информационные ресурсы",
    kind: "enumList",
    group: "Информационная безопасность",
    types: [IS],
    enumLabels: RESOURCE_LABELS,
  },
  text("informationSecurityResourcesOther", "Другие ресурсы и программы", "Информационная безопасность", [IS]),
  text("informationSecurityPdnPurpose", "Цель обработки персональных данных", "Информационная безопасность", [IS]),
  text("informationSecurityPdnActions", "Действия над ПДн", "Информационная безопасность", [IS]),
  bool("informationSecurityThirdPartyAgreements", "Передача третьим лицам", "Информационная безопасность", [IS]),
  bool("informationSecurityPdnDestroyedAfterTerm", "Уничтожение ПДн после срока обработки", "Информационная безопасность", [IS]),
  bool("informationSecurityPdnToArchive", "Передача ПДн в архив", "Информационная безопасность", [IS]),
  {
    key: "informationSecurityOs",
    label: "Операционная система",
    kind: "enum",
    group: "Информационная безопасность",
    types: [IS],
    enumLabels: OS_LABELS,
  },
  bool("informationSecurityHasCorporateEmail", "Есть корпоративная почта", "Информационная безопасность", [IS]),

  // --- Техническое снабжение ------------------------------------------
  bool("technicalSupplyHasInternet", "Интернет", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasHeadset", "Гарнитура", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasWorkplace", "Полноценное рабочее место", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasCorporateEmail", "Корпоративная почта", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasComputer", "Рабочий компьютер", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasMonitor", "Монитор", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasPhone", "Рабочий телефон", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasPrinterAccess", "Доступ к принтеру/сканеру", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasSoftware", "Необходимое ПО", "Техническое снабжение", [TS]),
  bool("technicalSupplyHasDomainAccount", "Доменная учётная запись", "Техническое снабжение", [TS]),
];

/** Значение поля из ответа с приведением к удобному для статистики виду. */
export const readField = (
  rating: AnalyticRating,
  def: AnalyticFieldDef,
): number | string | boolean | number[] => {
  return rating[def.key] as number | string | boolean | number[];
};

/** Признак «поле заполнено» для одного ответа. */
export const isFieldPresent = (
  rating: AnalyticRating,
  def: AnalyticFieldDef,
): boolean => {
  if (def.isPresent) return def.isPresent(rating);

  const value = readField(rating, def);
  switch (def.kind) {
    case "rating":
      return typeof value === "number" && value >= 1 && value <= 5;
    case "enum":
      return typeof value === "number" && value > 0;
    case "enumList":
      return Array.isArray(value) && value.length > 0;
    case "text":
      return typeof value === "string" && value.trim().length > 0;
    case "bool":
      // proto3 не отличает false от «не заполнено» — присутствие по типу опроса.
      return true;
    default:
      return false;
  }
};

/**
 * Поля, которые реально имеет смысл выгружать для набора ответов данного типа:
 * тип совпадает и (нет ответов вовсе — показываем каркас) либо поле заполнено
 * хотя бы одним ответом.
 */
export const resolveActiveFields = (
  type: AnalyticType,
  ratings: AnalyticRating[],
): AnalyticFieldDef[] =>
  ANALYTIC_FIELD_DEFS.filter((def) => {
    if (!def.types.includes(type)) return false;
    if (ratings.length === 0) return true;
    if (def.kind === "bool") return true;
    return ratings.some((r) => isFieldPresent(r, def));
  });

export const enumLabel = (def: AnalyticFieldDef, value: number): string =>
  def.enumLabels?.[value] ?? `Значение ${value}`;
