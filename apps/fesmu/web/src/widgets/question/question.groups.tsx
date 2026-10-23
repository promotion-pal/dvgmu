import {
  GraduationCapIcon,
  MonitorIcon,
  PackageIcon,
  ShieldCheckIcon,
  ToiletIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  AnalyticType,
  InformationSecurityInfoType,
  InformationSecurityOs,
  InformationSecurityResource,
} from "@fesmu/contract/enum/analytic.enum_pb";
import { enumOptions } from "./question.enum";
import type { QuestionFieldConfig, QuestionGroup } from "./question.types";

export interface AnalyticQuestionGroup extends QuestionGroup {
  icon: ReactNode;
}

const ratingLabels = {
  1: "Очень плохо",
  2: "Плохо",
  3: "Средне",
  4: "Хорошо",
  5: "Отлично",
};

const commentField: QuestionFieldConfig = {
  kind: "textarea",
  name: "comment",
  title: "💬 Комментарий",
  description: "Необязательно",
  placeholder: "Ваш комментарий...",
};

// Список отделов для выпадашки. Проверьте/дополните под структуру вуза —
// пользователь всё равно может выбрать «Другое» и вписать свой вариант.
// Структурные подразделения ДВГМУ по орг. структуре на 01.09.2026
// (приказ ФГБОУ ВО ДВГМУ Минздрава России от 01.09.2026 № 341, Приложение № 1).
// Кафедры не включены — уровень кафедры вводится через «Другое».
const departmentOptions: string[] = [
  "Ректорат",
  "Бухгалтерия",
  "Планово-экономический отдел",
  "Контрактная служба",
  "Юридический отдел",
  "Отдел кадров",
  "Отдел материально-технического снабжения",
  "Отдел планирования и контроля качества образования",
  "Отдел тестирования",
  "Отдел эксплуатации лекционных залов и межкафедральных аудиторий",
  "Отдел по молодёжной политике и воспитательной работе",
  "Отдел комплектования контингента",
  "Центр довузовской подготовки",
  "Редакция журнала «Дальневосточный медицинский журнал»",
  "Редакция электронного журнала «Вестник общественного здоровья и здравоохранения Дальнего Востока России»",
  "Редакция газеты «Вестник ДВГМУ»",
  "Издательство учебной литературы и учебных пособий",
  "Научный отдел",
  "Центральная научно-исследовательская лаборатория",
  "Спецотдел",
  "Отдел обеспечения безопасности труда",
  "Отдел охраны и дежурных",
  "Отдел по мобилизационной подготовке",
  "Отдел информационно-технического сопровождения",
  "Отдел обеспечения библиотечной деятельности",
  "Редакция электронной библиотеки ДВГМУ",
  "Международный отдел",
  "Проектный офис",
  "Служба обеспечения деятельности ректората",
  "Архив",
  "Канцелярия",
  "Институт непрерывного профессионального образования и аккредитации",
  "Аккредитационно-симуляционный центр",
  "Отдел практического обучения",
  "Учебная аптека",
  "Отделение ЦАК МЗ РФ в ДФО",
  "Административно-хозяйственное управление",
  "Отдел сантехнического и электротехнического обеспечения",
  "Отдел капитального и текущего ремонта",
  "Отдел транспорта",
  "Отдел санитарно-хозяйственного обеспечения",
  "Лечебный факультет",
  "Педиатрический факультет",
  "Стоматологический факультет",
  "Факультет фармации и биомедицины",
  "Медико-гуманитарный факультет",
  "Факультет ординатуры с центром карьеры и трудоустройства",
  "Медико-фармацевтический колледж",
  "Консультативно-диагностическая поликлиника",
  "Стоматологическая поликлиника «УНИ-СТОМ»",
];

