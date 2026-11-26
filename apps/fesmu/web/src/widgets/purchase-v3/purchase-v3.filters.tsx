import { useState } from "react";
import type { FC } from "react";
import { FilterIcon, XIcon } from "lucide-react";
import { CommonSearchInput } from "@/shared/components/filter";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import type { PurchaseFilters, PurchaseV3State } from "./purchase-v3.fn";
import { LOT_STAGES, PHASE_LABEL, PurchaseItemType, PurchaseLotStatus, PurchaseRequestStatus, REQUEST_STATUS } from "./purchase-v3.schema";
import { FIELD_CLASS } from "./purchase-v3.ui";

const SELECT = cn(FIELD_CLASS, "w-full sm:w-auto sm:max-w-56");

const REQUEST_STATUSES = [
    PurchaseRequestStatus.HEAD_REVIEW,
    PurchaseRequestStatus.REWORK,
    PurchaseRequestStatus.CURATOR_REVIEW,
    PurchaseRequestStatus.IMPLEMENTER_REVIEW,
    PurchaseRequestStatus.IN_PURCHASE,
    PurchaseRequestStatus.MERGED,
    PurchaseRequestStatus.REJECTED,
];

/** One filter bar for tasks, requests, purchases and the summary. On a phone
 *  it folds behind «Фильтры». */
export const PurchaseFilterBar: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const [open, setOpen] = useState(false);
    const { filters: f, setFilters } = state;
    const set = (patch: Partial<PurchaseFilters>) => setFilters(patch);
    // Only the departments that occur, so the list stays short.
    const departments = [
        ...new Set([...state.requests.flatMap((r) => [r.department, r.implementingDepartment]), ...state.lots.map((l) => l.implementingDepartment)]),
    ]
        .filter(Boolean)
        .map((d) => ({ d, name: state.departmentName(d) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const curators = state.overview?.curators ?? [];

    return (
        <Card className="gap-2 p-3">
            <div className="flex items-center gap-2">
                <CommonSearchInput className="min-w-0 flex-1 [&_input]:w-full" value={state.search} onChange={state.setSearch} placeholder="Поиск: название, №, отдел, поставщик" />
                <Button size="sm" variant="outline" className="shrink-0 sm:hidden" onClick={() => setOpen((o) => !o)}>
                    <FilterIcon className="size-4" /> Фильтры{state.activeFilters > 0 && ` (${state.activeFilters})`}
                </Button>
                {state.activeFilters > 0 && (
                    <Button size="sm" variant="ghost" className="hidden shrink-0 sm:inline-flex" onClick={state.resetFilters}>
                        <XIcon className="size-4" /> Сбросить ({state.activeFilters})
                    </Button>
                )}
            </div>
            {state.view !== "summary" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Вид закупок:</span>
                    <div className="flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Вид закупок">
                        {(
                            [
                                ["cards", "Карточками"],
                                ["list", "Списком"],
                                ["okpd2", "По кодам ОКПД2"],
                                ["ktru", "По кодам КТРУ"],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    state.setLotLayout(key);
                                    // The code layout lists purchases: it opens their tab.
                                    if (key === "okpd2" || key === "ktru") state.setView("lots");
                                }}
                                className={cn(
                                    "rounded-md px-3 py-1",
                                    (state.view === "lots" ? state.lotLayout === key : key === "cards")
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className={cn("flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center", open ? "flex" : "hidden")}>
                {curators.length > 0 && (
                    <select className={SELECT} value={f.curatorId} onChange={(e) => set({ curatorId: e.target.value })} aria-label="Направление">
                        <option value="">Все направления</option>
                        {curators.map((c) => (
                            <option key={c.id.toString()} value={c.id.toString()}>
                                {c.title}
                            </option>
                        ))}
                    </select>
                )}
                {departments.length > 1 && (
                    <select className={SELECT} value={f.department} onChange={(e) => set({ department: Number(e.target.value) })} aria-label="Отдел">
                        <option value={0}>Все отделы</option>
                        {departments.map(({ d, name }) => (
                            <option key={d} value={d}>
                                {name}
                            </option>
                        ))}
                    </select>
                )}
                <select className={SELECT} value={f.itemType} onChange={(e) => set({ itemType: Number(e.target.value) })} aria-label="Тип">
                    <option value={0}>Товары и услуги</option>
                    <option value={PurchaseItemType.PRODUCT}>Товары</option>
                    <option value={PurchaseItemType.SERVICE}>Услуги</option>
                </select>
                <select className={SELECT} value={f.phase} onChange={(e) => set({ phase: Number(e.target.value) as PurchaseFilters["phase"], status: "" })} aria-label="Стадия">
                    <option value={0}>Все стадии</option>
                    {([1, 2, 3] as const).map((p) => (
                        <option key={p} value={p}>
                            {PHASE_LABEL[p]}
                        </option>
                    ))}
                </select>
                {state.view === "lots" && (
                    <>
                        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">Сумма от, ₽
                            <input className={cn(FIELD_CLASS, "w-32")} type="text" inputMode="decimal" placeholder="0,00" value={f.minAmount} onChange={(e) => set({ minAmount: e.target.value })} aria-label="Сумма от" />
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">до, ₽
                            <input className={cn(FIELD_CLASS, "w-32")} type="text" inputMode="decimal" placeholder="0,00" value={f.maxAmount} onChange={(e) => set({ maxAmount: e.target.value })} aria-label="Сумма до" />
                        </label>
                    </>
                )}
                <select className={SELECT} value={f.status} onChange={(e) => set({ status: e.target.value, ...(e.target.value === `l${PurchaseLotStatus.RESERVED}` ? { phase: 0 } : {}) })} aria-label="Этап">
                    <option value="">Все этапы</option>
                    <optgroup label="Заявки">
                        {REQUEST_STATUSES.map((s) => (
                            <option key={s} value={`r${s}`}>
                                {REQUEST_STATUS[s].label}
                            </option>
                        ))}
                    </optgroup>
                    <optgroup label="Закупки">
                        {LOT_STAGES.filter((s) => f.phase === 0 || s.phase === f.phase).map((s) => (
                            <option key={s.status} value={`l${s.status}`}>
                                {s.label}
                            </option>
                        ))}
                        <option value={`l${PurchaseLotStatus.REJECTED}`}>Отклонена комиссией</option>
                        <option value={`l${PurchaseLotStatus.COMPLETED}`}>Завершена</option>
                        <option value={`l${PurchaseLotStatus.RESERVED}`}>Резервная закупка</option>
                    </optgroup>
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <Checkbox checked={f.overdueOnly} onCheckedChange={(v) => set({ overdueOnly: Boolean(v) })} /> Только просроченные
                </label>
                {state.lots.some((l) => l.reviewNote) && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <Checkbox checked={f.reviewOnly} onCheckedChange={(v) => set({ reviewOnly: Boolean(v) })} /> Требуют проверки (
                        {state.lots.filter((l) => l.reviewNote).length})
                    </label>
                )}
                {state.activeFilters > 0 && (
                    <Button size="sm" variant="ghost" className="sm:hidden" onClick={state.resetFilters}>
                        <XIcon className="size-4" /> Сбросить
                    </Button>
                )}
            </div>
        </Card>
    );
};
