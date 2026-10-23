import { useState } from "react";
import type { FC } from "react";
import { DownloadIcon, FileCheck2Icon, UploadIcon } from "lucide-react";
import type { PurchaseLot } from "@dvgmu/fesmu/entity/v3/purchase.entity_pb";
import { Button } from "@/shared/ui/button";
import type { DecisionInit, PurchaseV3State } from "./purchase-v3.fn";
import {
    formatDate,
    fromDateInput,
    isActual,
    lotKey,
    PLAN_LABEL,
    PurchaseCommissionDecision,
    PurchaseLotStatus,
    PurchasePermission,
    PurchasePlanType,
    rub,
    rubShort,
} from "./purchase-v3.schema";
import { Field, FIELD_CLASS, LotBadge, Section } from "./purchase-v3.ui";

const DECISION_LABEL: Record<PurchaseCommissionDecision, string> = {
    [PurchaseCommissionDecision.UNSPECIFIED]: "— не рассматривать —",
    [PurchaseCommissionDecision.APPROVE]: "Включить в ПФХД",
    [PurchaseCommissionDecision.REJECT]: "Отклонить",
    [PurchaseCommissionDecision.RETURN]: "Вернуть экономистам",
};

interface Draft {
    decision: PurchaseCommissionDecision;
    planType: PurchasePlanType;
    planYear: number;
    comment: string;
}

