import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { create } from "@bufbuild/protobuf";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";

import { ROUTE } from "@/shared/config/path";
import { AnalyticQrBatchButton } from "@/widgets/analytic";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { AnalyticFetchRequestSchema } from "@fesmu/contract/analytics/service/analytic.service_pb";
import { AnalyticSchema } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import { AnalyticType } from "@fesmu/contract/analytics/enum/analytic.enum_pb";

import { analyticClient } from "./analytic-report.fn";
import { resolveDate } from "@/widgets/analytic/analytic.lib";
import { resolveActiveFields } from "./field-registry";
import { mergeCategory, plural } from "./analytic-report.stats";
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [soapProblemsOnly, setSoapProblemsOnly] = useState(false);

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

  const dateFilteredObjects = useMemo(() => {
    if (!dateFrom && !dateTo) return objects;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return objects.map((object) => create(AnalyticSchema, {
      ...object,
      ratings: object.ratings.filter((rating) => {
        const createdAt = resolveDate(rating.createdAt)?.getTime();
        return createdAt !== undefined && createdAt >= from && createdAt <= to;
      }),
    }));
  }, [objects, dateFrom, dateTo]);

  const missingSoapRatings = type === AnalyticType.TOILET
    ? dateFilteredObjects.flatMap((object) => object.ratings).filter((rating) => !rating.hasSoap)
    : [];
  const objectsWithMissingSoap = type === AnalyticType.TOILET
    ? dateFilteredObjects.filter((object) => object.ratings.some((rating) => !rating.hasSoap)).length
    : 0;
  const visibleObjects = useMemo(() => {
    if (!soapProblemsOnly) return dateFilteredObjects;
    return dateFilteredObjects.map((object) => create(AnalyticSchema, {
      ...object,
      ratings: object.ratings.filter((rating) => !rating.hasSoap),
    }));
  }, [dateFilteredObjects, soapProblemsOnly]);
  const group = useMemo(() => mergeCategory(type, visibleObjects), [type, visibleObjects]);

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
        <section className="mb-6 rounded-xl border bg-card p-4 shadow-xs ring-1 ring-foreground/10">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-heading text-base font-semibold">Фильтры отчёта</h2>
              <p className="text-sm text-muted-foreground">Период применяется к датам ответов и обновляет сводку и список объектов.</p>
            </div>
            {(dateFrom || dateTo || soapProblemsOnly) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSoapProblemsOnly(false);
              }}>
                Сбросить фильтры
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              С даты
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Начало периода" className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              По дату
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Конец периода" className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground" />
            </label>
            {type === AnalyticType.TOILET && (
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted">
                <input type="checkbox" checked={soapProblemsOnly} onChange={(event) => setSoapProblemsOnly(event.target.checked)} />
                Показывать только ответы «мыла нет»
              </label>
            )}
          </div>
          {dateFrom && dateTo && dateFrom > dateTo && (
            <p className="mt-2 text-sm text-destructive">Начало периода должно быть раньше окончания.</p>
          )}
        </section>

        {type === AnalyticType.TOILET && (
          <section className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <h2 className="font-heading font-semibold text-destructive">Проблемы с мылом</h2>
                  <p className="text-sm text-muted-foreground">
                    В {objectsWithMissingSoap} из {dateFilteredObjects.length} санузлов получены ответы об отсутствии мыла.
                    {" "}{missingSoapRatings.length} {plural(missingSoapRatings.length, "ответ всего", "ответа всего", "ответов всего")}.
                  </p>
                </div>
              </div>
              <Button
                variant={soapProblemsOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setSoapProblemsOnly((value) => !value)}
              >
                {soapProblemsOnly ? "Показаны только проблемы" : "Показать санузлы с проблемой"}
              </Button>
            </div>
          </section>
        )}

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
