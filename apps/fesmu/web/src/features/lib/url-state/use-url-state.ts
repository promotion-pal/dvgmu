import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { UrlCodec } from "./url-state.codec";

/** Which query parameter each field of the state lives in, and how it's encoded. */
export type UrlStateSchema<T> = {
  [K in keyof T]-?: { key: string; codec: UrlCodec<NonNullable<T[K]>> };
};

export type UrlStateUpdate<T> = T | ((current: T) => T);

const read = <T extends object>(params: URLSearchParams, schema: UrlStateSchema<T>, fallback: T): T => {
  const state = { ...fallback };
  for (const field of Object.keys(schema) as (keyof T)[]) {
    const { key, codec } = schema[field];
    const value = codec.parse(params.get(key));
    if (value !== undefined) state[field] = value as T[keyof T];
  }
  return state;
};

/** Writes the schema's fields into `params`, leaving any other parameter alone.
 * A field equal to its fallback is left out, so links stay short. */
const write = <T extends object>(params: URLSearchParams, schema: UrlStateSchema<T>, fallback: T, state: T) => {
  const next = new URLSearchParams(params);
  for (const field of Object.keys(schema) as (keyof T)[]) {
    const { key, codec } = schema[field];
    next.delete(key);

    const value = state[field];
    if (value === undefined || value === null) continue;
    const formatted = codec.format(value as NonNullable<T[keyof T]>);
    const fallbackValue = fallback[field];
    const formattedFallback =
      fallbackValue === undefined || fallbackValue === null ? undefined : codec.format(fallbackValue as NonNullable<T[keyof T]>);
    if (formatted !== undefined && formatted !== formattedFallback) next.set(key, formatted);
  }
  return next;
};

/**
 * State kept in the page's query string instead of component memory, so the
 * page can be shared or bookmarked as it is and restored from the link.
 * Works like useState: `setState(next)` or `setState(current => next)`.
 * Changes replace the history entry — flipping a filter shouldn't make
 * "Back" step through every click.
 *
 * `fallback` is the state when a parameter is absent (and is never written).
 */
export const useUrlState = <T extends object>(schema: UrlStateSchema<T>, fallback: T) => {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => read(params, schema, fallback), [params, schema, fallback]);

  const setState = useCallback(
    (update: UrlStateUpdate<T>) =>
      setParams(
        (current) => {
          const currentState = read(current, schema, fallback);
          const nextState = typeof update === "function" ? (update as (value: T) => T)(currentState) : update;
          return write(current, schema, fallback, nextState);
        },
        { replace: true },
      ),
    [setParams, schema, fallback],
  );

  return [state, setState] as const;
};
