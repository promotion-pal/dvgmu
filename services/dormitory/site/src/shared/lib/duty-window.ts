/**
 * Правила записи на дежурство.
 *
 * Запись всегда идёт на следующий календарный месяц.
 */

/** Диапазон дат дежурства — весь следующий месяц. */
export interface MonthRange {
  start: Date;
  end: Date;
  label: string;
}

export function nextMonthRange(now: Date = new Date()): MonthRange {
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    start,
    end,
    label: start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
  };
}

export const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

// Дата дежурства хранится на бэке как UTC-полночь — календарный день берём по UTC.
export const toISODateUTC = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;

/**
 * Полная проверка возможности записи. Возвращает причину отказа или null.
 */
export function bookingBlockReason(course: number | null): string | null {
  if (course === null) {
    return "Курс не определён — проверьте номер группы";
  }
  return null;
}
