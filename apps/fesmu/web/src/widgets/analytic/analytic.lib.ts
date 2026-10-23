/* eslint-disable @typescript-eslint/no-explicit-any -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

/**
 * Reads a possibly nested field (e.g. "base.status") off an arbitrary record.
 * Returns undefined for missing segments instead of throwing, so callers can
 * safely run analytics over loading/partial datasets.
 */
export const getByPath = (source: unknown, path: string): unknown => {
  if (source === undefined || source === null) return undefined;

  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null) return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, source);
};

const isTimestamp = (value: unknown): value is Timestamp =>
  typeof value === "object" &&
  value !== null &&
  "seconds" in value &&
  "nanos" in value;

/** Resolves either a JS Date or a protobuf Timestamp into a JS Date. Returns undefined for anything else. */
export const resolveDate = (value: unknown): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  if (isTimestamp(value)) return timestampDate(value);

  return undefined;
};

/**
 * Sums numeric values (top-level or dot-path) across the dataset for a list of keys.
 * bigint fields (protobuf int64) are coerced to Number, non-numeric values are ignored.
 */
export const calculateTotals = (
  data: any[],
  keys: string[],
): Record<string, number> => {
  return keys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = data.reduce((sum, item) => {
      const raw = getByPath(item, key);
      const value = typeof raw === "bigint" ? Number(raw) : Number(raw);

      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    return acc;
  }, {});
};

/** Safe ratio → percentage, rounded to one decimal. Never divides by zero. */
export const calculatePercentage = (value: number, total: number): number => {
  if (!total || !Number.isFinite(total)) return 0;

  return Math.round((value / total) * 1000) / 10;
};

/**
 * Groups the dataset by the (possibly nested) value at `keyPath` and counts occurrences.
 * Handles enum numbers, strings and bigint transparently by stringifying the bucket key.
 */
export const groupAndCount = (
  data: any[],
  keyPath: string,
): Record<string, number> => {
  const result: Record<string, number> = {};

  for (const item of data) {
    const raw = getByPath(item, keyPath);
    if (raw === undefined || raw === null) continue;

    const key = typeof raw === "bigint" ? raw.toString() : String(raw);
    result[key] = (result[key] ?? 0) + 1;
  }

  return result;
};

/** Turns a `groupAndCount` style record into chart-ready rows, sorted by value desc. */
export const recordToChartRows = (
  record: Record<string, number>,
  keyField = "key",
  valueField = "value",
): Array<Record<string, string | number>> => {
  return Object.entries(record)
    .map(([key, value]) => ({ [keyField]: key, [valueField]: value }))
    .sort((a, b) => (b[valueField] as number) - (a[valueField] as number));
};

export interface WeeklyTrend {
  current: number;
  previous: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

/**
 * Compares item counts in the last 7 days against the 7 days before that,
 * resolving `dateKeyPath` from either a JS Date or a protobuf Timestamp.
 */
export const calculateWeeklyTrend = (
  data: any[],
  dateKeyPath: string,
  referenceDate: Date = new Date(),
): WeeklyTrend => {
  const now = referenceDate.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const currentStart = now - weekMs;
  const previousStart = now - weekMs * 2;

  let current = 0;
  let previous = 0;

  for (const item of data) {
    const date = resolveDate(getByPath(item, dateKeyPath));
    if (!date) continue;

    const time = date.getTime();
    if (time >= currentStart && time <= now) current += 1;
    else if (time >= previousStart && time < currentStart) previous += 1;
  }

  const changePercent =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 1000) / 10;

  return {
    current,
    previous,
    changePercent,
    direction: changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat",
  };
};
