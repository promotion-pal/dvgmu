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
import { AnalyticType } from "@fesmu/contract/analytics/enum/analytic.enum_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

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
      if (summary.def.key === "hasSoap") return `Нет мыла: ${100 - summary.truePercent}%`;
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
        return object ? { ...row, objectName: object } : row;
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
        <section className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-2">
            <p className="text-sm font-semibold">Фильтры ответов</p>
            <p className="text-xs text-muted-foreground">Поиск по ФИО, сортировка и отбор по значению поля.</p>
          </div>
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
              aria-label="Сортировка ответов"
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
                aria-label={`Фильтр: ${f.def.label}`}
                className="max-w-full rounded-md border bg-background px-2 py-1.5 text-xs sm:max-w-[200px]"
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
        </section>
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
        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {rows.map((row) => (
            <button
              key={row.ratingId}
              type="button"
              disabled={!onRowClick}
              onClick={() => onRowClick?.(row.ratingId)}
              className={cn(
                "flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left text-sm shadow-xs sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                onRowClick && "hover:bg-muted/70",
                !row.answered && "text-muted-foreground",
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                {row.objectName && (
                  <Badge variant="outline" className="mt-1 h-auto whitespace-normal">
                    Объект: {row.objectName}
                  </Badge>
                )}
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
  const missingSoapCount = entity.type === AnalyticType.TOILET
    ? entity.ratings.filter((rating) => !rating.hasSoap).length
    : 0;

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
      {entity.type === AnalyticType.TOILET && missingSoapCount > 0 && (
        <Badge variant="destructive" className="h-auto w-fit whitespace-normal py-1 text-left">
          ⚠ Нет мыла: {missingSoapCount} {plural(missingSoapCount, "ответ", "ответа", "ответов")}
        </Badge>
      )}

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
  const dashboard = useMemo(() => {
    const summaries = categories.map((group) => ({
      group,
      summary: summarizeAnalytic(group.merged),
    }));
    const responses = summaries.reduce((sum, item) => sum + item.summary.responses, 0);
    const objects = categories.reduce((sum, group) => sum + group.objects.length, 0);
    const lastAt = summaries
      .map(({ summary }) => summary.lastAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return { summaries, responses, objects, lastAt };
  }, [categories]);
  const maxResponses = Math.max(1, ...dashboard.summaries.map(({ summary }) => summary.responses));
  const invalidDateRange = Boolean(report.dateFrom && report.dateTo && report.dateFrom > report.dateTo);

  return (
    <CommonWrapper
      title="Аналитика и контроль"
      description="Сводные показатели по опросам и объектам. Данные обновляются при загрузке; подробности доступны по каждой категории."
    >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Объектов опроса", value: dashboard.objects, hint: "В текущей выборке" },
            { label: "Получено ответов", value: dashboard.responses, hint: "По всем категориям" },
            { label: "Категорий", value: categories.length, hint: "С данными опросов" },
            { label: "Последний ответ", value: formatDay(dashboard.lastAt), hint: "По всем категориям" },
          ].map((item) => (
            <Card key={item.label} className="gap-2 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </Card>
          ))}
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="gap-3 p-4">
            <div>
              <h2 className="font-heading text-base font-semibold">Ответы по категориям</h2>
              <p className="text-xs text-muted-foreground">Количество полученных ответов в каждой категории</p>
            </div>
            {dashboard.summaries.length ? (
              <div className="flex flex-col gap-3">
                {dashboard.summaries.map(({ group, summary }) => (
                  <div key={group.type} className="grid grid-cols-[minmax(110px,180px)_1fr_42px] items-center gap-3">
                    <span className="truncate text-sm" title={group.label}>{group.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(summary.responses / maxResponses) * 100}%` }} />
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums">{summary.responses}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-5 text-center text-sm text-muted-foreground">Пока нет данных для сводки</p>
            )}
          </Card>

          <Card className="gap-3 p-4">
            <h2 className="font-heading text-base font-semibold">Сводка</h2>
            <div className="divide-y">
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Категорий с ответами</span><b>{dashboard.summaries.filter(({ summary }) => summary.responses > 0).length}</b></div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Объектов без ответов за период</span><b>{categories.reduce((sum, group) => sum + group.objects.filter((object) => object.ratings.length === 0).length, 0)}</b></div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Последнее обновление ответов</span><b className="text-right">{formatDay(dashboard.lastAt)}</b></div>
            </div>
          </Card>
        </div>

        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
            С даты
            <Input
              type="date"
              value={report.dateFrom}
              onChange={(e) => report.setDateFrom(e.target.value)}
              aria-label="Начало периода"
              className="w-full sm:w-[160px]"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
            По дату
            <Input
              type="date"
              value={report.dateTo}
              onChange={(e) => report.setDateTo(e.target.value)}
              aria-label="Конец периода"
              className="w-full sm:w-[160px]"
            />
          </label>
          {(report.dateFrom || report.dateTo) && (
            <button
              type="button"
              onClick={() => {
                report.setDateFrom("");
                report.setDateTo("");
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm hover:bg-muted"
            >
              Сбросить даты
            </button>
          )}
      </div>
        <p className={cn("mb-4 text-xs", invalidDateRange ? "text-destructive" : "text-muted-foreground")}>
          {invalidDateRange
            ? "Начало периода должно быть раньше окончания."
            : "Все показатели ниже учитывают поиск, тип и период. Даты ответов включают обе границы."}
        </p>

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
