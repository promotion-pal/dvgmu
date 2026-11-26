/* eslint-disable react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC} from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BriefcaseIcon, ChartColumnIcon, GraduationCapIcon, ShieldCheckIcon, ToiletIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { analyticShortName } from "@/widgets/analytic/analytic.utils";
import { ROUTE } from "@/shared/config/path";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import {
  CommonFilter,
  CommonFilterDateRange,
  CommonFilterSelect,
  CommonSearchInput,
} from "@/shared/components/filter";
import { FieldDistributionChart } from "@/shared/components/chart";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { AnalyticType } from "@fesmu/contract/analytics/enum/analytic.enum_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

import {
  ANALYTIC_TYPE_OPTIONS,
  analyticTypeLabel,
  useAnalyticReport,
} from "./analytic-report.fn";
import {
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
      if (summary.def.key === "hasSoap") return `Нет мыла: ${Number((100 - summary.truePercent).toFixed(1))}%`;
      return `${Number(summary.truePercent.toFixed(1))}%`;
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

const iconForAnalyticType = (type: AnalyticType) => {
  switch (type) {
    case AnalyticType.WORKPLACE:
      return BriefcaseIcon;
    case AnalyticType.LECTURE:
      return GraduationCapIcon;
    case AnalyticType.TOILET:
      return ToiletIcon;
    case AnalyticType.INFORMATION_SECURITY:
      return ShieldCheckIcon;
    case AnalyticType.TECHNICAL_SUPPLY:
      return WrenchIcon;
    default:
      return ChartColumnIcon;
  }
};

export const AnalyticDetail: FC<{
  entity: Analytic;
  /** Сводка категории: entity — слитые ответы всех объектов этого типа. */
  objectNames?: Map<string, string>;
}> = ({ entity, objectNames }) => {
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
        <Card className="p-6 text-center text-sm text-muted-foreground">Отзывов нет</Card>
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
  /** Показывать значения всех метрик сразу в карточке объекта. */
  showAllFields?: boolean;
}> = ({ entity, onOpen, objectsCount, showAllFields = false }) => {
  const brief = useMemo(() => summarizeAnalytic(entity), [entity]);
  const metrics = brief.activeFields.filter((f) => f.role !== "identity");
  const fieldSummaries = useMemo(
    () => showAllFields ? metrics.map((def) => summarizeField(entity.ratings, def)) : [],
    [showAllFields, entity.ratings, metrics],
  );
  const missingSoapCount = entity.type === AnalyticType.TOILET
    ? entity.ratings.filter((rating) => !rating.hasSoap).length
    : 0;
  const TypeIcon = iconForAnalyticType(entity.type);

  return (
    <div className="relative flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3 pr-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TypeIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 break-words font-semibold leading-tight" title={entity.name}>
          {analyticShortName(entity)}
        </p>
        <Badge variant="secondary" className="shrink-0">
          {objectsCount !== undefined
            ? `${objectsCount} ${plural(objectsCount, "объект", "объекта", "объектов")}`
            : analyticTypeLabel(entity.type)}
        </Badge>
      </div>

      {entity.type === AnalyticType.TOILET && missingSoapCount > 0 && (
        <Badge
          variant="destructive"
          className={cn(
            "h-auto w-fit whitespace-normal py-1 text-left",
            "xl:absolute xl:right-4 xl:top-[4.5rem] xl:max-w-[48%]",
          )}
        >
          ⚠ Нет мыла: {missingSoapCount} {plural(missingSoapCount, "ответ", "ответа", "ответов")}
        </Badge>
      )}

      <div className={cn("flex items-baseline gap-2", missingSoapCount > 0 && "xl:max-w-[48%]")}>
        <span className="text-2xl font-semibold">{brief.headline}</span>
        <span className="text-xs text-muted-foreground">
          {brief.responses} {plural(brief.responses, "ответ", "ответа", "ответов")}
        </span>
      </div>
      <p className={cn("text-xs text-muted-foreground", missingSoapCount > 0 && "xl:max-w-[48%]")}>{brief.headlineHint}</p>
      {showAllFields && fieldSummaries.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {fieldSummaries.map((summary) => (
            <div key={summary.def.key} className="min-w-0 rounded-lg bg-muted/40 p-2.5">
              <p className="truncate text-xs text-muted-foreground" title={summary.def.label}>{summary.def.label}</p>
              <p className="mt-1 break-words text-sm font-semibold">
                {summary.answered ? fieldHeadline(summary) : "Нет данных"}
              </p>
              {summary.def.kind !== "bool" && (
                <p className="mt-0.5 text-xs text-muted-foreground">Ответили: {summary.answered}</p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {objectsCount === undefined && (
          <p className="text-xs text-muted-foreground">QR {entity.qr.toString()}</p>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border px-3 text-sm hover:bg-muted"
        >
          Подробнее
        </button>
      </div>
    </div>
  );
};

export const AnalyticReportComponent: FC = () => {
  const report = useAnalyticReport();
  const navigate = useNavigate();
  const categories = useMemo(() => groupByCategory(report.list), [report.list]);
  const withPeriod = (path: string) => report.periodSearch ? `${path}?${report.periodSearch}` : path;
  const invalidDateRange = Boolean(report.dateFrom && report.dateTo && report.dateFrom > report.dateTo);
  const hasFilters = Boolean(
    report.search ||
    report.type !== "all" ||
    report.dateFrom !== report.defaultDateFrom ||
    report.dateTo !== report.defaultDateTo,
  );

  return (
    <CommonWrapper title="Дашборд аналитики">
      <CommonFilter className="mb-4 w-full p-3 md:items-end">
        <div className="flex w-full flex-col gap-1 sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">Название</span>
          <CommonSearchInput
            value={report.search}
            onChange={report.setSearch}
            placeholder="Поиск по названию"
            className="w-full [&_input]:h-9 [&_input]:w-full [&_input]:py-1.5"
          />
        </div>
        <CommonFilterSelect
          label="Тип"
          value={String(report.type)}
          onChange={(value) => report.setType(value === undefined || value === "all" ? "all" : Number(value) as AnalyticType)}
          allLabel="Все типы"
          options={ANALYTIC_TYPE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
          className="[&_button]:h-9 [&_button]:min-w-36"
        />
        <CommonFilterDateRange
          label="Период"
          from={report.dateFrom || undefined}
          to={report.dateTo || undefined}
          onChange={({ from, to }) => {
            report.setDateRange(from ?? "", to ?? "");
          }}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              report.setSearch("");
              report.setType("all");
              report.setDateRange(report.defaultDateFrom, report.defaultDateTo);
            }}
            className="h-9 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Сбросить
          </button>
        )}
      </CommonFilter>
      {invalidDateRange && (
        <p className="mb-4 text-xs text-destructive">Начало периода должно быть раньше окончания.</p>
      )}

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
              showAllFields
              onOpen={() =>
                navigate(withPeriod(ROUTE.ANALYTICS.REPORT_CATEGORY.replace(":type", String(group.type))))
              }
            />
          ))}
        </div>
      </CommonControlState>
    </CommonWrapper>
  );
};
