import { Fragment, useMemo, useState } from "react";
import type { FC } from "react";
import { FileDownIcon } from "lucide-react";
import { toast } from "sonner";
import { Can, useCan } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { exportWordTable } from "@/shared/lib/word-export";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { PurchaseV2State } from "./purchase-v2.fn";
import { FUNDING_LABEL, ITEM_TYPE_LABEL, PLAN_TYPE_LABEL, PurchaseActorRole, PurchaseLotAction, PurchaseLotStatus, PurchasePlanType, qty, rub } from "./purchase-v2.schema";
import type { PurchaseLot } from "./purchase-v2.schema";
import { FIELD_CLASS, Field, LotBadge } from "./purchase-v2.ui";

type Tab = "review" | "plan" | "rejected";

const signer = (l: PurchaseLot, role: PurchaseActorRole) => l.approvals.find((a) => a.role === role)?.name ?? "—";

/** Purchases grouped by vice-rector, in the curators' order. */
const byCurator = (state: PurchaseV2State, lots: PurchaseLot[]) =>
    state.overview.curators
        .map((c) => ({ curator: c, lots: lots.filter((l) => l.curatorId === c.id) }))
        .filter((g) => g.lots.length > 0);

/** "2026-10-14" in local time: a sitting is a local day. */
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const total = (lots: PurchaseLot[]) => lots.reduce((a, l) => a + l.totalAmount, 0);

