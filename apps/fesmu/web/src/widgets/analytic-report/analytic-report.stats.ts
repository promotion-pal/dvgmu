import { create } from "@bufbuild/protobuf";
import { calculatePercentage, resolveDate } from "@/widgets/analytic/analytic.lib";
import { analyticCategoryLabel, analyticShortName, extractAnalyticCategory } from "@/widgets/analytic/analytic.utils";
import type { Analytic, AnalyticRating } from "@fesmu/contract/entity/analytic.entity_pb";
import { AnalyticSchema } from "@fesmu/contract/entity/analytic.entity_pb";
import type { AnalyticType } from "@fesmu/contract/enum/analytic.enum_pb";

import type {
  AnalyticFieldDef} from "./field-registry";
import {
  enumLabel,
  isFieldPresent,
  readField,
  resolveActiveFields,
} from "./field-registry";

export interface FieldValueBucket {
  label: string;
  count: number;
  /** Доля ответивших по полю (0–100). */
  percent: number;
}

export interface FieldSummary {
  def: AnalyticFieldDef;
  /** Сколько ответов заполнили это поле. */
  answered: number;
  /** Средняя оценка для kind === "rating" (0, если нет данных). */
  average: number;
  /** Доля «да» для kind === "bool" (0–100). */
  truePercent: number;
  /** Распределение значений для bool / enum / enumList / rating. */
  buckets: FieldValueBucket[];
}

export interface RespondentAnswer {
  ratingId: string;
  /** Кто ответил: ФИО из опроса ИБ либо «Ответ #id». */
  name: string;
  subtitle?: string;
  createdAt?: Date;
  /** Ответ на выбранное поле, приведённый к строке. */
  value: string;
  answered: boolean;
}

export interface AnalyticReportSummary {
  responses: number;
  firstAt?: Date;
  lastAt?: Date;
  activeFields: AnalyticFieldDef[];
  /** Ключевая цифра для карточки в списке. */
  headline: string;
  headlineHint: string;
}

export const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const averageOf = (values: number[]): number =>
  values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : 0;

export const respondentName = (rating: AnalyticRating): string => {
  const full = [
    rating.respondentLastName,
    rating.respondentFirstName,
    rating.respondentMiddleName,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (full) return full;
  return `Ответ #${rating.id.toString()}`;
};

export const respondentSubtitle = (rating: AnalyticRating): string | undefined => {
  const parts = [
    rating.informationSecurityPosition?.trim(),
    rating.respondentDepartment?.trim(),
    rating.respondentOffice?.trim()
      ? `каб. ${rating.respondentOffice.trim()}`
      : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
};

export const formatFieldValue = (
  rating: AnalyticRating,
  def: AnalyticFieldDef,
): string => {
  const value = readField(rating, def);
  switch (def.kind) {
    case "rating":
      return typeof value === "number" && value > 0 ? `${value} / 5` : "—";
    case "bool":
      return value ? "Да" : "Нет";
    case "enum":
      return typeof value === "number" && value > 0
        ? enumLabel(def, value)
        : "—";
    case "enumList":
      return Array.isArray(value) && value.length
        ? value.map((v) => enumLabel(def, v)).join(", ")
        : "—";
    case "text":
      return typeof value === "string" && value.trim() ? value.trim() : "—";
    default:
      return "—";
  }
};

export const summarizeField = (
  ratings: AnalyticRating[],
  def: AnalyticFieldDef,
): FieldSummary => {
  const present = ratings.filter((r) => isFieldPresent(r, def));
  const answered = present.length;

  let average = 0;
  let truePercent = 0;
  const bucketMap = new Map<string, number>();

  if (def.kind === "rating") {
    const nums = present
      .map((r) => Number(readField(r, def)))
      .filter((v) => v >= 1 && v <= 5);
    average = averageOf(nums);
    [1, 2, 3, 4, 5].forEach((score) =>
      bucketMap.set(
        `Оценка ${score}`,
        nums.filter((v) => v === score).length,
      ),
    );
  } else if (def.kind === "bool") {
    const yes = ratings.filter((r) => Boolean(readField(r, def))).length;
    truePercent = calculatePercentage(yes, ratings.length);
    bucketMap.set("Да", yes);
    bucketMap.set("Нет", ratings.length - yes);
  } else if (def.kind === "enum") {
    present.forEach((r) => {
      const label = enumLabel(def, Number(readField(r, def)));
      bucketMap.set(label, (bucketMap.get(label) ?? 0) + 1);
    });
  } else if (def.kind === "enumList") {
    present.forEach((r) => {
      (readField(r, def) as number[]).forEach((v) => {
        const label = enumLabel(def, v);
        bucketMap.set(label, (bucketMap.get(label) ?? 0) + 1);
      });
    });
  }

  const denom = def.kind === "bool" ? ratings.length : answered;
  const buckets: FieldValueBucket[] = [...bucketMap.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: calculatePercentage(count, denom),
    }))
    .sort((a, b) => b.count - a.count);

  return { def, answered, average, truePercent, buckets };
};

