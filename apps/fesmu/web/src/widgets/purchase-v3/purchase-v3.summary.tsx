import { useState } from "react";
import { ChevronRightIcon, ClockIcon } from "lucide-react";
import type { FC } from "react";
import type { PurchaseLot } from "@fesmu/contract/entity/v3/purchase.entity_pb";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import type { PurchaseV3State } from "./purchase-v3.fn";
import { isOverdue, LOT_STAGES, lotKey, lotStage, nearestDue, PurchaseLotStatus, rub, rubShort } from "./purchase-v3.schema";
import { LotBadge, Section, TermChip } from "./purchase-v3.ui";
import { CodeTree } from "./purchase-v3.codes";
import type { CodeMode } from "./purchase-v3.codes";

type Bucket = "planning" | "commission" | "preparation" | "execution" | "completed";

const BUCKETS: { key: Bucket; label: string; color: string }[] = [
    { key: "planning", label: "Планирование", color: "bg-[#2a78d6] dark:bg-[#3987e5]" },
    { key: "commission", label: "На комиссии", color: "bg-[#eda100] dark:bg-[#c98500]" },
    { key: "preparation", label: "Подготовка (ТЗ, стоимость)", color: "bg-[#eb6834] dark:bg-[#d95926]" },
    { key: "execution", label: "Исполнение", color: "bg-[#1baf7a] dark:bg-[#199e70]" },
    { key: "completed", label: "Завершены", color: "bg-[#008300] dark:bg-[#008300]" },
];

const bucketOf = (l: PurchaseLot): Bucket | undefined => {
    if (l.status === PurchaseLotStatus.REJECTED) return undefined;
    if (l.status === PurchaseLotStatus.COMPLETED) return "completed";
    if (l.status === PurchaseLotStatus.BUDGET_COMMISSION) return "commission";
    const phase = LOT_STAGES[lotStage(l.status)]?.phase;
    return phase === 1 ? "planning" : phase === 2 ? "preparation" : "execution";
};

const total = (list: PurchaseLot[]) => list.reduce((s, l) => s + l.totalAmount, 0n);

type Sort = "due" | "amount" | "id";

type Group = "curator" | "implementing" | "customer" | CodeMode | "none";

const GROUP_LABEL: Record<Group, string> = {
    curator: "По проректорам",
    implementing: "По реализующим отделам",
    customer: "По отделам-заказчикам",
    okpd2: "По кодам ОКПД2",
    ktru: "По кодам КТРУ",
    none: "Без группировки",
};

/** Where the money and the time are: by stage, by vice-rector, every purchase
 *  with its terms. Follows the filters above. */
