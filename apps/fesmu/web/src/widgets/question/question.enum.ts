import type { SelectOption } from "./question.types";

type EnumLike = Record<string, string | number>;

/**
 * Собирает варианты выпадающего списка из числового enum (в т.ч. protobuf-enum
 * от protoc-gen-es) и карты подписей. По умолчанию нулевое значение
 * (UNSPECIFIED / UNKNOWN) пропускается.
 */
export function enumOptions(
  source: EnumLike,
  labels: Record<number, string>,
  options: { includeZero?: boolean } = {},
): SelectOption[] {
  const seen = new Set<number>();
  const result: SelectOption[] = [];

  for (const value of Object.values(source)) {
    if (typeof value !== "number" || seen.has(value)) continue;
    seen.add(value);
    if (value === 0 && !options.includeZero) continue;
    result.push({ value, label: labels[value] ?? String(value) });
  }

  return result;
}
