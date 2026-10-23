import { useEffect, useRef, useState } from "react";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

import { connectTransport } from "@/shared/config/api";
import {
  AnalyticService,
  AnalyticFetchRequestSchema,
} from "@fesmu/contract/service/analytic.service_pb";
import type { AnalyticType } from "@fesmu/contract/enum/analytic.enum_pb";
import type { Analytic } from "@fesmu/contract/entity/analytic.entity_pb";

import { analyticCategoryLabel, extractAnalyticCategory, isAnalyticTypeEnabled } from "@/widgets/analytic";

export const analyticClient = createClient(AnalyticService, connectTransport);

export type AnalyticReportCategory = AnalyticType | "all";

export const ANALYTIC_TYPE_OPTIONS = extractAnalyticCategory;

export const analyticTypeLabel = (type: AnalyticType): string => analyticCategoryLabel(type);

export const useAnalyticReport = () => {
  const [list, setList] = useState<Analytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<AnalyticReportCategory>("all");

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

        if (!cancelled && rid === requestId.current) setList(acc);
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
  };
};
