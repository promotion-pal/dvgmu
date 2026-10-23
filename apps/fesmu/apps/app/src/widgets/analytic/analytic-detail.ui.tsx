/* eslint-disable react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC} from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { resolveDate } from "@/widgets/analytic/analytic.lib";
import { ROUTE } from "@/shared/config/path";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { FieldDistributionChart } from "@/shared/components/chart";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

import type { Analytic } from "@dvgmu/contract/packages/analytics/entity/analytic.entity_pb";

import { analyticClient } from "./analytic.fn";
import { extractAnalyticCategory } from "./analytic.utils";
import { resolveActiveFields } from "../analytic-report/field-registry";
import {
  respondentName,
  respondentSubtitle,
  summarizeField,
  type FieldSummary,
} from "../analytic-report/analytic-report.stats";
import { RatingDetailModal } from "../analytic-report/rating-detail.ui";

const typeLabel = (type: Analytic["type"]) =>
  extractAnalyticCategory.find((o) => o.value === type)?.label ?? "—";

const formatDay = (date?: Date): string =>
  date
    ? date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const fieldHeadline = (summary: FieldSummary): string => {
  switch (summary.def.kind) {
    case "rating":
      return summary.average ? `${summary.average} / 5` : "Н/Д";
    case "bool":
      return `${summary.truePercent}%`;
    case "enum":
    case "enumList":
      return summary.buckets[0]?.label ?? "Н/Д";
    case "text":
      return `${summary.answered} отв.`;
    default:
      return "—";
  }
};

const FieldStatCard: FC<{
  summary: FieldSummary;
  active: boolean;
  onClick: () => void;
}> = ({ summary, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "min-w-0 rounded-lg border p-3 text-left transition-colors",
      active ? "border-primary bg-primary/5" : "hover:bg-muted",
    )}
  >
    <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {summary.def.label}
    </p>
    <p className="mt-1 text-lg font-semibold">{fieldHeadline(summary)}</p>
    <p className="text-xs text-muted-foreground">
      заполнили: {summary.answered}
    </p>
  </button>
);

export const AnalyticDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entity, setEntity] = useState<Analytic | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedRatingId, setSelectedRatingId] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setLoading(true);
    setError(false);
    analyticClient
      .analyticByID({ id: BigInt(id) })
      .then((res) => {
        if (!cancelled) setEntity(res.entity);
      })
      .catch((err) => {
        console.error("Ошибка при получении данных аналитики:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const activeFields = useMemo(
    () => (entity ? resolveActiveFields(entity.type, entity.ratings) : []),
    [entity],
  );
  const metricFields = useMemo(
    () => activeFields.filter((f) => f.role !== "identity"),
    [activeFields],
  );
  const identityFields = useMemo(
    () => activeFields.filter((f) => f.role === "identity"),
    [activeFields],
  );

  const fieldSummaries = useMemo(
    () =>
      entity ? metricFields.map((def) => summarizeField(entity.ratings, def)) : [],
    [entity, metricFields],
  );

  const [activeKey, setActiveKey] = useState<string>("");
  useEffect(() => {
    setActiveKey(metricFields[0]?.key ?? "");
  }, [entity?.id, metricFields]);

  const activeSummary =
    fieldSummaries.find((s) => s.def.key === activeKey) ?? fieldSummaries[0];

  const sortedRatings = useMemo(() => {
    if (!entity) return [];
    return [...entity.ratings].sort(
      (a, b) =>
        (resolveDate(b.createdAt)?.getTime() ?? 0) -
        (resolveDate(a.createdAt)?.getTime() ?? 0),
    );
  }, [entity]);

  const selectedRating = sortedRatings.find(
    (r) => r.id.toString() === selectedRatingId,
  );

  return (
    <CommonWrapper
      title={entity?.name ?? "Объект аналитики"}
      description={
        entity ? `${typeLabel(entity.type)} · QR ${entity.qr.toString()}` : undefined
      }
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(ROUTE.ANALYTICS.SURVEYS)}
        >
          <ArrowLeftIcon className="size-3.5" />
          К списку
        </Button>
      }
    >
      <CommonControlState
        isLoading={loading}
        isError={error}
        isEmpty={!loading && !error && !entity}
        error={<CommonServiceError service="аналитики" />}
      >
        {entity && (
          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-semibold">
                    {entity.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entity.transcript ? `В аналитике: ${entity.transcript}` : "короткого названия нет"}
                  </p>
                </div>
                <Badge variant="secondary">{typeLabel(entity.type)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>QR: {entity.qr.toString()}</span>
                <span>Ответов: {entity.ratings.length}</span>
                <span>Создан: {formatDay(resolveDate(entity.createdAt))}</span>
                <span>Обновлён: {formatDay(resolveDate(entity.updatedAt))}</span>
              </div>
            </Card>

            {entity.ratings.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Ответов на этот опрос ещё нет. Ниже — поля, которые появятся в
                выгрузке.
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {metricFields.map((f) => (
                    <Badge key={f.key} variant="secondary">
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </Card>
            ) : (
              <>
                {fieldSummaries.length > 0 && (
                  <Card className="p-4">
                    <p className="mb-3 font-heading text-sm font-semibold">
                      Статистика по полям
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {fieldSummaries.map((s) => (
                        <FieldStatCard
                          key={s.def.key}
                          summary={s}
                          active={s.def.key === activeSummary?.def.key}
                          onClick={() => setActiveKey(s.def.key)}
                        />
                      ))}
                    </div>
                  </Card>
                )}

                {activeSummary && (
                  <Card className="p-4">
                    <p className="font-heading text-sm font-semibold">
                      {activeSummary.def.label}
                    </p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {activeSummary.def.group} · заполнили{" "}
                      {activeSummary.answered} из {entity.ratings.length}
                    </p>
                    <FieldDistributionChart buckets={activeSummary.buckets} />
                  </Card>
                )}

                <Card className="p-4">
                  <p className="mb-3 font-heading text-sm font-semibold">
                    Ответы
                  </p>
                  <div className="flex flex-col divide-y rounded-lg border">
                    {sortedRatings.map((r) => (
                      <button
                        key={r.id.toString()}
                        type="button"
                        onClick={() => setSelectedRatingId(r.id.toString())}
                        className="flex flex-col gap-1 p-3 text-left text-sm hover:bg-muted sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{respondentName(r)}</p>
                          {respondentSubtitle(r) && (
                            <p className="text-xs text-muted-foreground">
                              {respondentSubtitle(r)}
                            </p>
                          )}
                          {r.comment && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {r.comment}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDay(resolveDate(r.createdAt))}
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </CommonControlState>

      <RatingDetailModal
        rating={selectedRating}
        metricFields={metricFields}
        identityFields={identityFields}
        onClose={() => setSelectedRatingId(undefined)}
      />
    </CommonWrapper>
  );
};
