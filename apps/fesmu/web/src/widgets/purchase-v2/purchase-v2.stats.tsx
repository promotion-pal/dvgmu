import { useState } from "react";
import type { FC } from "react";
import { BarChart3Icon, Table2Icon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import type { PurchaseV2State } from "./purchase-v2.fn";
import { emptySums, MONEY_STAGES, PurchaseRequestStatus, rub, rubShort, sumOf } from "./purchase-v2.schema";
import type { CuratorStats } from "./purchase-v2.schema";

/** Ticks for which vice-rectors the whole page shows. */
export const PurchaseCuratorFilter: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const { statCurators, curatorShown, toggleCurator, showAllCurators, hiddenCurators } = state;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Проректоры</p>
                <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => showAllCurators(hiddenCurators.length > 0)}
                >
                    {hiddenCurators.length > 0 ? "Выбрать всех" : "Снять всех"}
                </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {statCurators.map(({ curator: c }) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={curatorShown(c.id)} onCheckedChange={() => toggleCurator(c.id)} />
                        <span>{c.name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

const Legend: FC = () => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {MONEY_STAGES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-[3px]", s.color)} />
                {s.label}
            </span>
        ))}
    </div>
);

/** One vice-rector's money as a bar split by stage; widths share one scale. */
const StackedBar: FC<{ row: CuratorStats; max: number }> = ({ row, max }) => {
    const width = max > 0 ? (row.total / max) * 100 : 0;
    return (
        <div className="h-4 w-full">
            {row.total > 0 && (
                <div className="flex h-full gap-[2px] overflow-hidden rounded-r-[4px]" style={{ width: `${Math.max(width, 1)}%` }}>
                    {MONEY_STAGES.filter((s) => row.sums[s.key] > 0).map((s) => (
                        <Tooltip key={s.key}>
                            <TooltipTrigger asChild>
                                <div className={cn("h-full min-w-[3px] cursor-default", s.color)} style={{ flexGrow: row.sums[s.key] }} />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-medium">{row.curator.name}</p>
                                <p>
                                    {s.label}: {rub(row.sums[s.key])} ({Math.round((row.sums[s.key] / row.total) * 100)}%)
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Finance at every stage, total and per vice-rector: tiles, bars, or the table. */
export const PurchaseStats: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const [view, setView] = useState<"chart" | "table">("chart");
    const rows = state.stats;
    const totals = rows.reduce((acc, r) => {
        for (const s of MONEY_STAGES) acc[s.key] += r.sums[s.key];
        return acc;
    }, emptySums());
    const grand = sumOf(totals);
    const rejected = rows.reduce((acc, r) => acc + r.rejected, 0);
    const max = Math.max(0, ...rows.map((r) => r.total));
    const shownCurators = new Set(rows.map((r) => r.curator.id));
    const waiting = (status: PurchaseRequestStatus) =>
        // A request at the head may have no vice-rector yet: it counts regardless of the ticks.
        state.overview.requests.filter((r) => r.status === status && (!r.curatorId || shownCurators.has(r.curatorId))).length;

    return (
        <Card className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-heading text-sm font-semibold">Финансы по этапам</p>
                    <p className="text-xs text-muted-foreground">
                        Стоимость закупки — средняя цена по КП × количество (НМЦК). Заявки до объединения в закупку ещё без цены.
                    </p>
                </div>
                <div className="flex gap-1">
                    <Button size="sm" variant={view === "chart" ? "secondary" : "ghost"} onClick={() => setView("chart")}>
                        <BarChart3Icon className="size-4" /> График
                    </Button>
                    <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}>
                        <Table2Icon className="size-4" /> Таблица
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <Tile label="Заявки у начальников" value={String(waiting(PurchaseRequestStatus.HEAD_REVIEW))} hint="шт., без цены" />
                <Tile label="Заявки у проректоров" value={String(waiting(PurchaseRequestStatus.VICE_RECTOR_REVIEW))} hint="шт., без цены" />
                {MONEY_STAGES.map((s) => (
                    <Tile key={s.key} label={s.label} value={rubShort(totals[s.key])} hint={rub(totals[s.key])} swatch={s.color} />
                ))}
                <Tile label="Отклонено комиссией" value={rubShort(rejected)} hint={rub(rejected)} />
            </div>

            <PurchaseCuratorFilter state={state} />

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Не выбран ни один проректор.</p>
            ) : view === "chart" ? (
                <TooltipProvider delayDuration={100}>
                    <div className="flex flex-col gap-3">
                        <Legend />
                        <div className="grid grid-cols-[minmax(0,22rem)_1fr_auto] items-center gap-x-3 gap-y-2">
                            {rows.map((row) => (
                                <div key={row.curator.id} className="contents">
                                    <span className="truncate text-sm" title={row.curator.name}>
                                        {row.curator.name}
                                    </span>
                                    <StackedBar row={row} max={max} />
                                    <span className="text-right text-sm tabular-nums">{row.total ? rubShort(row.total) : "—"}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-right text-sm">
                            Всего: <span className="font-semibold tabular-nums">{rub(grand)}</span>
                        </p>
                    </div>
                </TooltipProvider>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Проректор</TableHead>
                                <TableHead className="text-right">Закупок</TableHead>
                                <TableHead className="text-right">Заявок ждут</TableHead>
                                {MONEY_STAGES.map((s) => (
                                    <TableHead key={s.key} className="text-right">
                                        {s.label}
                                    </TableHead>
                                ))}
                                <TableHead className="text-right">Итого</TableHead>
                                <TableHead className="text-right">Отклонено</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.curator.id}>
                                    <TableCell className="font-medium">{row.curator.name}</TableCell>
                                    <TableCell className="text-right tabular-nums">{row.lots}</TableCell>
                                    <TableCell className="text-right tabular-nums">{row.requestsWaiting}</TableCell>
                                    {MONEY_STAGES.map((s) => (
                                        <TableCell key={s.key} className="text-right tabular-nums">
                                            {row.sums[s.key] ? rub(row.sums[s.key]) : "—"}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-semibold tabular-nums">{rub(row.total)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{row.rejected ? rub(row.rejected) : "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell>Итого</TableCell>
                                <TableCell className="text-right tabular-nums">{rows.reduce((a, r) => a + r.lots, 0)}</TableCell>
                                <TableCell className="text-right tabular-nums">{rows.reduce((a, r) => a + r.requestsWaiting, 0)}</TableCell>
                                {MONEY_STAGES.map((s) => (
                                    <TableCell key={s.key} className="text-right tabular-nums">
                                        {rub(totals[s.key])}
                                    </TableCell>
                                ))}
                                <TableCell className="text-right tabular-nums">{rub(grand)}</TableCell>
                                <TableCell className="text-right tabular-nums">{rub(rejected)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            )}
        </Card>
    );
};

const Tile: FC<{ label: string; value: string; hint?: string; swatch?: string }> = ({ label, value, hint, swatch }) => (
    <div className="flex flex-col gap-1 rounded-lg border p-3" title={hint}>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {swatch && <span className={cn("size-2.5 shrink-0 rounded-[3px]", swatch)} />}
            <span className="line-clamp-2">{label}</span>
        </span>
        <span className="text-lg font-semibold whitespace-nowrap tabular-nums">{value}</span>
    </div>
);
