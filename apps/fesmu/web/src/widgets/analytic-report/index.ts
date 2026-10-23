export { AnalyticReportComponent, AnalyticDetail } from "./analytic-report.ui";
export { AnalyticReportDetail } from "./analytic-report-detail.ui";
export { AnalyticCategoryReport } from "./analytic-report-category.ui";
export { RatingDetailModal } from "./rating-detail.ui";
export {
  useAnalyticReport,
  analyticTypeLabel,
  ANALYTIC_TYPE_OPTIONS,
} from "./analytic-report.fn";
export type { AnalyticReportCategory } from "./analytic-report.fn";
export {
  ANALYTIC_FIELD_DEFS,
  resolveActiveFields,
  isFieldPresent,
  enumLabel,
} from "./field-registry";
export type {
  AnalyticFieldDef,
  AnalyticFieldKind,
  AnalyticFieldRole,
} from "./field-registry";
export {
  summarizeAnalytic,
  groupByCategory,
  mergeCategory,
  summarizeField,
  collectRespondents,
  formatFieldValue,
  respondentName,
  fieldValueMatchesAny,
} from "./analytic-report.stats";
export type {
  AnalyticReportSummary,
  AnalyticCategoryGroup,
  FieldSummary,
  FieldValueBucket,
  RespondentAnswer,
} from "./analytic-report.stats";