// Общий блок в начале каждого опросника — кто заполняет анкету.
const respondentFields: QuestionFieldConfig[] = [
  {
    kind: "text",
    name: "respondentLastName",
    title: "🧑 Фамилия",
    description: "Укажите вашу фамилию",
    placeholder: "Иванов",
  },
  {
    kind: "text",
    name: "respondentFirstName",
    title: "🧑 Имя",
    description: "Укажите ваше имя",
    placeholder: "Иван",
  },
  {
    kind: "text",
    name: "respondentMiddleName",
    title: "🧑 Отчество",
    description: "Укажите ваше отчество",
    placeholder: "Иванович",
  },
  {
    kind: "text",
    name: "respondentOffice",
    title: "🚪 Кабинет",
    description: "Номер кабинета, в котором вы работаете",
    placeholder: "Например, 305",
  },
  {
    kind: "combobox",
    name: "respondentDepartment",
    title: "🏢 Отдел",
    description: "Выберите отдел из списка или добавьте свой вариант",
    placeholder: "Выберите отдел...",
    options: departmentOptions,
  },
];

// ПДн-вопросы анкеты ИБ видны, пока респондент не ответил, что не работает
// с информацией ограниченного доступа — тогда они ему нерелевантны, и
// анкета остаётся минимальной (должность, ОС, почта, вид информации,
// ресурсы, комментарий).
const visibleUnlessNoRestrictedInfo: NonNullable<
  QuestionFieldConfig["visibleWhen"]
> = (values) =>
  Number(values.informationSecurityInfoType) !==
  InformationSecurityInfoType.NONE;

const infoTypeLabels: Record<number, string> = {
  [InformationSecurityInfoType.DSP]: "Для служебного пользования",
  [InformationSecurityInfoType.PDN]: "Персональные данные",
  [InformationSecurityInfoType.DSP_AND_PDN]:
    "Для служебного пользования и персональные данные",
  [InformationSecurityInfoType.NONE]:
    "Не работаю с информацией ограниченного доступа",
};

