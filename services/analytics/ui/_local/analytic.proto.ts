export enum AnalyticType {
  UNKNOWN = 0,
  TOILET = 1,
  LECTURE = 2,
  WORKPLACE = 3,
  INFORMATION_SECURITY = 4,
  TECHNICAL_SUPPLY = 5,
}

/** Вид информации ограниченного доступа (вопрос 4). */
export enum InformationSecurityInfoType {
  UNSPECIFIED = 0,
  DSP = 1,
  PDN = 2,
  DSP_AND_PDN = 3,
  NONE = 4,
}

/** Информационные ресурсы (вопрос 5). */
export enum InformationSecurityResource {
  UNSPECIFIED = 0,
  FIS_GIA_PRIEM = 1,
  ONE_C = 2,
  ROSIMUSHCHESTVO = 3,
  ELECTRONIC_BUDGET = 4,
  GIS_FRDO_SPO = 5,
  FRDO_VO = 6,
  SMEV = 7,
  TRUD_ROSSII = 8,
  FRMR = 9,
  FRMO = 10,
  EGISU_NIOKTR = 11,
  MIS_MEDIALOG = 12,
  SFR = 13,
}

/** Операционная система на рабочем месте (вопрос 15). */
export enum InformationSecurityOs {
  UNSPECIFIED = 0,
  ASTRA = 1,
  WINDOWS = 2,
  RED_OS = 3,
}

export interface Analytic {
  id: number;
  qr?: number;
  name?: string;
  transcript?: string;
  type: AnalyticType;
}