/** The budget commission's desk: what awaits a decision, and the ПФХД it builds. */
export const PurchaseCommissionBoard: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const nextYear = new Date().getFullYear() + 1;
    // Deciding takes the commission section's right; without it the board is read-only.
    const canDecide = useCan(PermissionSection.PURCHASE_COMMISSION);
    const [tab, setTab] = useState<Tab>("review");
    const [year, setYear] = useState(nextYear);
    const [selected, setSelected] = useState<string[]>([]);
    const [comment, setComment] = useState("");
    const [protocolDate, setProtocolDate] = useState(() => localDay(new Date()));

    const shown = state.overview.lots.filter((l) => state.curatorShown(l.curatorId));
    const review = shown.filter((l) => l.status === PurchaseLotStatus.BUDGET_COMMISSION);
    const approved = shown.filter((l) => l.status === PurchaseLotStatus.APPROVED && l.planYear === year);
    const rejected = shown.filter((l) => l.status === PurchaseLotStatus.REJECTED);
    const years = useMemo(
        () => [...new Set([nextYear, ...state.overview.lots.map((l) => l.planYear).filter(Boolean)])].sort(),
        [state.overview.lots, nextYear],
    );

    const reviewIds = review.map((l) => l.id);
    const picked = selected.filter((id) => reviewIds.includes(id));
    const pickedSum = total(review.filter((l) => picked.includes(l.id)));
    const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleAll = (on: boolean) => setSelected(on ? reviewIds : []);

    const decide = async (action: PurchaseLotAction, planType?: PurchasePlanType) => {
        await state.lotActionMany(picked, action, { comment: comment.trim(), planType, planYear: year });
        setSelected([]);
        setComment("");
    };

    /** The protocol of a sitting: every commission decision taken that day. */
    const exportProtocol = async () => {
        const decisions = state.overview.lots.flatMap((l) =>
            l.logs
                .filter((g) => g.action.startsWith("commission_") && g.createdAt && localDay(g.createdAt) === protocolDate)
                .map((g) => ({ l, g })),
        );
        if (decisions.length === 0) {
            toast.info("В этот день комиссия решений не принимала");
            return;
        }
        const sum = (key: string) => decisions.filter((d) => d.g.action === key).reduce((a, d) => a + d.l.totalAmount, 0);
        const count = (key: string) => decisions.filter((d) => d.g.action === key).length;
        await exportWordTable({
            title: `Протокол заседания бюджетной комиссии от ${protocolDate.split("-").reverse().join(".")}`,
            subtitle: [
                `Рассмотрено закупок: ${decisions.length}`,
                `Включено в ПФХД: ${count("commission_approve")} на ${rub(sum("commission_approve"))}`,
                `Отклонено: ${count("commission_reject")}; возвращено на доработку: ${count("commission_return")}`,
                "Председатель комиссии ____________________   Секретарь ____________________",
            ],
            fileName: `Протокол_БК_${protocolDate}.docx`,
            columns: [
                { header: "Закупка", render: (d) => `#${d.l.id} ${d.l.title}` },
                { header: "Проректор", render: (d) => state.curatorName(d.l.curatorId) },
                { header: "Реализующий отдел", render: (d) => state.departmentName(d.l.implementingDepartment) },
                { header: "НМЦК, ₽", render: (d) => rub(d.l.totalAmount) },
                { header: "Решение", render: (d) => d.g.text },
                { header: "Комментарий", render: (d) => d.g.comment },
            ],
            rows: decisions,
        });
    };

    const exportPlan = async () => {
        const rows = [PurchasePlanType.PLANNED, PurchasePlanType.UNPLANNED].flatMap((type) =>
            byCurator(state, approved.filter((l) => l.planType === type)).flatMap((g) => g.lots.map((l) => ({ l, type, curator: g.curator.name }))),
        );
        if (rows.length === 0) {
            toast.info("В ПФХД на этот год пока ничего нет");
            return;
        }
        await exportWordTable({
            title: `План финансово-хозяйственной деятельности на ${year} год — закупки`,
            subtitle: [
                `Плановые: ${rub(total(approved.filter((l) => l.planType === PurchasePlanType.PLANNED)))}`,
                `Внеплановые: ${rub(total(approved.filter((l) => l.planType === PurchasePlanType.UNPLANNED)))}`,
                `Всего: ${rub(total(approved))}`,
            ],
            fileName: `ПФХД_${year}_закупки.docx`,
            columns: [
                { header: "Тип", render: (r) => PLAN_TYPE_LABEL[r.type] },
                { header: "Проректор", render: (r) => r.curator },
                { header: "Закупка", render: (r) => `#${r.l.id} ${r.l.title}` },
                { header: "Предмет", render: (r) => ITEM_TYPE_LABEL[r.l.itemType] },
                { header: "Кол-во", render: (r) => `${qty(r.l.quantity)} ${r.l.unit}` },
                { header: "ОКПД2 / КТРУ", render: (r) => `${r.l.okpd2} / ${r.l.ktru}` },
                { header: "ОКВЭД2", render: (r) => r.l.okved },
                { header: "Источник", render: (r) => FUNDING_LABEL[r.l.fundingSource] },
                { header: "НМЦК, ₽", render: (r) => rub(r.l.totalAmount) },
            ],
            rows,
        });
    };

    return (
        <Card className="gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1">
                    <TabButton active={tab === "review"} onClick={() => setTab("review")} label="На рассмотрении" count={review.length} />
                    <TabButton active={tab === "plan"} onClick={() => setTab("plan")} label={`ПФХД ${year}`} count={approved.length} />
                    <TabButton active={tab === "rejected"} onClick={() => setTab("rejected")} label="Отклонённые" count={rejected.length} />
                </div>
                <div className="flex items-end gap-2">
                    <Field label="Год ПФХД">
                        <select className={FIELD_CLASS} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {tab === "plan" && (
                        <Button size="sm" variant="outline" onClick={exportPlan}>
                            <FileDownIcon className="size-4" /> Скачать ПФХД (Word)
                        </Button>
                    )}
                    <Field label="Заседание от">
                        <input type="date" className={FIELD_CLASS} value={protocolDate} onChange={(e) => setProtocolDate(e.target.value)} />
                    </Field>
                    <Button size="sm" variant="outline" onClick={exportProtocol}>
                        <FileDownIcon className="size-4" /> Протокол (Word)
                    </Button>
                </div>
            </div>

            {tab === "review" && (
                <>
                    <LotTable
                        state={state}
                        lots={review}
                        select={canDecide ? { selected: picked, toggle, toggleAll } : undefined}
                        empty="Нет закупок, ждущих решения комиссии."
                    />
                    {picked.length > 0 && (
                        <Can section={PermissionSection.PURCHASE_COMMISSION}>
                        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 p-3">
                            <p className="text-sm">
                                Выбрано: <b>{picked.length}</b> на <b className="tabular-nums">{rub(pickedSum)}</b>
                            </p>
                            <textarea
                                className={cn(FIELD_CLASS, "min-h-14")}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Комментарий комиссии (обязателен для отклонения)"
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" disabled={state.busy} onClick={() => decide(PurchaseLotAction.COMMISSION_APPROVE, PurchasePlanType.PLANNED)}>
                                    В ПФХД {year} — плановые
                                </Button>
                                <Button size="sm" variant="secondary" disabled={state.busy} onClick={() => decide(PurchaseLotAction.COMMISSION_APPROVE, PurchasePlanType.UNPLANNED)}>
                                    В ПФХД {year} — внеплановые
                                </Button>
                                <Button size="sm" variant="destructive" disabled={state.busy || !comment.trim()} onClick={() => decide(PurchaseLotAction.COMMISSION_REJECT)}>
                                    Отклонить
                                </Button>
                            </div>
                        </div>
                        </Can>
                    )}
                </>
            )}

            {tab === "plan" && (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <PlanTotal label="Плановые" value={total(approved.filter((l) => l.planType === PurchasePlanType.PLANNED))} />
                        <PlanTotal label="Внеплановые" value={total(approved.filter((l) => l.planType === PurchasePlanType.UNPLANNED))} />
                        <PlanTotal label="Всего в ПФХД" value={total(approved)} strong />
                    </div>
                    {[PurchasePlanType.PLANNED, PurchasePlanType.UNPLANNED].map((type) => (
                        <div key={type} className="flex flex-col gap-2">
                            <p className="font-heading text-sm font-semibold">{type === PurchasePlanType.PLANNED ? "Плановые закупки" : "Внеплановые закупки"}</p>
                            <LotTable state={state} lots={approved.filter((l) => l.planType === type)} empty="Нет." />
                        </div>
                    ))}
                </div>
            )}

            {tab === "rejected" && <LotTable state={state} lots={rejected} empty="Отклонённых нет." />}
        </Card>
    );
};

