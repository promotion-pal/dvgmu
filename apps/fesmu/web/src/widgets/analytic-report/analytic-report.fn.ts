import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useSearchParams } from "react-router-dom";

import { connectTransport } from "@/shared/config/api";
import {
  AnalyticService,
  AnalyticFetchRequestSchema,
} from "@fesmu/contract/analytics/service/analytic.service_pb";
import type { AnalyticType } from "@fesmu/contract/analytics/enum/analytic.enum_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import { AnalyticSchema } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

import { analyticCategoryLabel, extractAnalyticCategory, isAnalyticTypeEnabled } from "@/widgets/analytic";
import { resolveDate } from "@/widgets/analytic/analytic.lib";

export const analyticClient = createClient(AnalyticService, connectTransport);

export type AnalyticReportCategory = AnalyticType | "all";

export const ANALYTIC_TYPE_OPTIONS = extractAnalyticCategory;

export const analyticTypeLabel = (type: AnalyticType): string => analyticCategoryLabel(type);

/** Current calendar week, Monday through today, formatted for native date inputs. */
export const currentWeekDateRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const toInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { from: toInputValue(start), to: toInputValue(today) };
};

export const useAnalyticReport = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceList, setSourceList] = useState<Analytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<AnalyticReportCategory>("all");
  const [initialWeek] = useState(currentWeekDateRange);
  const hasPeriodInUrl = searchParams.has("from") || searchParams.has("to") || searchParams.has("period");
  const [dateFrom, setDateFromState] = useState(() => hasPeriodInUrl ? searchParams.get("from") ?? "" : initialWeek.from);
  const [dateTo, setDateToState] = useState(() => hasPeriodInUrl ? searchParams.get("to") ?? "" : initialWeek.to);

  const setDateRange = (from: string, to: string) => {
    setDateFromState(from);
    setDateToState(to);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (from) next.set("from", from); else next.delete("from");
      if (to) next.set("to", to); else next.delete("to");
      next.set("period", from === initialWeek.from && to === initialWeek.to ? "week" : from || to ? "custom" : "all");
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (searchParams.has("from") || searchParams.has("to") || searchParams.has("period")) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("from", initialWeek.from);
      next.set("to", initialWeek.to);
      next.set("period", "week");
      return next;
    }, { replace: true });
  }, [initialWeek.from, initialWeek.to, searchParams, setSearchParams]);

  const requestId = useRef(0);

  useEffect(() => {
    const rid = ++requestId.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const stream = analyticClient.analyticFetch(
          create(AnalyticFetchRequestSchema, {
            name: search || undefined,
            type: type === "all" ? undefined : type,
          }),
        );

        const acc: Analytic[] = [];
        for await (const chunk of stream) {
          if (chunk.entity && isAnalyticTypeEnabled(chunk.entity.type)) acc.push(chunk.entity);
        }

        if (!cancelled && rid === requestId.current) setSourceList(acc);
      } catch (err) {
        if (!cancelled && rid === requestId.current) {
          console.error("Ошибка загрузки аналитики:", err);
          setError(true);
        }
      } finally {
        if (!cancelled && rid === requestId.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, type, reloadKey]);

  const list = useMemo(() => {
    if (!dateFrom && !dateTo) return sourceList;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return sourceList.map((entity) => create(AnalyticSchema, {
      ...entity,
      ratings: entity.ratings.filter((rating) => {
        const date = resolveDate(rating.createdAt)?.getTime();
        return date !== undefined && date >= from && date <= to;
      }),
    }));
  }, [sourceList, dateFrom, dateTo]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setSearchDebounced = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  return {
    list,
    loading,
    error,
    empty: !loading && !error && list.length === 0,
    retry: () => setReloadKey((k) => k + 1),

    search,
    setSearch: setSearchDebounced,
    type,
    setType,
    dateFrom,
    setDateFrom: (value: string) => setDateRange(value, dateTo),
    dateTo,
    setDateTo: (value: string) => setDateRange(dateFrom, value),
    setDateRange,
    periodSearch: searchParams.toString(),
    defaultDateFrom: initialWeek.from,
    defaultDateTo: initialWeek.to,
  };
};