const resourceLabels: Record<number, string> = {
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

const osLabels: Record<number, string> = {
  [InformationSecurityOs.ASTRA]: "Astra Linux",
  [InformationSecurityOs.WINDOWS]: "Windows",
  [InformationSecurityOs.RED_OS]: "РЭД ОС",
};

export const analyticQuestionGroups: Partial<
  Record<AnalyticType, AnalyticQuestionGroup>
> = {
  [AnalyticType.TOILET]: {
    icon: <ToiletIcon />,
    title: "Оценка состояния туалета",
    description: "Туалет №1",
    fields: [
      {
        kind: "rating",
        name: "purityRating",
        title: "🧹 Оцените чистоту",
        description: "Насколько чистая туалетная комната?",
        labels: {
          1: "Очень грязно",
          2: "Грязно",
          3: "Средне",
          4: "Чисто",
          5: "Стерильно",
        },
      },
      {
        kind: "rating",
        name: "smellRating",
        title: "👃 Оцените аромат",
        description: "Насколько приятный/неприятный запах в помещении?",
        labels: {
          1: "Очень неприятный",
          2: "Неприятный",
          3: "Нормально",
          4: "Хорошо",
          5: "Отлично, свежо",
        },
      },
      {
        kind: "boolean",
        name: "hasToiletPaper",
        title: "🧻 Наличие туалетной бумаги",
        description: "Есть ли туалетная бумага?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "hasSoap",
        title: "🧼 Наличие мыла",
        description: "Есть ли мыло?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      commentField,
    ],
  },
  [AnalyticType.LECTURE]: {
    icon: <GraduationCapIcon />,
    title: "Оценка актового зала",
    description: "Лекционный зал №1",
    fields: [
      {
        kind: "rating",
        name: "comfort",
        title: "🛋️ Оцените комфорт",
        description: "Насколько комфортно находиться в зале?",
        labels: {
          1: "Очень некомфортно",
          2: "Некомфортно",
          3: "Средне",
          4: "Комфортно",
          5: "Отлично",
        },
      },
      {
        kind: "rating",
        name: "equipment",
        title: "🖥️ Оцените оснащение",
        description: "Насколько хорошо оснащён зал (техника, мебель)?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "cleanliness",
        title: "🧹 Оцените чистоту",
        description: "Насколько чисто в зале?",
        labels: {
          1: "Очень грязно",
          2: "Грязно",
          3: "Средне",
          4: "Чисто",
          5: "Стерильно",
        },
      },
      commentField,
    ],
  },
  [AnalyticType.WORKPLACE]: {
    icon: <MonitorIcon />,
    title: "Оценка рабочего места",
    description: "Рабочее место №1",
    fields: [
      ...respondentFields,
      {
        kind: "rating",
        name: "workplacePcPowerRating",
        title: "💻 Мощность компьютера",
        description: "Хватает ли мощности ПК, чтобы работать без зависаний?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceOsBootRating",
        title: "⚡ Скорость загрузки",
        description: "Насколько быстро загружаются ОС и рабочие приложения?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceSoftwareStableRating",
        title: "🧩 Стабильность программ",
        description:
          "Насколько стабильно работают корпоративные программы (без вылетов)?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceNetworkSpeedRating",
        title: "🌐 Скорость сети",
        description: "Насколько устраивает скорость интернета и локальной сети?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceMonitorRating",
        title: "🖥️ Монитор",
        description: "Удобен ли монитор (размер, разрешение, яркость)?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceKeyboardMouseRating",
        title: "⌨️ Клавиатура и мышь",
        description: "Насколько удобны и качественны клавиатура и мышь?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceMediaDevicesRating",
        title: "🎧 Гарнитура и камера",
        description: "Как работают наушники/гарнитура и веб-камера?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceOfficeEquipmentRating",
        title: "🖨️ Оргтехника",
        description: "Насколько быстрый доступ к принтеру/сканеру?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceFurnitureRating",
        title: "🪑 Мебель",
        description: "Удобны ли кресло и стол для длительной работы?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceSpaceOrgRating",
        title: "🔌 Организация пространства",
        description:
          "Достаточно ли розеток и места, аккуратно ли убраны провода?",
        labels: ratingLabels,
      },
      {
        kind: "rating",
        name: "workplaceEnvironmentRating",
        title: "🌡️ Условия рядом с ПК",
        description: "Насколько комфортны освещение, температура и уровень шума?",
        labels: ratingLabels,
      },
      commentField,
    ],
  },
  [AnalyticType.INFORMATION_SECURITY]: {
    icon: <ShieldCheckIcon />,
    title: "Анкета информационной безопасности",
    description: "Обработка информации ограниченного доступа",
    fields: [
      ...respondentFields,
      {
        kind: "text",
        name: "informationSecurityPosition",
        title: "💼 Должность",
        description: "Ваша должность",
        placeholder: "Например, специалист отдела кадров",
      },
      {
        kind: "select",
        name: "informationSecurityOs",
        title: "🖥️ Операционная система",
        description: "Какая операционная система установлена на рабочем месте?",
        options: enumOptions(InformationSecurityOs, osLabels),
      },
      {
        kind: "boolean",
        name: "informationSecurityHasCorporateEmail",
        title: "📧 Корпоративная почта",
        description: "Есть ли у вас корпоративная почта?",
        options: { true: "✅ Да", false: "❌ Нет" },
      },
      {
        kind: "select",
        name: "informationSecurityInfoType",
        title: "🔐 Вид информации ограниченного доступа",
        description:
          "С каким видом информации ограниченного доступа вы работаете?",
        options: enumOptions(InformationSecurityInfoType, infoTypeLabels),
      },
      {
        kind: "multiselect",
        name: "informationSecurityResources",
        title: "🗂️ Информационные ресурсы",
        description:
          "С какими информационными ресурсами вы работаете? Отмечайте в порядке частоты использования.",
        options: enumOptions(InformationSecurityResource, resourceLabels),
        otherName: "informationSecurityResourcesOther",
        otherLabel: "Другие ресурсы и программы — которых нет в списке выше",
        otherPlaceholder:
          "Например: СДО Moodle, 1С:Университет, Контур.Экстерн",
      },
      {
        kind: "textarea",
        name: "informationSecurityPdnPurpose",
        title: "📋 Цель обработки персональных данных",
        description: "Для чего вы собираете персональные данные?",
        placeholder:
          "Например: ведение кадрового учёта, начисление заработной платы",
        visibleWhen: visibleUnlessNoRestrictedInfo,
      },
      {
        kind: "textarea",
        name: "informationSecurityPdnActions",
        title: "⚙️ Действия над персональными данными",
        description:
          "Какие действия выполняются над персональными данными (хранение, сбор, передача третьим лицам, обезличивание, уничтожение)?",
        placeholder: "Перечислите действия...",
        visibleWhen: visibleUnlessNoRestrictedInfo,
      },
      {
        kind: "boolean",
        name: "informationSecurityThirdPartyAgreements",
        title: "🤝 Передача третьим лицам",
        description: "Передаёте ли вы персональные данные в другие организации?",
        options: { true: "✅ Да", false: "❌ Нет" },
        visibleWhen: visibleUnlessNoRestrictedInfo,
      },
      {
        kind: "boolean",
        name: "informationSecurityPdnDestroyedAfterTerm",
        title: "🗑️ Уничтожение персональных данных после срока обработки",
        description:
          "Выполняется ли уничтожение персональных данных после истечения сроков цели обработки?",
        options: { true: "✅ Да", false: "❌ Нет" },
        visibleWhen: visibleUnlessNoRestrictedInfo,
      },
      {
        kind: "boolean",
        name: "informationSecurityPdnToArchive",
        title: "📦 Передача персональных данных в архив",
        description: "Передаются ли персональные данные в архив?",
        options: { true: "✅ Да", false: "❌ Нет" },
        visibleWhen: visibleUnlessNoRestrictedInfo,
      },
      commentField,
    ],
  },
  [AnalyticType.TECHNICAL_SUPPLY]: {
    icon: <PackageIcon />,
    title: "Техническое снабжение",
    description: "Обеспечение рабочего места",
    fields: [
      ...respondentFields,
      {
        kind: "boolean",
        name: "technicalSupplyHasInternet",
        title: "🌐 Наличие интернета",
        description: "Есть ли на рабочем месте доступ в интернет?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasHeadset",
        title: "🎧 Наличие гарнитуры",
        description: "Выдана ли вам гарнитура (наушники с микрофоном)?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasWorkplace",
        title: "🪑 Наличие полноценного рабочего места",
        description:
          "Оборудовано ли у вас полноценное рабочее место (стол, кресло, место для работы)?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasCorporateEmail",
        title: "📧 Наличие корпоративной почты",
        description: "Есть ли у вас корпоративная почта?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasComputer",
        title: "💻 Наличие рабочего компьютера",
        description: "Выдан ли вам рабочий компьютер или ноутбук?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasMonitor",
        title: "🖥️ Наличие монитора",
        description: "Есть ли на рабочем месте монитор?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasPhone",
        title: "☎️ Наличие рабочего телефона",
        description: "Есть ли на рабочем месте рабочий телефон?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasPrinterAccess",
        title: "🖨️ Наличие доступа к принтеру/сканеру",
        description: "Есть ли у вас доступ к принтеру и сканеру?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasSoftware",
        title: "🧩 Наличие необходимого программного обеспечения",
        description: "Установлено ли всё необходимое для работы программное обеспечение?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      {
        kind: "boolean",
        name: "technicalSupplyHasDomainAccount",
        title: "🔑 Наличие доменной учётной записи",
        description: "Есть ли у вас учётная запись в корпоративном домене?",
        options: { true: "✅ Есть", false: "❌ Нет" },
      },
      commentField,
    ],
  },
};
