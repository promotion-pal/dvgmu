import { AnalyticType } from "@fesmu/contract/enum/analytic.enum_pb";

/** Все виды анкет — подписи, в том числе для ещё не включённых. */
const ALL_ANALYTIC_CATEGORIES = [
  { value: AnalyticType.WORKPLACE, label: "Рабочее место", emoji: "💼" },
  { value: AnalyticType.LECTURE, label: "Лекционный зал", emoji: "🎓" },
  { value: AnalyticType.TOILET, label: "Санузлы", emoji: "🧼" },
  { value: AnalyticType.INFORMATION_SECURITY, label: "Информационная безопасность", emoji: "🔐" },
  { value: AnalyticType.TECHNICAL_SUPPLY, label: "Техническое снабжение", emoji: "🛠️" },
];

/** Анкеты, включённые в fesmu. Техническое снабжение — позже: его вопросы,
 *  схема и поля отчёта уже лежат в question/ и analytic-report/, включить =
 *  добавить вид сюда. */
export const ENABLED_ANALYTIC_TYPES: readonly AnalyticType[] = [
  AnalyticType.WORKPLACE,
  AnalyticType.INFORMATION_SECURITY,
  AnalyticType.TOILET,
  AnalyticType.LECTURE,
];

export const isAnalyticTypeEnabled = (type: AnalyticType) => ENABLED_ANALYTIC_TYPES.includes(type);

/** Включённые виды — для выбора при создании опроса и фильтров. */
export const extractAnalyticCategory = ALL_ANALYTIC_CATEGORIES.filter((o) => isAnalyticTypeEnabled(o.value));

/** Подпись объекта в аналитике: короткое название (transcript), иначе полное.
 *  В анкете сотрудник видит полное name. */
export const analyticShortName = (a: { name: string; transcript: string }) => a.transcript.trim() || a.name;

/** Эмодзи вида анкеты — для шаблонов QR. */
export const analyticCategoryEmoji = (type: AnalyticType) =>
  ALL_ANALYTIC_CATEGORIES.find((o) => o.value === type)?.emoji ?? "📋";

export const analyticCategoryLabel = (type: AnalyticType) =>
  ALL_ANALYTIC_CATEGORIES.find((o) => o.value === type)?.label ?? "—";
