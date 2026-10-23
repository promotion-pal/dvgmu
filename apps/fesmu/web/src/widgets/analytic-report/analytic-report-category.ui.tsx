import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { create } from "@bufbuild/protobuf";
import { ArrowLeftIcon } from "lucide-react";

import { ROUTE } from "@/shared/config/path";
import { AnalyticQrBatchButton } from "@/widgets/analytic";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { AnalyticFetchRequestSchema } from "@dvgmu/analytics/service/analytic.service_pb";
import type { Analytic } from "@dvgmu/analytics/entity/analytic.entity_pb";
import type { AnalyticType } from "@dvgmu/analytics/enum/analytic.enum_pb";

import { analyticClient } from "./analytic-report.fn";
import { resolveActiveFields } from "./field-registry";
import { mergeCategory } from "./analytic-report.stats";
import { AnalyticDetail, AnalyticSummaryCard } from "./analytic-report.ui";
import { RatingDetailModal } from "./rating-detail.ui";

/** Категория опросов: сначала общая сводка по всем объектам типа, ниже — каждый объект. */
export const AnalyticCategoryReport: FC = () => {
  const { type: typeParam } = useParams<{ type: string }>();
  const type = Number(typeParam) as AnalyticType;
  const navigate = useNavigate();

  const [objects, setObjects] = useState<Analytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedRatingId, setSelectedRatingId] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const acc: Analytic[] = [];
        const stream = analyticClient.analyticFetch(create(AnalyticFetchRequestSchema, { type }));
        for await (const chunk of stream) {
          if (chunk.entity?.type === type) acc.push(chunk.entity);
        }
        if (!cancelled) setObjects(acc);
      } catch (err) {
        console.error("Ошибка загрузки категории аналитики:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const group = useMemo(() => mergeCategory(type, objects), [type, objects]);

  const activeFields = resolveActiveFields(type, group.merged.ratings);
  const selectedRating = group.merged.ratings.find((r) => r.id.toString() === selectedRatingId);

  return (
    <CommonWrapper
      title={group.label}
      description="Общая оценка по всем объектам категории, ниже — каждый объект отдельно."
      action={
        <div className="flex flex-wrap gap-2">
          <AnalyticQrBatchButton list={objects} fileName={`qr-${group.label}`} />
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTE.ANALYTICS.REPORT)}>
            <ArrowLeftIcon className="size-3.5" />
            К категориям
          </Button>
        </div>
      }
    >
      <CommonControlState
        isLoading={loading}
        isError={error}
        isEmpty={!loading && !error && objects.length === 0}
        error={<CommonServiceError service="аналитики" />}
      >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <p className="font-heading text-base font-semibold">Общая сводка</p>
            <AnalyticDetail
              entity={group.merged}
              objectNames={group.objectNames}
              onRatingClick={setSelectedRatingId}
            />
          </section>

          <section className="flex flex-col gap-3">
            <p className="font-heading text-base font-semibold">По объектам</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.objects.map((item) => (
                <AnalyticSummaryCard
                  key={item.id.toString()}
                  entity={item}
                  onOpen={() => navigate(`${ROUTE.ANALYTICS.REPORT}/${item.id}`)}
                />
              ))}
            </div>
          </section>
        </div>
      </CommonControlState>

      <RatingDetailModal
        rating={selectedRating}
        metricFields={activeFields.filter((f) => f.role !== "identity")}
        identityFields={activeFields.filter((f) => f.role === "identity")}
        onClose={() => setSelectedRatingId(undefined)}
      />
    </CommonWrapper>
  );
};