/** The meeting: the agenda by vice-rector, a decision on each, one protocol for all. */
const Agenda: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const nextYear = new Date().getFullYear() + 1;
    const [revise, setRevise] = useState(false);
    const agenda = state.lots.filter(
        (l) => l.status === PurchaseLotStatus.BUDGET_COMMISSION || (revise && (l.status === PurchaseLotStatus.REJECTED || l.status === PurchaseLotStatus.APPROVED)),
    );
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const draft = (l: PurchaseLot): Draft =>
        drafts[l.id.toString()] ?? { decision: PurchaseCommissionDecision.UNSPECIFIED, planType: PurchasePlanType.PLANNED, planYear: nextYear, comment: "" };
    const setDraft = (l: PurchaseLot, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [l.id.toString()]: { ...draft(l), ...patch } }));
    const [number, setNumber] = useState("");
    const [heldAt, setHeldAt] = useState(() => new Date().toLocaleDateString("sv-SE"));
    const [chairman, setChairman] = useState("");
    const [secretary, setSecretary] = useState("");
    const [comment, setComment] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const decided = agenda.filter((l) => draft(l).decision !== PurchaseCommissionDecision.UNSPECIFIED);
    const missingComment = decided.some((l) => draft(l).decision !== PurchaseCommissionDecision.APPROVE && !draft(l).comment.trim());
    const byCurator = new Map<string, PurchaseLot[]>();
    for (const l of agenda) {
        const k = l.curatorId.toString();
        byCurator.set(k, [...(byCurator.get(k) ?? []), l]);
    }

    const submit = async () => {
        const decisions: DecisionInit[] = decided.map((l) => {
            const d = draft(l);
            return { lotId: l.id, decision: d.decision, planType: d.planType, planYear: d.planYear, comment: d.comment.trim() };
        });
        const heldDate = fromDateInput(heldAt);
        if (!heldDate) return;
        if (await state.createProtocol({ number: number.trim(), heldAt: heldDate, chairman, secretary, comment, file }, decisions)) {
            setDrafts({});
            setNumber("");
            setComment("");
            setFile(null);
        }
    };

    return (
        <Section
            title={`Повестка бюджетной комиссии (${agenda.length})`}
            action={
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={revise} onChange={(e) => setRevise(e.target.checked)} />
                    Пересмотреть принятые решения
                </label>
            }
        >
            {agenda.length === 0 && <p className="text-sm text-muted-foreground">Закупок на рассмотрении нет.</p>}
            {[...byCurator.entries()].map(([curatorId, list]) => (
                <div key={curatorId} className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">
                        {state.curator(BigInt(curatorId))?.title ?? "—"}{" "}
                        <span className="font-normal text-muted-foreground">· {rub(list.reduce((s, l) => s + l.totalAmount, 0n))}</span>
                    </p>
                    {list.map((l) => {
                        const d = draft(l);
                        return (
                            <div key={l.id.toString()} className="grid gap-2 rounded-lg border p-3 lg:grid-cols-[1fr_200px]">
                                <div className="flex min-w-0 flex-col gap-1">
                                    <button type="button" className="text-left text-sm font-medium hover:underline" onClick={() => state.select(lotKey(l))}>
                                        №{l.id.toString()} {l.title}
                                    </button>
                                    <span className="text-xs text-muted-foreground">
                                        {state.departmentName(l.implementingDepartment)} · {rub(l.totalAmount)}
                                        {l.curatorJustification && ` · «${l.curatorJustification}»`}
                                    </span>
                                    {l.economistComment && <span className="text-xs text-muted-foreground">Экономист: {l.economistComment}</span>}
                                    {l.status !== PurchaseLotStatus.BUDGET_COMMISSION && <LotBadge l={l} />}
                                </div>
                                <select className={FIELD_CLASS} value={d.decision} onChange={(e) => setDraft(l, { decision: Number(e.target.value) })}>
                                    {[PurchaseCommissionDecision.UNSPECIFIED, PurchaseCommissionDecision.APPROVE, PurchaseCommissionDecision.REJECT, PurchaseCommissionDecision.RETURN]
                                        .filter((x) =>
                                            l.status === PurchaseLotStatus.REJECTED
                                                ? x === PurchaseCommissionDecision.UNSPECIFIED || x === PurchaseCommissionDecision.APPROVE
                                                : l.status === PurchaseLotStatus.APPROVED
                                                  ? x === PurchaseCommissionDecision.UNSPECIFIED || x === PurchaseCommissionDecision.REJECT
                                                  : true,
                                        )
                                        .map((x) => (
                                            <option key={x} value={x}>
                                                {DECISION_LABEL[x]}
                                            </option>
                                        ))}
                                </select>
                                {d.decision !== PurchaseCommissionDecision.UNSPECIFIED && (
                                    <div className="grid gap-2 sm:grid-cols-[150px_100px_1fr] lg:col-span-2">
                                        {d.decision === PurchaseCommissionDecision.APPROVE && (
                                            <>
                                                <select className={FIELD_CLASS} value={d.planType} onChange={(e) => setDraft(l, { planType: Number(e.target.value) })}>
                                                    <option value={PurchasePlanType.PLANNED}>Плановая</option>
                                                    <option value={PurchasePlanType.UNPLANNED}>Внеплановая</option>
                                                </select>
                                                <input
                                                    className={FIELD_CLASS}
                                                    type="number"
                                                    value={d.planYear}
                                                    onChange={(e) => setDraft(l, { planYear: Number(e.target.value) })}
                                                    aria-label="Год ПФХД"
                                                />
                                            </>
                                        )}
                                        <input
                                            className={`${FIELD_CLASS} ${d.decision === PurchaseCommissionDecision.APPROVE ? "" : "sm:col-span-3"}`}
                                            placeholder={d.decision === PurchaseCommissionDecision.APPROVE ? "Комментарий" : "Причина *"}
                                            value={d.comment}
                                            onChange={(e) => setDraft(l, { comment: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
            {decided.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-semibold">Протокол заседания — решений: {decided.length}</p>
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Field label="Номер *">
                            <input className={FIELD_CLASS} value={number} onChange={(e) => setNumber(e.target.value)} />
                        </Field>
                        <Field label="Дата заседания *">
                            <input type="date" className={FIELD_CLASS} value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
                        </Field>
                        <Field label="Председатель">
                            <input className={FIELD_CLASS} value={chairman} onChange={(e) => setChairman(e.target.value)} />
                        </Field>
                        <Field label="Секретарь">
                            <input className={FIELD_CLASS} value={secretary} onChange={(e) => setSecretary(e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Комментарий">
                        <textarea className={FIELD_CLASS} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            Подписанный протокол (можно позже):
                            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <Button disabled={state.busy || !number.trim() || !heldAt || missingComment} onClick={submit}>
                            <FileCheck2Icon className="size-4" /> Оформить протокол
                        </Button>
                    </div>
                    {missingComment && <p className="text-xs text-red-600">Укажите причину для каждого отклонения и возврата.</p>}
                </div>
            )}
        </Section>
    );
};

const Protocols: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const commission = state.can(PurchasePermission.LOT_COMMISSION);
    if (state.protocols.length === 0) return null;
    return (
        <Section title="Протоколы">
            {state.protocols.map((p) => {
                const approved = p.decisions.filter((d) => d.decision === PurchaseCommissionDecision.APPROVE);
                return (
                    <details key={p.id.toString()} className="rounded-lg border p-3">
                        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-medium">
                                № {p.number} от {formatDate(p.heldAt)}
                            </span>
                            <span className="text-muted-foreground">
                                решений {p.decisions.length}, включено {approved.length} на {rub(approved.reduce((s, d) => s + d.amount, 0n))}
                            </span>
                            {p.fileSize > 0n && (
                                <Button size="sm" variant="ghost" onClick={(e) => (e.preventDefault(), state.downloadProtocol(p))}>
                                    <DownloadIcon className="size-4" /> Файл
                                </Button>
                            )}
                            {commission && (
                                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary" onClick={(e) => e.stopPropagation()}>
                                    <UploadIcon className="size-3.5" /> {p.fileSize > 0n ? "Заменить файл" : "Загрузить подписанный"}
                                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && state.uploadProtocolFile(p, e.target.files[0])} />
                                </label>
                            )}
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1 text-sm">
                            {p.decisions.map((d) => (
                                <li key={d.lotId.toString()} className="flex flex-wrap gap-x-2">
                                    <button type="button" className="hover:underline" onClick={() => state.select(`l${d.lotId}`)}>
                                        №{d.lotId.toString()} {d.lotTitle}
                                    </button>
                                    <span className="text-muted-foreground">
                                        — {DECISION_LABEL[d.decision].toLowerCase()}
                                        {d.decision === PurchaseCommissionDecision.APPROVE && `, ${PLAN_LABEL[d.planType].toLowerCase()} ${d.planYear}`}, {rub(d.amount)}
                                        {d.comment && ` · ${d.comment}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {(p.chairman || p.secretary || p.comment) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                {p.chairman && `Председатель: ${p.chairman}. `}
                                {p.secretary && `Секретарь: ${p.secretary}. `}
                                {p.comment}
                            </p>
                        )}
                    </details>
                );
            })}
        </Section>
    );
};

/** ПФХД: approved purchases by plan year, planned and unplanned. */
const Plan: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const inPlan = state.lots.filter((l) => l.planYear > 0 && l.status !== PurchaseLotStatus.REJECTED && isActual(l));
    const years = [...new Set(inPlan.map((l) => l.planYear))].sort();
    if (years.length === 0) return null;
    return (
        <Section title="ПФХД">
            {years.map((y) => {
                const list = inPlan.filter((l) => l.planYear === y);
                const sum = (t: PurchasePlanType) => list.filter((l) => l.planType === t).reduce((s, l) => s + l.totalAmount, 0n);
                return (
                    <div key={y} className="flex flex-col gap-1 text-sm">
                        <p className="font-semibold">
                            {y}: {rub(sum(PurchasePlanType.PLANNED) + sum(PurchasePlanType.UNPLANNED))}{" "}
                            <span className="font-normal text-muted-foreground">
                                (плановые {rubShort(sum(PurchasePlanType.PLANNED))}, внеплановые {rubShort(sum(PurchasePlanType.UNPLANNED))})
                            </span>
                        </p>
                        {list.map((l) => (
                            <button key={l.id.toString()} type="button" className="flex justify-between gap-2 text-left hover:underline" onClick={() => state.select(lotKey(l))}>
                                <span>
                                    №{l.id.toString()} {l.title} <span className="text-xs text-muted-foreground">· {PLAN_LABEL[l.planType].toLowerCase()} · {state.curatorName(l.curatorId)}</span>
                                </span>
                                <span className="tabular-nums">{rub(l.totalAmount)}</span>
                            </button>
                        ))}
                    </div>
                );
            })}
        </Section>
    );
};

export const CommissionView: FC<{ state: PurchaseV3State }> = ({ state }) => (
    <div className="flex flex-col gap-4">
        {state.can(PurchasePermission.LOT_COMMISSION) && <Agenda state={state} />}
        <Protocols state={state} />
        <Plan state={state} />
    </div>
);
