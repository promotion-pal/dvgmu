/* eslint-disable react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC} from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { analyticShortName } from "@/widgets/analytic/analytic.utils";
import { ROUTE } from "@/shared/config/path";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { FieldDistributionChart } from "@/shared/components/chart";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import type { AnalyticType } from "@dvgmu/contract/analytics/enum/analytic.enum_pb";
import type { Analytic } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";

import {
  ANALYTIC_TYPE_OPTIONS,
  analyticTypeLabel,
  useAnalyticReport,
} from "./analytic-report.fn";
import type { AnalyticFieldDef } from "./field-registry";
import {
  collectRespondents,
  fieldValueMatchesAny,
  groupByCategory,
  plural,
  summarizeAnalytic,
  summarizeField,
  type FieldSummary,
} from "./analytic-report.stats";

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

const FieldStatCard: FC<{ summary: FieldSummary }> = ({ summary }) => (
  <div className="min-w-0 rounded-lg border p-3">
    <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {summary.def.label}
    </p>
    <p className="mt-1 text-lg font-semibold">{fieldHeadline(summary)}</p>
    <p className="text-xs text-muted-foreground">
      заполнили: {summary.answered}
    </p>
  </div>
);

type RespondentSortMode = "date_desc" | "date_asc" | "name_asc" | "name_desc";

const SORT_OPTIONS: { value: RespondentSortMode; label: string }[] = [
  { value: "date_desc", label: "Сначала новые" },
  { value: "date_asc", label: "Сначала старые" },
  { value: "name_asc", label: "ФИО А→Я" },
  { value: "name_desc", label: "ФИО Я→А" },
];

/** Поля, по которым имеет смысл фильтровать список опрошенных — дискретные
 * значения (enum/enumList/bool/rating) с непустым распределением. Текстовые
 * поля сюда не идут — по ним и так ищем через ФИО/просмотр карточки. */
const filterableFieldSummaries = (summaries: FieldSummary[]): FieldSummary[] =>
  summaries.filter(
    (s) =>
      s.def.role !== "identity" &&
      s.def.kind !== "text" &&
      s.buckets.length > 0,
  );

