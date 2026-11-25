import { useEffect, useState } from "react";
import type { FC } from "react";
import { ExternalLinkIcon, FileDownIcon, SparklesIcon, TrashIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Can, useCan } from "@/features/access";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { purchaseV2Api } from "./purchase-v2.api";
import type { PurchaseV2State } from "./purchase-v2.fn";
import {
    ACTOR_LABEL,
    formatDateTime,
    FUNDING_LABEL,
    ITEM_TYPE_LABEL,
    ktruSearchUrl,
    lotForm,
    ROLE_SECTION,
    NMCK_UNIFORM_MAX,
    nmckCalc,
    rubInput,
    lotStep,
    parseQty,
    parseRub,
    PLAN_TYPE_LABEL,
    PurchaseActorRole,
    PurchaseFundingSource,
    PurchaseLotAction,
    PurchaseLotStatus,
    PurchasePlanType,
    qty,
    rub,
} from "./purchase-v2.schema";
import type { PurchaseEmployee, PurchaseLot, PurchaseLotForm, PurchaseQuotationForm } from "./purchase-v2.schema";
import { FIELD_CLASS, Field, LotBadge, PurchaseApprovals, PurchaseLogList, PurchaseTimeline, Section, StageActions } from "./purchase-v2.ui";
import type { StageButton } from "./purchase-v2.ui";

