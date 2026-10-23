import {
  AnalyticType,
  InformationSecurityInfoType,
  InformationSecurityOs,
} from "@api/enum/analytic.enum_pb";
import type { ZodType } from "zod";
import z from "zod";

export const emptySchema = z.object({});

const rating5 = z.number().min(1).max(5).default(3);

// Общий блок респондента — присутствует в начале каждого опросника.
const respondentShape = {
  respondentLastName: z.string().default(""),
  respondentFirstName: z.string().default(""),
  respondentMiddleName: z.string().default(""),
  respondentOffice: z.string().default(""),
  respondentDepartment: z.string().default(""),
};

const respondentDefaults = {
  respondentLastName: "",
  respondentFirstName: "",
  respondentMiddleName: "",
  respondentOffice: "",
  respondentDepartment: "",
};

export const toiletAnalyticSchema = z.object({
  ...respondentShape,
  comment: z.string().optional().default(""),
  hasSoap: z.boolean().default(true),
  hasToiletPaper: z.boolean().default(true),
  smellRating: z.number().min(1).max(5).default(3),
  purityRating: z.number().min(1).max(5).default(3),
});

export const lectureAnalyticSchema = z.object({
  ...respondentShape,
  comment: z.string().optional().default(""),
  equipment: z.number().min(1).max(5).default(3),
  comfort: z.number().min(1).max(5).default(3),
  cleanliness: z.number().min(1).max(5).default(3),
});

export const workplaceAnalyticSchema = z.object({
  ...respondentShape,
  comment: z.string().optional().default(""),

  workplacePcPowerRating: rating5,
  workplaceOsBootRating: rating5,
  workplaceSoftwareStableRating: rating5,
  workplaceNetworkSpeedRating: rating5,

  workplaceMonitorRating: rating5,
  workplaceKeyboardMouseRating: rating5,
  workplaceMediaDevicesRating: rating5,
  workplaceOfficeEquipmentRating: rating5,

  workplaceFurnitureRating: rating5,
  workplaceSpaceOrgRating: rating5,
  workplaceEnvironmentRating: rating5,
});

export const informationSecurityAnalyticSchema = z.object({
  ...respondentShape,
  comment: z.string().optional().default(""),

  informationSecurityPosition: z.string().default(""),
  informationSecurityComputerProficiency: z.number().min(1).max(5).default(3),

  informationSecurityInfoType: z
    .number()
    .int()
    .default(InformationSecurityInfoType.UNSPECIFIED),
  informationSecurityResources: z.array(z.number().int()).default([]),
  informationSecurityResourcesOther: z.string().default(""),

  informationSecurityPdnPurpose: z.string().default(""),
  informationSecurityStorageForm: z.string().default(""),
  informationSecurityPdnActions: z.string().default(""),
  informationSecurityThirdPartyAgreements: z.boolean().default(false),
  informationSecurityPdnDestroyedAfterTerm: z.boolean().default(false),
  informationSecurityPdnToArchive: z.boolean().default(false),

  informationSecurityOs: z.number().int().default(InformationSecurityOs.UNSPECIFIED),
  informationSecurityHasCorporateEmail: z.boolean().default(false),
  informationSecurityCorporateEmailPersonalUse: z.boolean().default(false),
});

export const technicalSupplyAnalyticSchema = z.object({
  ...respondentShape,
  comment: z.string().optional().default(""),

  technicalSupplyHasInternet: z.boolean().default(false),
  technicalSupplyHasHeadset: z.boolean().default(false),
  technicalSupplyHasWorkplace: z.boolean().default(false),
  technicalSupplyHasCorporateEmail: z.boolean().default(false),
  technicalSupplyHasComputer: z.boolean().default(false),
  technicalSupplyHasMonitor: z.boolean().default(false),
  technicalSupplyHasPhone: z.boolean().default(false),
  technicalSupplyHasPrinterAccess: z.boolean().default(false),
  technicalSupplyHasSoftware: z.boolean().default(false),
  technicalSupplyHasDomainAccount: z.boolean().default(false),
});

export interface AnalyticSchemaEntry {
  schema: ZodType;
  default: Record<string, unknown>;
}

export const mapSchema: Partial<Record<AnalyticType, AnalyticSchemaEntry>> = {
  [AnalyticType.TOILET]: {
    schema: toiletAnalyticSchema,
    default: {
      ...respondentDefaults,
      comment: "",
      hasSoap: true,
      smellRating: 3,
      purityRating: 3,
      hasToiletPaper: true,
    },
  },
  [AnalyticType.LECTURE]: {
    schema: lectureAnalyticSchema,
    default: {
      ...respondentDefaults,
      comfort: 3,
      comment: "",
      equipment: 3,
      cleanliness: 3,
    },
  },
  [AnalyticType.WORKPLACE]: {
    schema: workplaceAnalyticSchema,
    default: {
      ...respondentDefaults,
      comment: "",
      workplacePcPowerRating: 3,
      workplaceOsBootRating: 3,
      workplaceSoftwareStableRating: 3,
      workplaceNetworkSpeedRating: 3,
      workplaceMonitorRating: 3,
      workplaceKeyboardMouseRating: 3,
      workplaceMediaDevicesRating: 3,
      workplaceOfficeEquipmentRating: 3,
      workplaceFurnitureRating: 3,
      workplaceSpaceOrgRating: 3,
      workplaceEnvironmentRating: 3,
    },
  },
  [AnalyticType.INFORMATION_SECURITY]: {
    schema: informationSecurityAnalyticSchema,
    default: {
      ...respondentDefaults,
      comment: "",
      informationSecurityPosition: "",
      informationSecurityComputerProficiency: 3,
      informationSecurityInfoType: InformationSecurityInfoType.UNSPECIFIED,
      informationSecurityResources: [],
      informationSecurityResourcesOther: "",
      informationSecurityPdnPurpose: "",
      informationSecurityStorageForm: "",
      informationSecurityPdnActions: "",
      informationSecurityThirdPartyAgreements: false,
      informationSecurityPdnDestroyedAfterTerm: false,
      informationSecurityPdnToArchive: false,
      informationSecurityOs: InformationSecurityOs.UNSPECIFIED,
      informationSecurityHasCorporateEmail: false,
      informationSecurityCorporateEmailPersonalUse: false,
    },
  },
  [AnalyticType.TECHNICAL_SUPPLY]: {
    schema: technicalSupplyAnalyticSchema,
    default: {
      ...respondentDefaults,
      comment: "",
      technicalSupplyHasInternet: false,
      technicalSupplyHasHeadset: false,
      technicalSupplyHasWorkplace: false,
      technicalSupplyHasCorporateEmail: false,
      technicalSupplyHasComputer: false,
      technicalSupplyHasMonitor: false,
      technicalSupplyHasPhone: false,
      technicalSupplyHasPrinterAccess: false,
      technicalSupplyHasSoftware: false,
      technicalSupplyHasDomainAccount: false,
    },
  },
};