const TabButton: FC<{ active: boolean; onClick: () => void; label: string; count: number }> = ({ active, onClick, label, count }) => (
    <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick}>
        {label} <span className="text-muted-foreground">{count}</span>
    </Button>
);

const PlanTotal: FC<{ label: string; value: number; strong?: boolean }> = ({ label, value, strong }) => (
    <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("tabular-nums", strong ? "text-lg font-semibold" : "text-base")}>{rub(value)}</p>
    </div>
);

/** Purchases by vice-rector with subtotals; a row opens the purchase below. */
const LotTable: FC<{
    state: PurchaseV2State;
    lots: PurchaseLot[];
    empty: string;
    select?: { selected: string[]; toggle: (id: string) => void; toggleAll: (on: boolean) => void };
}> = ({ state, lots, empty, select }) => {
    if (lots.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
    const groups = byCurator(state, lots);
    // Subtotals sit in the НМЦК column: cells before it, and the five after.
    const before = select ? 3 : 2;
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {select && (
                            <TableHead className="w-8">
                                <Checkbox
                                    checked={select.selected.length === lots.length}
                                    onCheckedChange={(v) => select.toggleAll(Boolean(v))}
                                    aria-label="Выбрать все"
                                />
                            </TableHead>
                        )}
                        <TableHead>Закупка</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                        <TableHead className="text-right">НМЦК</TableHead>
                        <TableHead>ОКПД2 / КТРУ</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Обоснование проректора</TableHead>
                        <TableHead>Согласовали</TableHead>
                        <TableHead>Статус</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groups.map((g) => (
                        <Fragment key={g.curator.id}>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableCell colSpan={before} className="font-medium">
                                    {g.curator.name} <span className="font-normal text-muted-foreground">· {g.lots.length}</span>
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">{rub(total(g.lots))}</TableCell>
                                <TableCell colSpan={5} />
                            </TableRow>
                            {g.lots.map((l) => (
                                <TableRow
                                    key={l.id}
                                    className={cn("cursor-pointer", state.target?.kind === "lot" && state.target.id === l.id && "bg-muted")}
                                    onClick={() => state.setTarget({ kind: "lot", id: l.id })}
                                >
                                    {select && (
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox checked={select.selected.includes(l.id)} onCheckedChange={() => select.toggle(l.id)} />
                                        </TableCell>
                                    )}
                                    <TableCell className="max-w-64">
                                        <p className="truncate font-medium">
                                            #{l.id} {l.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{ITEM_TYPE_LABEL[l.itemType]} · заявок: {l.requestIds.length} · КП: {l.quotations.length}</p>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {qty(l.quantity)} {l.unit}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{rub(l.totalAmount)}</TableCell>
                                    <TableCell className="text-xs">
                                        {l.okpd2 || "—"}
                                        <br />
                                        {l.ktru || "—"}
                                    </TableCell>
                                    <TableCell className="max-w-40 text-xs whitespace-normal">{FUNDING_LABEL[l.fundingSource]}</TableCell>
                                    <TableCell className="max-w-72 text-xs whitespace-normal">
                                        <span className="line-clamp-3">{l.comment || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        Проректор: {signer(l, PurchaseActorRole.VICE_RECTOR)}
                                        <br />
                                        Экономист: {signer(l, PurchaseActorRole.ECONOMIST)}
                                    </TableCell>
                                    <TableCell>
                                        <LotBadge l={l} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </Fragment>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={before}>Итого</TableCell>
                        <TableCell className="text-right tabular-nums">{rub(total(lots))}</TableCell>
                        <TableCell colSpan={5} />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
};