const FUNDING_OPTIONS = [
    PurchaseFundingSource.STATE_TASK,
    PurchaseFundingSource.TARGET_SUBSIDY,
    PurchaseFundingSource.INCOME,
    PurchaseFundingSource.OMS,
];

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`);

/** Who may do what with a purchase at its stage, for the acting role. */
const lotAccess = (state: PurchaseV2State, lot: PurchaseLot, canAct: boolean) => {
    const { actor, me } = state;
    const role = actor.role;
    const st = lot.status;
    const implHead = canAct && role === PurchaseActorRole.DEPT_HEAD && state.inMyDepartment(lot.implementingDepartment);
    const assignee =
        canAct && role === PurchaseActorRole.EMPLOYEE && st === PurchaseLotStatus.SPECIFICATION && (me.admin || lot.assigneeUuid === me.uuid);
    const headStage = implHead && (st === PurchaseLotStatus.FORMING || st === PurchaseLotStatus.IMPLEMENTER_CHECK);
    return {
        implHead,
        assignee,
        /** Composition: the implementing head while forming. */
        requests: implHead && st === PurchaseLotStatus.FORMING,
        /** Name, characteristics, quantity, offers. */
        content: headStage || assignee,
        vrComment: canAct && role === PurchaseActorRole.VICE_RECTOR && st === PurchaseLotStatus.VICE_RECTOR_REVIEW && state.isMyCurator(lot.curatorId),
        economist: canAct && role === PurchaseActorRole.ECONOMIST && st === PurchaseLotStatus.ECONOMIST_REVIEW,
        // Under review the decision itself carries type and year; afterwards they can be changed here.
        commission: canAct && role === PurchaseActorRole.BUDGET_COMMISSION && st === PurchaseLotStatus.APPROVED,
    };
};

export const PurchaseLotDetail: FC<{ state: PurchaseV2State; lot: PurchaseLot }> = ({ state, lot }) => {
    const role = state.actor.role;
    // Editing at a stage takes the right to change that role's section.
    const canAct = useCan(ROLE_SECTION[role]);
    const access = lotAccess(state, lot, canAct);

    // Reset the form whenever the purchase changes on the server.
    const formKey = `${lot.id}:${lot.logs.length}`;

    return (
        <>
            <LotSummary state={state} lot={lot} />
            <LotRequests state={state} lot={lot} editable={access.requests} />
            <LotQuotations state={state} lot={lot} editable={access.content} />
            {(access.content || access.vrComment || access.economist || access.commission) && (
                <Can section={ROLE_SECTION[role]}>
                    <LotEditor key={formKey} state={state} lot={lot} role={role} />
                </Can>
            )}
            <Can section={ROLE_SECTION[role]}>
                <LotStage key={`stage-${formKey}`} state={state} lot={lot} />
            </Can>
            <Section title="История закупки">
                <PurchaseLogList logs={lot.logs} />
            </Section>
            <Section title="Этапы">
                <PurchaseTimeline current={lotStep(lot)} />
            </Section>
        </>
    );
};

/* ───────────── summary ───────────── */

const LotSummary: FC<{ state: PurchaseV2State; lot: PurchaseLot }> = ({ state, lot }) => {
    // The department heads who approved the requests inside, for "who approved before".
    const heads = lot.requestIds
        .map(state.requestById)
        .flatMap((r) => (r ? r.approvals.filter((a) => a.role === PurchaseActorRole.DEPT_HEAD).map((a) => ({ ...a, request: r.id })) : []));

    return (
        <Card className="gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-heading text-base font-semibold">
                        Закупка #{lot.id}: {lot.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {ITEM_TYPE_LABEL[lot.itemType]} · реализует {state.departmentName(lot.implementingDepartment)} · {state.curatorName(lot.curatorId)}
                        {lot.assigneeName && ` · исполнитель ${lot.assigneeName}`} · сформировал {lot.createdBy} · {formatDateTime(lot.createdAt)}
                    </p>
                </div>
                <LotBadge l={lot} />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Количество" value={`${qty(lot.quantity)} ${lot.unit}`} />
                <Metric label="Цена за ед. (средняя по КП)" value={lot.unitPrice ? rub(lot.unitPrice) : "—"} />
                <Metric label="Минимальная цена КП" value={lot.minUnitPrice ? rub(lot.minUnitPrice) : "—"} />
                <Metric
                    label={lot.nmck ? "НМЦК (утвердил экономист)" : "НМЦК (расчёт: средняя × кол-во)"}
                    value={lot.totalAmount ? rub(lot.totalAmount) : "—"}
                    strong
                />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">ОКПД2 / КТРУ</dt>
                <dd>
                    {lot.okpd2 || "—"} / {lot.ktru || "—"}
                    {lot.codesAuto && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">подобрано автоматически</span>}
                </dd>
                <dt className="text-muted-foreground">ОКВЭД2</dt>
                <dd>{lot.okved || "—"}</dd>
                <dt className="text-muted-foreground">Источник / КОСГУ</dt>
                <dd>
                    {FUNDING_LABEL[lot.fundingSource]} / {lot.kosgu || "—"}
                </dd>
                <dt className="text-muted-foreground">ПФХД</dt>
                <dd>
                    {PLAN_TYPE_LABEL[lot.planType]}, {lot.planYear || "—"} год
                </dd>
                {lot.description && (
                    <>
                        <dt className="text-muted-foreground">Описание</dt>
                        <dd className="whitespace-pre-wrap">{lot.description}</dd>
                    </>
                )}
            </dl>

            {lot.comment && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Комментарий проректора для бюджетной комиссии</p>
                    <p className="whitespace-pre-wrap">{lot.comment}</p>
                </div>
            )}
            {lot.economistComment && (
                <p className="text-sm">
                    <span className="text-muted-foreground">Экономист: </span>
                    {lot.economistComment}
                </p>
            )}
            {lot.commissionComment && (
                <p className="text-sm">
                    <span className="text-muted-foreground">Комиссия: </span>
                    {lot.commissionComment}
                </p>
            )}
            {lot.lastComment && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Причина возврата / отказа: {lot.lastComment}
                </p>
            )}

            <PurchaseApprovals approvals={lot.approvals} title="Согласовано по закупке" />
            {heads.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">{ACTOR_LABEL[PurchaseActorRole.DEPT_HEAD]} — согласовали заявки</p>
                    {heads.map((h) => (
                        <p key={`${h.request}-${h.name}`}>
                            #{h.request}: <span className="font-medium">{h.name}</span>{" "}
                            <span className="text-xs text-muted-foreground">{formatDateTime(h.at)}</span>
                        </p>
                    ))}
                </div>
            )}
        </Card>
    );
};

const Metric: FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
    <div className="rounded-lg border p-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("tabular-nums", strong ? "text-base font-semibold" : "text-sm")}>{value}</p>
    </div>
);

/* ───────────── requests inside ───────────── */

const LotRequests: FC<{ state: PurchaseV2State; lot: PurchaseLot; editable: boolean }> = ({ state, lot, editable }) => {
    const [adding, setAdding] = useState("");
    const requests = lot.requestIds.map(state.requestById).filter((r) => r !== undefined);
    return (
        <Section title={`Заявки в закупке (${requests.length})`}>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Заявка</TableHead>
                            <TableHead>Отдел</TableHead>
                            <TableHead className="text-right">Кол-во</TableHead>
                            <TableHead>Автор</TableHead>
                            {editable && <TableHead />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <button className="text-left hover:underline" onClick={() => state.setTarget({ kind: "request", id: r.id })}>
                                        #{r.id} {r.title}
                                    </button>
                                </TableCell>
                                <TableCell>{r.department}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {qty(r.quantity)} {r.unit}
                                </TableCell>
                                <TableCell>{r.authorName}</TableCell>
                                {editable && (
                                    <TableCell className="text-right">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            title="Исключить из закупки"
                                            disabled={state.busy || requests.length < 2}
                                            onClick={() => state.lotRequests(lot.id, [], [r.id])}
                                        >
                                            <XIcon className="size-4" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {editable && state.mergeable.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <select className={FIELD_CLASS} value={adding} onChange={(e) => setAdding(e.target.value)}>
                        <option value="">Добавить заявку в эту закупку…</option>
                        {state.mergeable.map((r) => (
                            <option key={r.id} value={r.id}>
                                #{r.id} {r.title} — {qty(r.quantity)} {r.unit} ({r.department})
                            </option>
                        ))}
                    </select>
                    <Button
                        size="sm"
                        disabled={!adding || state.busy}
                        onClick={async () => {
                            if (await state.lotRequests(lot.id, [adding], [])) setAdding("");
                        }}
                    >
                        Добавить
                    </Button>
                </div>
            )}
        </Section>
    );
};

/* ───────────── commercial offers ───────────── */

const emptyQuotation = (): PurchaseQuotationForm => ({ supplier: "", unitPrice: "", note: "" });

const LotQuotations: FC<{ state: PurchaseV2State; lot: PurchaseLot; editable: boolean }> = ({ state, lot, editable }) => {
    const [form, setForm] = useState<PurchaseQuotationForm>(emptyQuotation());
    const [fileKey, setFileKey] = useState(0);
    const price = parseRub(form.unitPrice);
    const valid = form.supplier.trim() && price > 0;

    const submit = async () => {
        if (form.file && form.file.size > 10 * 1024 * 1024) {
            toast.error("Файл КП больше 10 МБ");
            return;
        }
        if (await state.addQuotation(lot.id, form)) {
            setForm(emptyQuotation());
            setFileKey((k) => k + 1);
        }
    };

    return (
        <Section title={`Коммерческие предложения (${lot.quotations.length})`}>
            {lot.quotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {editable ? "Прикрепите КП — по ним считается цена (средняя цена × количество = НМЦК)." : "КП не прикреплены."}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Поставщик</TableHead>
                                <TableHead className="text-right">Цена за ед.</TableHead>
                                <TableHead className="text-right">На всё кол-во</TableHead>
                                <TableHead>Файл</TableHead>
                                <TableHead>Добавил</TableHead>
                                {editable && <TableHead />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lot.quotations.map((q) => (
                                <TableRow key={q.id}>
                                    <TableCell>
                                        <p className="font-medium">
                                            {q.supplier}
                                            {q.unitPrice === lot.minUnitPrice && lot.quotations.length > 1 && (
                                                <span className="ml-2 text-xs text-emerald-600">мин.</span>
                                            )}
                                        </p>
                                        {q.note && <p className="text-xs text-muted-foreground">{q.note}</p>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{rub(q.unitPrice)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{rub(Math.round(q.unitPrice * lot.quantity))}</TableCell>
                                    <TableCell>
                                        {q.fileSize > 0 ? (
                                            <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => state.downloadQuotation(q)}>
                                                <FileDownIcon className="size-4" />
                                                <span className="max-w-40 truncate">{q.fileName}</span>
                                                <span className="text-xs text-muted-foreground">{kb(q.fileSize)}</span>
                                            </button>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {q.createdBy}
                                        <br />
                                        {formatDateTime(q.createdAt)}
                                    </TableCell>
                                    {editable && (
                                        <TableCell className="text-right">
                                            <Button size="icon" variant="ghost" title="Удалить КП" disabled={state.busy} onClick={() => state.deleteQuotation(q)}>
                                                <TrashIcon className="size-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {editable && (
                <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-2">
                    <Field label="Поставщик *">
                        <input className={FIELD_CLASS} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="ООО «Ромашка»" />
                    </Field>
                    <Field label="Цена за единицу, ₽ *" hint={form.unitPrice && !(price > 0) ? "Число, до копеек: 12 345,67" : undefined}>
                        <input className={FIELD_CLASS} inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                    </Field>
                    <Field label="Примечание">
                        <input className={FIELD_CLASS} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Срок поставки, гарантия…" />
                    </Field>
                    <Field label="Файл КП (до 10 МБ)">
                        <input key={fileKey} type="file" className={FIELD_CLASS} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })} />
                    </Field>
                    <div className="sm:col-span-2">
                        <Button size="sm" disabled={!valid || state.busy} onClick={submit}>
                            Прикрепить КП
                        </Button>
                    </div>
                </div>
            )}
        </Section>
    );
};

/* ───────────── editing by role ───────────── */

const LotEditor: FC<{ state: PurchaseV2State; lot: PurchaseLot; role: PurchaseActorRole }> = ({ state, lot, role }) => {
    const [form, setForm] = useState<PurchaseLotForm>(() => lotForm(lot));
    const set = (patch: Partial<PurchaseLotForm>) => setForm((f) => ({ ...f, ...patch }));
    const [suggesting, setSuggesting] = useState(false);

    const suggest = async () => {
        setSuggesting(true);
        try {
            const s = await purchaseV2Api.codeSuggest(form.title || lot.title);
            if (s?.found) {
                set({ okpd2: s.okpd2, ktru: s.ktru, okved: s.okved });
                toast.success(`Подобрано: ${s.name}`);
            } else {
                toast.info("По названию код не подобрать — укажите вручную");
            }
        } finally {
            setSuggesting(false);
        }
    };

    if (role === PurchaseActorRole.DEPT_HEAD || role === PurchaseActorRole.EMPLOYEE) {
        const valid = form.title.trim() && parseQty(form.quantity) > 0;
        return (
            <Section title={role === PurchaseActorRole.EMPLOYEE ? "Характеристики (готовит исполнитель)" : "Закупка (правит реализующий начальник)"}>
                <Field label="Название *" hint="Единое наименование для объединённых заявок.">
                    <input className={FIELD_CLASS} value={form.title} onChange={(e) => set({ title: e.target.value })} />
                </Field>
                <Field label="Количество *" hint="Сумма по заявкам; можно уточнить.">
                    <input className={FIELD_CLASS} inputMode="decimal" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                </Field>
                <Field label="Характеристики">
                    <textarea className={cn(FIELD_CLASS, "min-h-24")} value={form.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <div>
                    <Button size="sm" variant="outline" disabled={!valid || state.busy} onClick={() => state.updateLot(lot.id, form)}>
                        Сохранить
                    </Button>
                </div>
            </Section>
        );
    }

    if (role === PurchaseActorRole.VICE_RECTOR) {
        return (
            <Section title="Обоснование для бюджетной комиссии">
                <Field label="Комментарий проректора" hint="Объясните, зачем нужна закупка — комиссия увидит его при рассмотрении.">
                    <textarea className={cn(FIELD_CLASS, "min-h-20")} value={form.comment} onChange={(e) => set({ comment: e.target.value })} />
                </Field>
                <div>
                    <Button size="sm" variant="outline" disabled={state.busy} onClick={() => state.updateLot(lot.id, form)}>
                        Сохранить
                    </Button>
                </div>
            </Section>
        );
    }

    if (role === PurchaseActorRole.ECONOMIST) {
        return (
            <Section title="Коды и бюджет (экономический отдел)">
                <p className="text-xs text-muted-foreground">
                    {lot.codesAuto && <span className="text-amber-700">Коды подобраны автоматически по названию — проверьте и укажите точную позицию КТРУ. </span>}
                    <a className="text-primary hover:underline" href={`${ROUTE.DOCS.COMMON}?doc=purchases-codes`} target="_blank" rel="noreferrer">
                        Как подбираются коды
                    </a>
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="ОКПД2">
                        <input className={FIELD_CLASS} value={form.okpd2} onChange={(e) => set({ okpd2: e.target.value })} placeholder="26.20.15.000" />
                    </Field>
                    <Field
                        label="КТРУ"
                        hint={
                            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={ktruSearchUrl(form.okpd2 || lot.title)} target="_blank" rel="noreferrer">
                                Найти позицию в каталоге КТРУ <ExternalLinkIcon className="size-3" />
                            </a>
                        }
                    >
                        <input className={FIELD_CLASS} value={form.ktru} onChange={(e) => set({ ktru: e.target.value })} placeholder="26.20.15.000-00000001" />
                    </Field>
                    <Field label="ОКВЭД2">
                        <input className={FIELD_CLASS} value={form.okved} onChange={(e) => set({ okved: e.target.value })} placeholder="26.20" />
                    </Field>
                    <Field label="Источник финансирования">
                        <select className={FIELD_CLASS} value={form.fundingSource} onChange={(e) => set({ fundingSource: Number(e.target.value) as PurchaseFundingSource })}>
                            <option value={PurchaseFundingSource.UNSPECIFIED}>— выберите —</option>
                            {FUNDING_OPTIONS.map((f) => (
                                <option key={f} value={f}>
                                    {FUNDING_LABEL[f]}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="КОСГУ">
                        <input className={FIELD_CLASS} value={form.kosgu} onChange={(e) => set({ kosgu: e.target.value })} placeholder="310" />
                    </Field>
                </div>
                <NmckField lot={lot} value={form.nmck} onChange={(nmck) => set({ nmck })} />
                <Field label="Комментарий экономиста (сверка бюджета)">
                    <textarea className={cn(FIELD_CLASS, "min-h-16")} value={form.economistComment} onChange={(e) => set({ economistComment: e.target.value })} />
                </Field>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={state.busy || !(parseRub(form.nmck) > 0)} onClick={() => state.updateLot(lot.id, form)}>
                        Сохранить
                    </Button>
                    <Button size="sm" variant="ghost" disabled={suggesting} onClick={suggest}>
                        <SparklesIcon className="size-4" /> Подобрать коды по названию
                    </Button>
                </div>
            </Section>
        );
    }

    return (
        <Section title="ПФХД: тип и год">
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Тип закупки">
                    <select className={FIELD_CLASS} value={form.planType} onChange={(e) => set({ planType: Number(e.target.value) as PurchasePlanType })}>
                        <option value={PurchasePlanType.UNSPECIFIED}>— выберите —</option>
                        <option value={PurchasePlanType.PLANNED}>{PLAN_TYPE_LABEL[PurchasePlanType.PLANNED]}</option>
                        <option value={PurchasePlanType.UNPLANNED}>{PLAN_TYPE_LABEL[PurchasePlanType.UNPLANNED]}</option>
                    </select>
                </Field>
                <Field label="Год ПФХД">
                    <input className={FIELD_CLASS} inputMode="numeric" value={form.planYear} onChange={(e) => set({ planYear: e.target.value })} />
                </Field>
            </div>
            <Field label="Комментарий комиссии">
                <textarea className={cn(FIELD_CLASS, "min-h-16")} value={form.commissionComment} onChange={(e) => set({ commissionComment: e.target.value })} />
            </Field>
            <div>
                <Button size="sm" variant="outline" disabled={state.busy} onClick={() => state.updateLot(lot.id, form)}>
                    Сохранить
                </Button>
            </div>
        </Section>
    );
};

/* ───────────── НМЦК ───────────── */

/** The economist's НМЦК: the calculation from the offers, and the amount to enter
 * (prefilled with the average). */
const NmckField: FC<{ lot: PurchaseLot; value: string; onChange: (v: string) => void }> = ({ lot, value, onChange }) => {
    const calc = nmckCalc(lot);
    const entered = parseRub(value);
    const uniform = calc.variation === undefined || calc.variation <= NMCK_UNIFORM_MAX;
    return (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
            <p className="text-sm font-medium">НМЦК — расчёт по коммерческим предложениям</p>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>КП</TableHead>
                            <TableHead className="text-right">Цена за ед.</TableHead>
                            <TableHead className="text-right">× {qty(lot.quantity)} {lot.unit}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calc.rows.map((r, i) => (
                            <TableRow key={i}>
                                <TableCell>{r.supplier}</TableCell>
                                <TableCell className="text-right tabular-nums">{rub(r.unitPrice)}</TableCell>
                                <TableCell className="text-right tabular-nums">{rub(r.amount)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                            <TableCell className="font-medium">Минимальная</TableCell>
                            <TableCell className="text-right tabular-nums">{rub(lot.minUnitPrice)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                                {rub(calc.minAmount)}{" "}
                                <button type="button" className="ml-1 text-xs text-primary hover:underline" onClick={() => onChange(rubInput(calc.minAmount))}>
                                    подставить
                                </button>
                            </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                            <TableCell className="font-medium">Средняя</TableCell>
                            <TableCell className="text-right tabular-nums">{rub(lot.unitPrice)}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                                {rub(calc.avgAmount)}{" "}
                                <button type="button" className="ml-1 text-xs font-normal text-primary hover:underline" onClick={() => onChange(rubInput(calc.avgAmount))}>
                                    подставить
                                </button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            {calc.variation !== undefined && (
                <p className={cn("text-xs", uniform ? "text-muted-foreground" : "text-amber-700")}>
                    Коэффициент вариации цен: {calc.variation.toFixed(1).replace(".", ",")} %
                    {uniform
                        ? " — цены однородные (не больше 33 %)."
                        : " — больше 33 %: цены неоднородные, по методике нужны дополнительные КП или обоснование."}
                </p>
            )}
            <Field
                label="НМЦК, ₽ *"
                hint={
                    entered > 0 && lot.quantity > 0
                        ? `За единицу: ${rub(Math.round(entered / lot.quantity))}${
                              entered !== calc.avgAmount ? ` · ${entered > calc.avgAmount ? "выше" : "ниже"} средней на ${rub(Math.abs(entered - calc.avgAmount))}` : " · равна средней"
                          }`
                        : "По умолчанию — средняя сумма. Можно ввести свою."
                }
            >
                <input className={FIELD_CLASS} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
            </Field>
        </div>
    );
};

/* ───────────── stage actions ───────────── */

const LotStage: FC<{ state: PurchaseV2State; lot: PurchaseLot }> = ({ state, lot }) => {
    const { actor } = state;
    const access = lotAccess(state, lot, true);
    const [planType, setPlanType] = useState<PurchasePlanType>(lot.planType || PurchasePlanType.PLANNED);
    const [planYear, setPlanYear] = useState(String(lot.planYear || new Date().getFullYear() + 1));
    const [assignee, setAssignee] = useState(lot.assigneeUuid);
    const [employees, setEmployees] = useState<PurchaseEmployee[]>();
    const act = (action: PurchaseLotAction, success: string) => (comment: string) => state.lotAction(lot.id, action, { comment }, success);
    const buttons: StageButton[] = [];
    let title = "";
    let hint = "";
    const offersHint = lot.quotations.length === 0 ? "Прикрепите хотя бы одно КП." : lot.quotations.length < 3 ? "Обычно для НМЦК нужно не меньше трёх КП." : "";
    const assigning = access.implHead && lot.status === PurchaseLotStatus.FORMING;

    // Whom the head may give it to: the implementing department's employees.
    useEffect(() => {
        if (!assigning || employees) return;
        purchaseV2Api
            .employees(lot.implementingDepartment)
            .then(setEmployees)
            .catch(() => setEmployees([]));
    }, [assigning, employees, lot.implementingDepartment]);

    switch (actor.role) {
        case PurchaseActorRole.DEPT_HEAD:
            if (!access.implHead) break;
            if (lot.status === PurchaseLotStatus.FORMING) {
                title = "Назначение исполнителя";
                hint = "Исполнитель подготовит характеристики, стандартизирует закупку и соберёт первые КП.";
                buttons.push(
                    {
                        label: "Передать исполнителю",
                        disabled: !assignee,
                        run: (comment) => {
                            const who = employees?.find((e) => e.uuid === assignee);
                            return state.lotAction(
                                lot.id,
                                PurchaseLotAction.ASSIGN,
                                { comment, assignee: { uuid: assignee, name: who?.name ?? lot.assigneeName } },
                                "Закупка передана исполнителю",
                            );
                        },
                    },
                    {
                        label: "Расформировать",
                        variant: "destructive",
                        run: async (comment) =>
                            confirm("Расформировать закупку? Заявки вернутся в список отдела, КП будут удалены.") &&
                            state.lotAction(lot.id, PurchaseLotAction.DISBAND, { comment }, "Закупка расформирована"),
                    },
                );
            } else if (lot.status === PurchaseLotStatus.IMPLEMENTER_CHECK) {
                title = "Проверка работы исполнителя";
                hint = `Коды ОКПД2, КТРУ, ОКВЭД2 подставятся по справочнику при передаче проректору. ${offersHint}`;
                buttons.push(
                    { label: "Принять → проректору", run: act(PurchaseLotAction.CHECK_APPROVE, "Закупка передана проректору") },
                    { label: "Вернуть исполнителю", variant: "outline", needComment: true, run: act(PurchaseLotAction.CHECK_RETURN, "Закупка возвращена исполнителю") },
                );
            }
            break;
        case PurchaseActorRole.EMPLOYEE:
            if (!access.assignee) break;
            title = "Подготовка закупки";
            hint = `Заполните характеристики и прикрепите КП, затем передайте начальнику на проверку. ${offersHint}`;
            buttons.push(
                { label: "Готово → начальнику на проверку", run: act(PurchaseLotAction.SPEC_DONE, "Закупка передана начальнику") },
                { label: "Вернуть начальнику", variant: "outline", needComment: true, run: act(PurchaseLotAction.SPEC_RETURN, "Закупка возвращена начальнику") },
            );
            break;
        case PurchaseActorRole.VICE_RECTOR:
            if (lot.status !== PurchaseLotStatus.VICE_RECTOR_REVIEW || !state.isMyCurator(lot.curatorId)) break;
            title = "Решение проректора";
            hint = "Сохраните обоснование для бюджетной комиссии, затем согласуйте.";
            buttons.push(
                { label: "Согласовать → экономистам", run: act(PurchaseLotAction.SEND_TO_ECONOMIST, "Закупка передана в экономический отдел") },
                {
                    label: "Вернуть реализующему начальнику",
                    variant: "outline",
                    needComment: true,
                    run: act(PurchaseLotAction.VICE_RECTOR_RETURN, "Закупка возвращена начальнику"),
                },
            );
            break;
        case PurchaseActorRole.ECONOMIST:
            if (lot.status !== PurchaseLotStatus.ECONOMIST_REVIEW) break;
            title = "Решение экономического отдела";
            hint = "Сначала сохраните коды, источник финансирования и НМЦК (не сохранили НМЦК — возьмётся средняя сумма).";
            buttons.push(
                { label: "Бюджет и НМЦК утверждены → комиссии", run: act(PurchaseLotAction.ECONOMIST_APPROVE, "Закупка передана на бюджетную комиссию") },
                { label: "Вернуть проректору", variant: "outline", needComment: true, run: act(PurchaseLotAction.ECONOMIST_RETURN, "Закупка возвращена проректору") },
            );
            break;
        case PurchaseActorRole.BUDGET_COMMISSION: {
            const approve: StageButton = {
                label: lot.status === PurchaseLotStatus.REJECTED ? "Всё же включить в ПФХД" : "Включить в ПФХД",
                run: (comment) =>
                    state.lotAction(lot.id, PurchaseLotAction.COMMISSION_APPROVE, { comment, planType, planYear: Number(planYear) || 0 }, "Закупка включена в ПФХД"),
            };
            const reject: StageButton = {
                label: lot.status === PurchaseLotStatus.APPROVED ? "Исключить из ПФХД" : "Отклонить",
                variant: "destructive",
                needComment: true,
                run: act(PurchaseLotAction.COMMISSION_REJECT, "Закупка отклонена"),
            };
            if (lot.status === PurchaseLotStatus.BUDGET_COMMISSION) {
                title = "Решение бюджетной комиссии";
                buttons.push(approve, reject, {
                    label: "Вернуть экономистам",
                    variant: "outline",
                    needComment: true,
                    run: act(PurchaseLotAction.COMMISSION_RETURN, "Закупка возвращена в экономический отдел"),
                });
            } else if (lot.status === PurchaseLotStatus.APPROVED) {
                title = "Пересмотр решения";
                buttons.push(reject);
            } else if (lot.status === PurchaseLotStatus.REJECTED) {
                title = "Пересмотр решения";
                buttons.push(approve);
            }
            break;
        }
    }

    const decides = actor.role === PurchaseActorRole.BUDGET_COMMISSION && lot.status !== PurchaseLotStatus.APPROVED;
    return (
        <StageActions title={title} hint={hint} buttons={buttons} busy={state.busy}>
            {assigning && (
                <Field label="Исполнитель" hint={employees && employees.length === 0 ? "В отделе нет сотрудников в справочнике MDM." : undefined}>
                    <select className={FIELD_CLASS} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                        <option value="">{employees ? "— выберите —" : "Загрузка…"}</option>
                        {employees?.map((e) => (
                            <option key={e.uuid} value={e.uuid}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                </Field>
            )}
            {decides && buttons.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Включить в ПФХД как">
                        <select className={FIELD_CLASS} value={planType} onChange={(e) => setPlanType(Number(e.target.value) as PurchasePlanType)}>
                            <option value={PurchasePlanType.PLANNED}>{PLAN_TYPE_LABEL[PurchasePlanType.PLANNED]}</option>
                            <option value={PurchasePlanType.UNPLANNED}>{PLAN_TYPE_LABEL[PurchasePlanType.UNPLANNED]}</option>
                        </select>
                    </Field>
                    <Field label="Год ПФХД">
                        <input className={FIELD_CLASS} inputMode="numeric" value={planYear} onChange={(e) => setPlanYear(e.target.value)} />
                    </Field>
                </div>
            )}
        </StageActions>
    );
};
