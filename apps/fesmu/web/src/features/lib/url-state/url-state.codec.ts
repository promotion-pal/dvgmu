/** How one piece of state is written to and read from a query parameter.
 * `parse` gets the raw value (null when the parameter is absent) and returns
 * undefined for anything it can't make sense of, so a hand-edited or stale
 * link degrades to "not set" instead of breaking the page. `format` returns
 * undefined to leave the parameter out of the URL. */
export interface UrlCodec<V> {
  parse: (raw: string | null) => V | undefined;
  format: (value: V) => string | undefined;
}

const LIST_SEPARATOR = ",";

const text: UrlCodec<string> = {
  parse: (raw) => (raw && raw.trim() ? raw.trim() : undefined),
  format: (value) => value || undefined,
};

const integer: UrlCodec<number> = {
  parse: (raw) => {
    if (raw === null || raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isInteger(value) ? value : undefined;
  },
  format: (value) => String(value),
};

const isoDate: UrlCodec<string> = {
  parse: (raw) => (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined),
  format: (value) => value || undefined,
};

/** "a,b,c" <-> ["a", "b", "c"]; an empty list is left out of the URL. */
const list = <V>(item: UrlCodec<V>): UrlCodec<V[]> => ({
  parse: (raw) => {
    if (!raw) return undefined;
    const values = raw
      .split(LIST_SEPARATOR)
      .map((part) => item.parse(part))
      .filter((value): value is V => value !== undefined);
    return values.length > 0 ? values : undefined;
  },
  format: (values) => {
    const parts = values.map((value) => item.format(value)).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(LIST_SEPARATOR) : undefined;
  },
});

/** One of a fixed set of values — anything else in the URL is ignored. */
const oneOf = <V extends string>(values: readonly V[]): UrlCodec<V> => ({
  parse: (raw) => (values as readonly string[]).includes(raw ?? "") ? (raw as V) : undefined,
  format: (value) => value,
});

export const urlCodec = { text, integer, isoDate, list, oneOf };