/** Отвечает ли rating одному из выбранных значений поля def (для фильтра по полю). */
export const fieldValueMatchesAny = (
  rating: AnalyticRating,
  def: AnalyticFieldDef,
  selected: Set<string>,
): boolean => {
  if (selected.size === 0) return true;

  if (def.kind === "enumList") {
    const raw = readField(rating, def);
    return (
      Array.isArray(raw) &&
      raw.some((v) => selected.has(enumLabel(def, v as number)))
    );
  }
  if (def.kind === "rating") {
    const raw = readField(rating, def);
    return typeof raw === "number" && selected.has(`Оценка ${raw}`);
  }
  // bool / enum — formatFieldValue уже приводит к одной строке, совпадающей
  // с подписью bucket'а ("Да"/"Нет" или enumLabel).
  return selected.has(formatFieldValue(rating, def));
};

export const collectRespondents = (
  ratings: AnalyticRating[],
  def: AnalyticFieldDef,
): RespondentAnswer[] =>
  [...ratings]
    .sort(
      (a, b) =>
        (resolveDate(b.createdAt)?.getTime() ?? 0) -
        (resolveDate(a.createdAt)?.getTime() ?? 0),
    )
    .map((r) => ({
      ratingId: r.id.toString(),
      name: respondentName(r),
      subtitle: respondentSubtitle(r),
      createdAt: resolveDate(r.createdAt),
      value: formatFieldValue(r, def),
      answered: isFieldPresent(r, def),
    }));

export const summarizeAnalytic = (entity: Analytic): AnalyticReportSummary => {
  const ratings = entity.ratings ?? [];
  const activeFields = resolveActiveFields(entity.type, ratings);

  const dates = ratings
    .map((r) => resolveDate(r.createdAt))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());

  const ratingFields = activeFields.filter((f) => f.kind === "rating");
  const boolFields = activeFields.filter((f) => f.kind === "bool");

  const ratingAvg = averageOf(
    ratingFields.flatMap((def) =>
      ratings
        .map((r) => Number(readField(r, def)))
        .filter((v) => v >= 1 && v <= 5),
    ),
  );

  const boolTrue = boolFields.reduce(
    (acc, def) => acc + ratings.filter((r) => Boolean(readField(r, def))).length,
    0,
  );
  const boolTotal = boolFields.length * ratings.length;
  const boolPercent = calculatePercentage(boolTrue, boolTotal);

  let headline = `${ratings.length} ответов`;
  let headlineHint = "Собрано ответов на опрос";
  if (ratingFields.length) {
    headline = `${ratingAvg || "—"} / 5`;
    headlineHint = "Средняя оценка по всем критериям";
  } else if (boolFields.length && ratings.length) {
    headline = `${boolPercent}%`;
    headlineHint = "Доля положительных ответов по чек-листу";
  }

  return {
    responses: ratings.length,
    firstAt: dates[0],
    lastAt: dates[dates.length - 1],
    activeFields,
    headline,
    headlineHint,
  };
};

/** Категория опросов: все объекты одного типа и их ответы, слитые в один
 * «сводный» Analytic — по нему считаются общая оценка и статистика полей. */
export interface AnalyticCategoryGroup {
  type: AnalyticType;
  label: string;
  objects: Analytic[];
  merged: Analytic;
  /** id объекта → название, чтобы в общей сводке было видно, откуда ответ. */
  objectNames: Map<string, string>;
}

export const mergeCategory = (type: AnalyticType, objects: Analytic[]): AnalyticCategoryGroup => {
  const label = analyticCategoryLabel(type);
  return {
    type,
    label,
    objects,
    merged: create(AnalyticSchema, {
      type,
      name: label,
      transcript: "",
      ratings: objects.flatMap((o) => o.ratings),
    }),
    objectNames: new Map(objects.map((o) => [o.id.toString(), analyticShortName(o)])),
  };
};

/** Раскладывает объекты по категориям в порядке справочника типов. */
export const groupByCategory = (list: Analytic[]): AnalyticCategoryGroup[] =>
  extractAnalyticCategory
    .map((c) => mergeCategory(c.value, list.filter((o) => o.type === c.value)))
    .filter((g) => g.objects.length > 0);
