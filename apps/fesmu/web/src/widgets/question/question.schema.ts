import { AnalyticType } from "@dvgmu/analytics/enum/analytic.enum_pb";
import type { ZodType } from "zod";
import z from "zod";

export const emptySchema = z.object({});

// --- Переиспользуемые валидаторы --------------------------------------------
// Задача: пустую анкету отправить нельзя. Каждое поле, которое видит
// респондент, должно быть заполнено (кроме явно необязательных — комментарий,
// отчество, кабинет).

/** Оценка 1–5. Без значения по умолчанию — кнопка должна быть выбрана вручную. */
const ratingRequired = z
  .number({ error: "Выберите оценку от 1 до 5" })
  .int()
  .min(1, "Выберите оценку от 1 до 5")
  .max(5);

/** Да/Нет. Без значения по умолчанию — ответ нужно выбрать явно. */
const boolRequired = z.boolean({ error: "Выберите вариант ответа" });

/** Непустая строка (пробелы по краям обрезаются). */
const textRequired = (error = "Заполните это поле") =>
  z.string().trim().min(1, error);

/** Значение enum из выпадающего списка. 0 (UNSPECIFIED) не проходит. */
const enumRequired = (error = "Выберите вариант") =>
  z.number({ error }).int().min(1, error);

const optionalText = z.string().trim().optional().default("");

// Общий блок респондента — в начале каждой анкеты.
const respondentShape = {
  respondentLastName: textRequired("Укажите фамилию"),
  respondentFirstName: textRequired("Укажите имя"),
  respondentMiddleName: optionalText,
  respondentOffice: optionalText,
  respondentDepartment: textRequired("Выберите отдел или укажите свой"),
};

const respondentDefaults = {
  respondentLastName: "",
  respondentFirstName: "",
  respondentMiddleName: "",
  respondentOffice: "",
  respondentDepartment: "",
};

// Туалет и зал — без блока «кто вы»: анкета сразу начинается с оценок.
export const toiletAnalyticSchema = z.object({
  comment: optionalText,
  purityRating: ratingRequired,
  smellRating: ratingRequired,
  hasToiletPaper: boolRequired,
  hasSoap: boolRequired,
});

export const lectureAnalyticSchema = z.object({
  comment: optionalText,
  comfort: ratingRequired,
  equipment: ratingRequired,
  cleanliness: ratingRequired,
});

export const workplaceAnalyticSchema = z.object({
  ...respondentShape,
  comment: optionalText,

  workplacePcPowerRating: ratingRequired,
  workplaceOsBootRating: ratingRequired,
  workplaceSoftwareStableRating: ratingRequired,
  workplaceNetworkSpeedRating: ratingRequired,

  workplaceMonitorRating: ratingRequired,
  workplaceKeyboardMouseRating: ratingRequired,
  workplaceMediaDevicesRating: ratingRequired,
  workplaceOfficeEquipmentRating: ratingRequired,

  workplaceFurnitureRating: ratingRequired,
  workplaceSpaceOrgRating: ratingRequired,
  workplaceEnvironmentRating: ratingRequired,
});

// Пять полей про обработку ПДн релевантны, только если респондент вообще
// работает с информацией ограниченного доступа (вид информации ≠ NONE) —
// question.groups.tsx скрывает их из мастера тем же условием
// (visibleUnlessNoRestrictedInfo), здесь делаем их условно обязательными,
// чтобы скрытые поля не блокировали отправку.
const INFORMATION_SECURITY_INFO_TYPE_NONE = 4;

export const informationSecurityAnalyticSchema = z
  .object({
    ...respondentShape,
    comment: optionalText,

    informationSecurityPosition: textRequired("Укажите должность"),

    informationSecurityInfoType: enumRequired("Выберите вид информации"),
    // Ресурс можно выбрать из списка ИЛИ вписать свой в informationSecurityResourcesOther —
    // поэтому сам список больше не обязателен.
    informationSecurityResources: z.array(z.number().int()).default([]),
    informationSecurityResourcesOther: optionalText,

    informationSecurityPdnPurpose: optionalText,
    informationSecurityPdnActions: optionalText,
    informationSecurityThirdPartyAgreements: z.boolean().optional(),
    informationSecurityPdnDestroyedAfterTerm: z.boolean().optional(),
    informationSecurityPdnToArchive: z.boolean().optional(),

    informationSecurityOs: enumRequired("Выберите операционную систему"),

    informationSecurityHasCorporateEmail: boolRequired,
  })
  .superRefine((data, ctx) => {
    if (
      Number(data.informationSecurityInfoType) ===
      INFORMATION_SECURITY_INFO_TYPE_NONE
    ) {
      return;
    }

    if (!data.informationSecurityPdnPurpose?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["informationSecurityPdnPurpose"],
        message: "Опишите цель обработки данных",
      });
    }
    if (!data.informationSecurityPdnActions?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["informationSecurityPdnActions"],
        message: "Опишите действия над данными",
      });
    }
    if (data.informationSecurityThirdPartyAgreements === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["informationSecurityThirdPartyAgreements"],
        message: "Выберите вариант ответа",
      });
    }
    if (data.informationSecurityPdnDestroyedAfterTerm === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["informationSecurityPdnDestroyedAfterTerm"],
        message: "Выберите вариант ответа",
      });
    }
    if (data.informationSecurityPdnToArchive === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["informationSecurityPdnToArchive"],
        message: "Выберите вариант ответа",
      });
    }
  });

export const technicalSupplyAnalyticSchema = z.object({
  ...respondentShape,
  comment: optionalText,

  technicalSupplyHasInternet: boolRequired,
  technicalSupplyHasHeadset: boolRequired,
  technicalSupplyHasWorkplace: boolRequired,
  technicalSupplyHasCorporateEmail: boolRequired,
  technicalSupplyHasComputer: boolRequired,
  technicalSupplyHasMonitor: boolRequired,
  technicalSupplyHasPhone: boolRequired,
  technicalSupplyHasPrinterAccess: boolRequired,
  technicalSupplyHasSoftware: boolRequired,
  technicalSupplyHasDomainAccount: boolRequired,
});

export interface AnalyticSchemaEntry {
  schema: ZodType;
  default: Record<string, unknown>;
}

// В default кладём только поля, у которых «пусто» — валидное стартовое
// состояние (строки, массивы). Оценки, «да/нет» и выпадашки НЕ
// инициализируем — тогда в форме ничего не выбрано, и схема требует выбор.
export const mapSchema: Partial<Record<AnalyticType, AnalyticSchemaEntry>> = {
  [AnalyticType.TOILET]: {
    schema: toiletAnalyticSchema,
    default: { comment: "" },
  },
  [AnalyticType.LECTURE]: {
    schema: lectureAnalyticSchema,
    default: { comment: "" },
  },
  [AnalyticType.WORKPLACE]: {
    schema: workplaceAnalyticSchema,
    default: { ...respondentDefaults, comment: "" },
  },
  [AnalyticType.INFORMATION_SECURITY]: {
    schema: informationSecurityAnalyticSchema,
    default: {
      ...respondentDefaults,
      comment: "",
      informationSecurityPosition: "",
      informationSecurityResources: [] as number[],
      informationSecurityResourcesOther: "",
      informationSecurityPdnPurpose: "",
      informationSecurityPdnActions: "",
    },
  },
  [AnalyticType.TECHNICAL_SUPPLY]: {
    schema: technicalSupplyAnalyticSchema,
    default: { ...respondentDefaults, comment: "" },
  },
};
