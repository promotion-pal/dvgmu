import { AnalyticType } from "@dvgmu/contract/analytics/enum/analytic.enum_pb";

// The 11 workplace metric fields — the ratings AnalyticRatingCreateRequest
// carries for the WORKPLACE survey (see
// contract/packages/analytics/service/analytic.service.proto).
export const WORKPLACE_RATING_KEYS = [
  "workplacePcPowerRating",
  "workplaceOsBootRating",
  "workplaceSoftwareStableRating",
  "workplaceNetworkSpeedRating",
  "workplaceMonitorRating",
  "workplaceKeyboardMouseRating",
  "workplaceMediaDevicesRating",
  "workplaceOfficeEquipmentRating",
  "workplaceFurnitureRating",
  "workplaceSpaceOrgRating",
  "workplaceEnvironmentRating",
] as const;

// The common respondent block carried by every survey type — last/first/middle
// name, office and department (see
// contract/packages/analytics/service/analytic.service.proto).
export const RESPONDENT_KEYS = [
  "respondentLastName",
  "respondentFirstName",
  "respondentMiddleName",
  "respondentOffice",
  "respondentDepartment",
] as const;

// String fields of the INFORMATION_SECURITY survey.
const INFORMATION_SECURITY_TEXT_KEYS = [
  "informationSecurityPosition",
  "informationSecurityResourcesOther",
  "informationSecurityPdnPurpose",
  "informationSecurityPdnActions",
] as const;

// Numeric fields of the INFORMATION_SECURITY survey (enums).
const INFORMATION_SECURITY_ENUM_KEYS = [
  "informationSecurityInfoType",
  "informationSecurityOs",
] as const;

// Boolean fields of the INFORMATION_SECURITY survey.
const INFORMATION_SECURITY_BOOL_KEYS = [
  "informationSecurityThirdPartyAgreements",
  "informationSecurityPdnDestroyedAfterTerm",
  "informationSecurityPdnToArchive",
  "informationSecurityHasCorporateEmail",
] as const;

// The 10 boolean checklist fields of the TECHNICAL_SUPPLY survey — the
// equipment/access items AnalyticRatingCreateRequest carries for that type
// (see contract/packages/analytics/service/analytic.service.proto).
const TECHNICAL_SUPPLY_BOOL_KEYS = [
  "technicalSupplyHasInternet",
  "technicalSupplyHasHeadset",
  "technicalSupplyHasWorkplace",
  "technicalSupplyHasCorporateEmail",
  "technicalSupplyHasComputer",
  "technicalSupplyHasMonitor",
  "technicalSupplyHasPhone",
  "technicalSupplyHasPrinterAccess",
  "technicalSupplyHasSoftware",
  "technicalSupplyHasDomainAccount",
] as const;

// TOILET: оценки 1–5 и наличие бумаги/мыла.
const TOILET_RATING_KEYS = ["purityRating", "smellRating"] as const;
const TOILET_BOOL_KEYS = ["hasToiletPaper", "hasSoap"] as const;

// LECTURE: оценки зала 1–5.
const LECTURE_RATING_KEYS = ["comfort", "equipment", "cleanliness"] as const;

/**
 * Maps a filled survey form to the `analyticRatingCreate` request body for the
 * given analytic type: the common respondent block plus a free-text comment for
 * every type, workplace metrics for WORKPLACE, the information-security
 * questionnaire fields for INFORMATION_SECURITY, and the equipment checklist for
 * TECHNICAL_SUPPLY.
 */
export const toRatingPayload = (
  type: AnalyticType,
  data: Record<string, unknown>,
): { comment: string; [key: string]: unknown } => {
  const payload: { comment: string; [key: string]: unknown } = {
    comment: String(data.comment ?? ""),
  };

  for (const key of RESPONDENT_KEYS) {
    payload[key] = String(data[key] ?? "");
  }

  if (type === AnalyticType.WORKPLACE) {
    for (const key of WORKPLACE_RATING_KEYS) {
      payload[key] = Number(data[key] ?? 0);
    }
  }

  if (type === AnalyticType.TOILET) {
    for (const key of TOILET_RATING_KEYS) {
      payload[key] = Number(data[key] ?? 0);
    }
    for (const key of TOILET_BOOL_KEYS) {
      payload[key] = Boolean(data[key]);
    }
  }

  if (type === AnalyticType.LECTURE) {
    for (const key of LECTURE_RATING_KEYS) {
      payload[key] = Number(data[key] ?? 0);
    }
  }

  if (type === AnalyticType.INFORMATION_SECURITY) {
    for (const key of INFORMATION_SECURITY_TEXT_KEYS) {
      payload[key] = String(data[key] ?? "");
    }
    for (const key of INFORMATION_SECURITY_ENUM_KEYS) {
      payload[key] = Number(data[key] ?? 0);
    }
    for (const key of INFORMATION_SECURITY_BOOL_KEYS) {
      payload[key] = Boolean(data[key]);
    }
    // Несколько ресурсов в порядке выбора.
    const resources = data.informationSecurityResources;
    payload.informationSecurityResources = Array.isArray(resources)
      ? resources.map((v) => Number(v))
      : [];
  }

  if (type === AnalyticType.TECHNICAL_SUPPLY) {
    for (const key of TECHNICAL_SUPPLY_BOOL_KEYS) {
      payload[key] = Boolean(data[key]);
    }
  }

  return payload;
};
