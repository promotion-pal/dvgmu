/**
 * Номер зачётной книжки — 7 цифр вида FFYYNNN, но для приложения из него
 * берётся только код факультета FF. Курс определяется по номеру группы.
 * Зеркалит User.ParseFaculty / ParseCourse на бэкенде.
 */

const FACULTY_BY_CODE: Record<number, string> = {
  10: "ЛЕЧ",
  20: "ПЕД",
  30: "СТОМ",
  40: "ФАРМ",
  71: "МГФ",
};

export interface RecordBookInfo {
  facultyCode: number;
  faculty: string;
}

export const RECORD_BOOK_REGEX = /^\d{7}$/;
export const GROUP_REGEX = /^\d{3,4}$/;

export function parseRecordBook(recordBook: string): RecordBookInfo | null {
  const digits = recordBook.trim();
  if (!RECORD_BOOK_REGEX.test(digits)) return null;

  const facultyCode = Math.floor(Number(digits) / 100000);

  return {
    facultyCode,
    faculty: FACULTY_BY_CODE[facultyCode] ?? `Факультет ${facultyCode}`,
  };
}

export function facultyFromRecordBook(recordBook: string): string {
  return parseRecordBook(recordBook)?.faculty ?? "—";
}

/** Курс — первая цифра номера группы (309 → 3). null, если вне 1–6. */
export function courseFromGroup(group: string): number | null {
  const match = group.trim().match(/\d/);
  if (!match) return null;
  const course = Number(match[0]);
  return course >= 1 && course <= 6 ? course : null;
}

/**
 * Этаж = номер комнаты без последних двух цифр: 305 → 3, 203 → 2,
 * 1014 → 10, 1104 → 11.
 */
export function floorFromRoom(room: number | string): number | null {
  const digits = String(room).replace(/\D/g, "");
  const value = Number(digits);
  if (!digits || !Number.isFinite(value) || value < 100) return null;
  return Math.floor(value / 100);
}