export const SummaryView: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const lots = state.filteredLots;
    const [bucket, setBucket] = useState<Bucket>();
    const [sort, setSort] = useState<Sort>("due");
    const [group, setGroup] = useState<Group>("curator");
    const [collapsed, setCollapsed] = useState<string[]>([]);
    /** The departments whose requests went into the purchase. */
    const customerDeps = (l: PurchaseLot) => [...new Set(l.requestIds.map((id) => state.requestById(id)?.department).filter((d): d is number => Boolean(d)))];
    const customers = (l: PurchaseLot) => {
        const deps = customerDeps(l).filter((d) => d !== l.implementingDepartment);
        return deps.map((d) => state.departmentName(d)).join(", ");
    };
    const live = lots.filter((l) => bucketOf(l));
    const overdue = live.filter((l) => l.status !== PurchaseLotStatus.COMPLETED && isOverdue(l));
    const shown = (bucket ? lots.filter((l) => bucketOf(l) === bucket) : lots).slice().sort((a, b) => {
        if (sort === "amount") return Number(b.totalAmount - a.totalAmount);
        if (sort === "id") return Number(b.id - a.id);
        const x = nearestDue(a)?.seconds ?? 1n << 40n;
        const y = nearestDue(b)?.seconds ?? 1n << 40n;
        return x < y ? -1 : x > y ? 1 : 0;
    });
    const groups: { key: string; name: string; lots: PurchaseLot[] }[] = [];
    for (const l of shown) {
        const keys: [string, string][] =
            group === "curator"
                ? [[`c${l.curatorId}`, state.curator(l.curatorId)?.title ?? "Без направления"]]
                : group === "implementing"
                  ? [[`d${l.implementingDepartment}`, state.departmentName(l.implementingDepartment)]]
                  : group === "customer"
                    ? [[`d${customerDeps(l)[0] ?? 0}`, customerDeps(l)[0] ? state.departmentName(customerDeps(l)[0]) : "Заказчик не указан"]]
                    : [["all", ""]];
        for (const [key, name] of keys) {
            const g = groups.find((x) => x.key === key);
            if (g) g.lots.push(l);
            else groups.push({ key, name, lots: [l] });
        }
    }
    if (group !== "none") groups.sort((a, b) => Number(total(b.lots) - total(a.lots)));
    const curatorIds = [...new Set(live.map((l) => l.curatorId))];
    const max = curatorIds.reduce((m, id) => {
        const v = total(live.filter((l) => l.curatorId === id));
        return v > m ? v : m;
    }, 1n);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <Card className="gap-1 p-4">
                    <span className="text-xs text-muted-foreground">Всего в работе</span>
                    <span className="text-lg font-semibold tabular-nums">{rubShort(total(live))}</span>
                    <span className="text-xs text-muted-foreground">закупок: {live.length}</span>
                </Card>
                <button
                    type="button"
                    onClick={() => state.setFilters({ overdueOnly: !state.filters.overdueOnly })}
                    title={state.filters.overdueOnly ? "Показать все" : "Показать только просроченные"}
                    className={cn(
                        "flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50",
                        state.filters.overdueOnly && "border-red-400 bg-red-50/60 dark:border-red-800 dark:bg-red-950/40",
                    )}
                >
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ClockIcon className="size-3.5 text-red-600" />
                        Просрочено
                    </span>
                    <span className={cn("text-lg font-semibold tabular-nums", overdue.length > 0 && "text-red-600 dark:text-red-400")}>{rubShort(total(overdue))}</span>
                    <span className="text-xs text-muted-foreground">
                        {state.filters.overdueOnly ? "показаны только они" : `закупок: ${overdue.length}`}
                    </span>
                </button>
                {BUCKETS.map((b) => {
                    const list = lots.filter((l) => bucketOf(l) === b.key);
                    return (
                        <button
                            key={b.key}
                            type="button"
                            onClick={() => setBucket(bucket === b.key ? undefined : b.key)}
                            className={cn("flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50", bucket === b.key && "border-primary bg-muted/50")}
                        >
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={`size-2.5 shrink-0 rounded-sm ${b.color}`} />
                                {b.label}
                            </span>
                            <span className="text-lg font-semibold tabular-nums">{rubShort(total(list))}</span>
                            <span className="text-xs text-muted-foreground">закупок: {list.length}</span>
                        </button>
                    );
                })}
            </div>

            {curatorIds.length > 0 && (
                <Section title="По проректорам">
                    {curatorIds.map((id) => {
                        const mine = live.filter((l) => l.curatorId === id);
                        const sum = total(mine);
                        return (
                            <div key={id.toString()} className="flex flex-col gap-1">
                                <div className="flex flex-wrap justify-between gap-x-2 text-sm">
                                    <span>{state.curator(id)?.title ?? "—"}</span>
                                    <span className="tabular-nums">
                                        {rub(sum)} <span className="text-xs text-muted-foreground">· {mine.length} шт.</span>
                                    </span>
                                </div>
                                <div className="flex h-2.5 overflow-hidden rounded-sm bg-muted" style={{ width: `${Math.max(2, Number((sum * 100n) / max))}%` }}>
                                    {BUCKETS.map((b) => {
                                        const v = total(mine.filter((l) => bucketOf(l) === b.key));
                                        return v > 0n ? <span key={b.key} className={b.color} style={{ flexGrow: Number(v) }} title={`${b.label}: ${rub(v)}`} /> : null;
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {BUCKETS.map((b) => (
                            <span key={b.key} className="flex items-center gap-1.5">
                                <span className={`size-2.5 rounded-sm ${b.color}`} /> {b.label}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            <Section
                title={`Закупки${bucket ? ` — ${BUCKETS.find((b) => b.key === bucket)?.label.toLowerCase()}` : ""} (${shown.length})`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <select className="rounded-lg border bg-background px-2 py-1 text-xs" value={group} onChange={(e) => setGroup(e.target.value as Group)} aria-label="Группировка">
                            {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
                                <option key={g} value={g}>
                                    {GROUP_LABEL[g]}
                                </option>
                            ))}
                        </select>
                        <select className="rounded-lg border bg-background px-2 py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
                            <option value="due">Сначала срочные</option>
                            <option value="amount">Сначала дорогие</option>
                            <option value="id">Сначала новые</option>
                        </select>
                    </div>
                }
            >
                {shown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Под фильтр ничего не подходит.</p>
                ) : group === "okpd2" || group === "ktru" ? (
                    <CodeTree state={state} lots={shown} mode={group} wide />
                ) : (
                    <div className="-mx-4 overflow-x-auto px-4">
                        <table className="w-full min-w-180 text-sm">
                            <thead className="text-left text-xs text-muted-foreground">
                                <tr>
                                    <th className="py-1.5 pr-3 font-medium">Закупка</th>
                                    <th className="py-1.5 pr-3 font-medium">{group === "curator" ? "Отдел" : group === "none" ? "Отдел · направление" : "Направление"}</th>
                                    <th className="py-1.5 pr-3 font-medium">Этап</th>
                                    <th className="py-1.5 pr-3 font-medium">Сроки</th>
                                    <th className="py-1.5 text-right font-medium">Сумма</th>
                                </tr>
                            </thead>
                            {groups.map((g) => {
                                const folded = collapsed.includes(g.key);
                                const late = g.lots.filter((l) => l.status !== PurchaseLotStatus.COMPLETED && isOverdue(l)).length;
                                return (
                                    <tbody key={g.key}>
                                        {group !== "none" && (
                                            <tr
                                                className="cursor-pointer border-t bg-muted/40 hover:bg-muted/70"
                                                onClick={() => setCollapsed((c) => (folded ? c.filter((k) => k !== g.key) : [...c, g.key]))}
                                            >
                                                <td colSpan={4} className="py-2 pr-3">
                                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                                                        <ChevronRightIcon className={cn("size-4 transition-transform", !folded && "rotate-90")} />
                                                        {g.name}
                                                        <span className="text-xs font-normal text-muted-foreground">· {g.lots.length} шт.</span>
                                                        {late > 0 && <span className="text-xs font-normal text-red-600 dark:text-red-400">· просрочено {late}</span>}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-right font-medium whitespace-nowrap tabular-nums">{rub(total(g.lots))}</td>
                                            </tr>
                                        )}
                                        {!folded &&
                                            g.lots.map((l) => (
                                                <tr key={l.id.toString()} className="cursor-pointer border-t align-top hover:bg-muted/50" onClick={() => state.select(lotKey(l))}>
                                                    <td className={cn("py-2 pr-3", group !== "none" && "pl-6")}>
                                                        <span className="text-xs text-muted-foreground">№{l.id.toString()} </span>
                                                        <span className="line-clamp-2">{l.title}</span>
                                                    </td>
                                                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                                                        {group !== "curator" && group !== "none" ? (
                                                            state.curatorName(l.curatorId)
                                                        ) : (
                                                            <>
                                                                {state.departmentName(l.implementingDepartment)}
                                                                {customers(l) && <span className="block">заказчик: {customers(l)}</span>}
                                                                {group === "none" && <span className="block">{state.curatorName(l.curatorId)}</span>}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <LotBadge l={l} />
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        {l.status !== PurchaseLotStatus.COMPLETED && (
                                                            <span className="flex flex-col items-start gap-1">
                                                                <TermChip label="этап" due={l.stageDue} />
                                                                <TermChip label="закупка" due={l.dueAt} />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 text-right whitespace-nowrap tabular-nums">{rub(l.totalAmount)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                )}
            </Section>
        </div>
    );
};
