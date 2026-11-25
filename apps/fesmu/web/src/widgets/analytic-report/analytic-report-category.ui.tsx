import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { create } from "@bufbuild/protobuf";
import { AlertTriangleIcon, ArrowLeftIcon, ChevronRightIcon } from "lucide-react";

import { ROUTE } from "@/shared/config/path";
import { AnalyticQrBatchButton } from "@/widgets/analytic";
import { analyticShortName } from "@/widgets/analytic/analytic.utils";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { AnalyticFetchRequestSchema } from "@fesmu/contract/analytics/service/analytic.service_pb";
import { AnalyticSchema } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import { AnalyticType } from "@fesmu/contract/analytics/enum/analytic.enum_pb";

import { analyticClient, currentWeekDateRange } from "./analytic-report.fn";
import { resolveDate } from "@/widgets/analytic/analytic.lib";
import { mergeCategory, plural, summarizeAnalytic } from "./analytic-report.stats";
import { AnalyticDetail, AnalyticSummaryCard } from "./analytic-report.ui";

/** Категория опросов: сначала общая сводка по всем объектам типа, ниже — каждый объект. */
export const AnalyticCategoryReport: FC = () => {
  const { type: typeParam } = useParams<{ type: string }>();
  const type = Number(typeParam) as AnalyticType;
  const navigate = useNavigate();

  const [objects, setObjects] = useState<Analytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [initialWeek] = useState(currentWeekDateRange);
  const [dateFrom, setDateFrom] = useState(initialWeek.from);
  const [dateTo, setDateTo] = useState(initialWeek.to);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">("week");

  const selectDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    if (preset === "all" || preset === "custom") {
      if (preset === "all") {
        setDateFrom("");
        setDateTo("");
      }
      return;
    }

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (preset === "week") {
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
    } else if (preset === "month") {
      start.setDate(1);
    }
    const toInputValue = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setDateFrom(toInputValue(start));
    setDateTo(toInputValue(today));
  };

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

  const soapIssueObjects = useMemo(() => type === AnalyticType.TOILET
    ? dateFilteredObjects
      .map((object) => ({
        object,
        reports: object.ratings.filter((rating) => !rating.hasSoap).length,
      }))
      .filter((item) => item.reports > 0)
      .sort((a, b) => b.reports - a.reports || analyticShortName(a.object).localeCompare(analyticShortName(b.object), "ru"))
    : [], [type, dateFilteredObjects]);
  const group = useMemo(() => mergeCategory(type, dateFilteredObjects), [type, dateFilteredObjects]);
  const rankedObjects = useMemo(() => dateFilteredObjects.flatMap((object) => {
    const summary = summarizeAnalytic(object);
    const match = summary.headline.match(/^(\d+(?:\.\d+)?)\s*\/\s*5$/);
    return summary.responses > 0 && match
      ? [{ object, score: Number(match[1]), responses: summary.responses }]
      : [];
  }).sort((a, b) => b.score - a.score || b.responses - a.responses || analyticShortName(a.object).localeCompare(analyticShortName(b.object), "ru")), [dateFilteredObjects]);
  const topBestObjects = rankedObjects.slice(0, 5);
  const topWorstObjects = [...rankedObjects].reverse().slice(0, 5);

  return (
    <CommonWrapper
      title={group.label}
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
              <p className="text-sm text-muted-foreground">Период применяется к датам ответов. Неделя считается с понедельника, месяц — с первого числа.</p>
            </div>
            {datePreset !== "all" && <Button variant="ghost" size="sm" onClick={() => selectDatePreset("all")}>Сбросить период</Button>}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" aria-label="Быстрый выбор периода">
              {([
                ["all", "За всё время"],
                ["today", "Сегодня"],
                ["week", "Неделя"],
                ["month", "Месяц"],
                ["custom", "Свой период"],
              ] as const).map(([preset, label]) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={datePreset === preset ? "default" : "outline"}
                  onClick={() => selectDatePreset(preset)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {datePreset === "custom" && (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  С даты
                  <input type="date" value={dateFrom} onChange={(event) => { setDatePreset("custom"); setDateFrom(event.target.value); }} aria-label="Начало периода" className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  По дату
                  <input type="date" value={dateTo} onChange={(event) => { setDatePreset("custom"); setDateTo(event.target.value); }} aria-label="Конец периода" className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground" />
                </label>
              </div>
            )}
          </div>
          {datePreset !== "all" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Выбранный период: {dateFrom ? new Date(`${dateFrom}T00:00:00`).toLocaleDateString("ru-RU") : "без начала"} — {dateTo ? new Date(`${dateTo}T00:00:00`).toLocaleDateString("ru-RU") : "без окончания"}
            </p>
          )}
          {dateFrom && dateTo && dateFrom > dateTo && (
            <p className="mt-2 text-sm text-destructive">Начало периода должно быть раньше окончания.</p>
          )}
        </section>

        <section className="mb-5 grid gap-3 lg:grid-cols-2" aria-label="Лучшие и худшие объекты">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h2 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">Топ лучших</h2>
            {topBestObjects.length ? (
              <div className="flex flex-wrap gap-2">
                {topBestObjects.map(({ object, score, responses }, index) => (
                  <Link
                    key={object.id.toString()}
                    to={`${ROUTE.ANALYTICS.REPORT}/${object.id}`}
                    title={`${analyticShortName(object)} · ${responses} ${plural(responses, "ответ", "ответа", "ответов")}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-950 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
                  >
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{index + 1}</span>
                    <span className="max-w-48 truncate">{analyticShortName(object)}</span>
                    <span className="shrink-0 font-semibold">{score.toFixed(1)} / 5</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">За период пока нет оценок.</p>}
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900 dark:bg-rose-950/20">
            <h2 className="mb-2 text-sm font-semibold text-rose-800 dark:text-rose-300">Топ худших</h2>
            {topWorstObjects.length ? (
              <div className="flex flex-wrap gap-2">
                {topWorstObjects.map(({ object, score, responses }, index) => (
                  <Link
                    key={object.id.toString()}
                    to={`${ROUTE.ANALYTICS.REPORT}/${object.id}`}
                    title={`${analyticShortName(object)} · ${responses} ${plural(responses, "ответ", "ответа", "ответов")}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-950 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-900/60"
                  >
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">{index + 1}</span>
                    <span className="max-w-48 truncate">{analyticShortName(object)}</span>
                    <span className="shrink-0 font-semibold">{score.toFixed(1)} / 5</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">За период пока нет оценок.</p>}
          </div>
        </section>

        {type === AnalyticType.TOILET && soapIssueObjects.length > 0 && (
          <section className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="size-4 shrink-0 text-destructive" />
                <div>
                  <h2 className="font-heading text-sm font-semibold text-destructive">Проблемы с мылом</h2>
                  <p className="text-xs text-muted-foreground">
                    {soapIssueObjects.length} {plural(soapIssueObjects.length, "санузел отмечен", "санузла отмечены", "санузлов отмечено")} из {dateFilteredObjects.length}.
                    {" "}Выберите объект, чтобы открыть его карточку.
                  </p>
                </div>
              </div>
            </header>
            <div className="mt-2 flex flex-col gap-1.5">
              {soapIssueObjects.map(({ object }) => {
                const title = analyticShortName(object);
                return (
                  <Link
                    key={object.id.toString()}
                    to={`${ROUTE.ANALYTICS.REPORT}/${object.id}`}
                    className="group flex min-w-0 items-center gap-2.5 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-destructive/40 hover:bg-destructive/5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={title}>{title}</span>
                      {object.name !== title && <span className="block truncate text-xs text-muted-foreground" title={object.name}>{object.name}</span>}
                      <span className="block text-xs text-destructive">Отмечено отсутствие мыла</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <p className="font-heading text-base font-semibold">Общая сводка</p>
            <AnalyticDetail
              entity={group.merged}
              objectNames={group.objectNames}
            />
          </section>

          <section className="flex flex-col gap-3">
            <p className="font-heading text-base font-semibold">По объектам</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.objects.map((item) => (
                <AnalyticSummaryCard
                  key={item.id.toString()}
                  entity={item}
                  showAllFields
                  onOpen={() => navigate(`${ROUTE.ANALYTICS.REPORT}/${item.id}`)}
                />
              ))}
            </div>
          </section>
        </div>
      </CommonControlState>

    </CommonWrapper>
  );
};