const RespondentsTable: FC<{
  entity: Analytic;
  def: AnalyticFieldDef;
  filterFields: FieldSummary[];
  onRowClick?: (ratingId: string) => void;
  /** В сводке категории — подписать, к какому объекту относится ответ. */
  objectNames?: Map<string, string>;
}> = ({ entity, def, filterFields, onRowClick, objectNames }) => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RespondentSortMode>("date_desc");
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setSearch("");
    setSort("date_desc");
    setFieldFilters({});
  }, [entity.id]);

  const activeFilterEntries = useMemo(
    () => Object.entries(fieldFilters).filter(([, value]) => value),
    [fieldFilters],
  );

  const rows = useMemo(() => {
    let ratings = entity.ratings;
    if (activeFilterEntries.length) {
      ratings = ratings.filter((r) =>
        activeFilterEntries.every(([key, value]) => {
          const fieldDef = filterFields.find((f) => f.def.key === key)?.def;
          return !fieldDef || fieldValueMatchesAny(r, fieldDef, new Set([value]));
        }),
      );
    }

    let result = collectRespondents(ratings, def);
    if (objectNames) {
      const objectOf = new Map(ratings.map((r) => [r.id.toString(), objectNames.get(r.analyticId.toString())]));
      result = result.map((row) => {
        const object = objectOf.get(row.ratingId);
        return object ? { ...row, subtitle: [object, row.subtitle].filter(Boolean).join(" · ") } : row;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) result = result.filter((row) => row.name.toLowerCase().includes(q));

    return [...result].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name, "ru");
        case "name_desc":
          return b.name.localeCompare(a.name, "ru");
        case "date_asc":
          return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
        default:
          return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      }
    });
  }, [entity.ratings, def, search, sort, activeFilterEntries, filterFields, objectNames]);

  const hasAnyRespondents = entity.ratings.length > 0;
  const hasActiveNarrowing = Boolean(search.trim()) || activeFilterEntries.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasAnyRespondents && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="Поиск по ФИО"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-[220px]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RespondentSortMode)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs sm:w-auto"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {filterFields.map((f) => (
            <select
              key={f.def.key}
              value={fieldFilters[f.def.key] ?? ""}
              onChange={(e) =>
                setFieldFilters((prev) => ({ ...prev, [f.def.key]: e.target.value }))
              }
              className="max-w-[200px] rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              <option value="">{f.def.label}: все</option>
              {f.buckets.map((b) => (
                <option key={b.label} value={b.label}>
                  {b.label} ({b.count})
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <MessageSquare className="size-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {hasActiveNarrowing
              ? "Никто не подошёл под поиск/фильтр"
              : "Опрошенных пока нет"}
          </p>
        </div>
      ) : (
        <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {rows.map((row) => (
            <button
              key={row.ratingId}
              type="button"
              disabled={!onRowClick}
              onClick={() => onRowClick?.(row.ratingId)}
              className={cn(
                "flex w-full flex-col gap-1 p-3 text-left text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                onRowClick && "hover:bg-muted",
                !row.answered && "text-muted-foreground",
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                {row.subtitle && (
                  <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:shrink-0 sm:flex-col sm:items-end sm:text-right">
                <span className="font-medium text-foreground">{row.value}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDay(row.createdAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const AnalyticDetail: FC<{
  entity: Analytic;
  onRatingClick?: (ratingId: string) => void;
  /** Сводка категории: entity — слитые ответы всех объектов этого типа. */
  objectNames?: Map<string, string>;
}> = ({ entity, onRatingClick, objectNames }) => {
  const summary = useMemo(() => summarizeAnalytic(entity), [entity]);

  const metricFields = useMemo(
    () => summary.activeFields.filter((f) => f.role !== "identity"),
    [summary.activeFields],
  );

  const [activeKey, setActiveKey] = useState<string>("");
  useEffect(() => {
    setActiveKey(metricFields[0]?.key ?? "");
  }, [entity.id, metricFields]);

  const activeField =
    metricFields.find((f) => f.key === activeKey) ?? metricFields[0];

  const fieldSummaries = useMemo(
    () => summary.activeFields.map((def) => summarizeField(entity.ratings, def)),
    [entity.ratings, summary.activeFields],
  );

  const activeSummary = activeField
    ? fieldSummaries.find((s) => s.def.key === activeField.key)
    : undefined;

  const respondentFilterFields = useMemo(
    () => filterableFieldSummaries(fieldSummaries),
    [fieldSummaries],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-heading text-base font-semibold">{analyticShortName(entity)}</p>
            {objectNames ? (
              <p className="text-xs text-muted-foreground">Сводка по объектам: {objectNames.size}</p>
            ) : (
              entity.transcript.trim() && <p className="text-xs text-muted-foreground">{entity.name}</p>
            )}
          </div>
          <Badge variant="secondary">{analyticTypeLabel(entity.type)}</Badge>
        </div>
        {summary.responses > 0 && (
          <div className="mt-3">
            <p className="text-3xl font-semibold">{summary.headline}</p>
            <p className="text-xs text-muted-foreground">{summary.headlineHint}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {objectNames ? (
            <span>Объектов: {objectNames.size}</span>
          ) : (
            <span>QR: {entity.qr.toString()}</span>
          )}
          <span>Ответов: {summary.responses}</span>

          <span>
            Период:{" "}
            {formatDay(summary.firstAt)} —{" "}
            {formatDay(summary.lastAt)}
          </span>
        </div>
      </Card>

      {summary.responses === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Ответов на этот опрос ещё нет. Ниже — поля, которые появятся в выгрузке.
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
          <Card className="p-4">
            <p className="mb-3 font-heading text-sm font-semibold">
              Краткая статистика по полям
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fieldSummaries
                .filter((s) => s.def.role !== "identity")
                .map((s) => (
                  <FieldStatCard key={s.def.key} summary={s} />
                ))}
            </div>
          </Card>

          {activeField && activeSummary && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {metricFields.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveKey(f.key)}
                    className={cn(
                      "max-w-full break-words rounded-md border px-2.5 py-1 text-left text-xs transition-colors",
                      f.key === activeField.key
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <p className="font-heading text-sm font-semibold">
                {activeField.label}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {activeField.group} · заполнили {activeSummary.answered} из{" "}
                {summary.responses}
              </p>

              <FieldDistributionChart buckets={activeSummary.buckets} />

              <p className="mb-2 mt-4 font-heading text-sm font-semibold">
                Опрошенные
              </p>
              <RespondentsTable
                entity={entity}
                def={activeField}
                filterFields={respondentFilterFields}
                onRowClick={onRatingClick}
                objectNames={objectNames}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export const AnalyticSummaryCard: FC<{
  entity: Analytic;
  onOpen: () => void;
  /** Карточка категории: вместо QR — число объектов. */
  objectsCount?: number;
}> = ({ entity, onOpen, objectsCount }) => {
  const brief = useMemo(() => summarizeAnalytic(entity), [entity]);
  const metrics = brief.activeFields.filter((f) => f.role !== "identity");

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words font-semibold leading-tight" title={entity.name}>
          {analyticShortName(entity)}
        </p>
        <Badge variant="secondary" className="shrink-0">
          {objectsCount !== undefined
            ? `${objectsCount} ${plural(objectsCount, "объект", "объекта", "объектов")}`
            : analyticTypeLabel(entity.type)}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{brief.headline}</span>
        <span className="text-xs text-muted-foreground">
          {brief.responses} {plural(brief.responses, "ответ", "ответа", "ответов")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{brief.headlineHint}</p>

      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
        {objectsCount === undefined && (
          <>
            <span>QR {entity.qr.toString()}</span>
            <span>·</span>
          </>
        )}
        <span>полей в выгрузке: {metrics.length}</span>
        {brief.lastAt && (
          <>
            <span>·</span>
            <span>обновлён {formatDay(brief.lastAt)}</span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-1 inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Подробнее
      </button>
    </div>
  );
};

export const AnalyticReportComponent: FC = () => {
  const report = useAnalyticReport();
  const navigate = useNavigate();
  const categories = useMemo(() => groupByCategory(report.list), [report.list]);

  return (
    <CommonWrapper
      title="Аналитика v3 — выгрузка по полям"
      description="Общая оценка по каждой категории опросов — все объекты одного типа вместе. В подробностях сначала сводка по категории, ниже — каждый объект отдельно."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="Поиск по названию"
          defaultValue={report.search}
          onChange={(e) => report.setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <select
          value={String(report.type)}
          onChange={(e) =>
            report.setType(
              e.target.value === "all"
                ? "all"
                : (Number(e.target.value) as AnalyticType),
            )
          }
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm sm:w-auto"
        >
          <option value="all">Все типы</option>
          {ANALYTIC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <CommonControlState
        isLoading={report.loading}
        isError={report.error}
        isEmpty={report.empty}
        error={
          <CommonServiceError service="аналитики" onRetry={report.retry} />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((group) => (
            <AnalyticSummaryCard
              key={group.type}
              entity={group.merged}
              objectsCount={group.objects.length}
              onOpen={() =>
                navigate(ROUTE.ANALYTICS.REPORT_CATEGORY.replace(":type", String(group.type)))
              }
            />
          ))}
        </div>
      </CommonControlState>
    </CommonWrapper>
  );
};
