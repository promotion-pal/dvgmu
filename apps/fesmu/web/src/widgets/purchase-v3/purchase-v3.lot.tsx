import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import { ArrowRightIcon, CalendarIcon, TriangleAlertIcon, CheckCircle2Icon, CircleIcon, DownloadIcon, HourglassIcon, PaperclipIcon, PlusIcon, TrashIcon, Undo2Icon, UploadIcon, XIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { PurchaseLot } from "@fesmu/contract/fesmu/entity/v3/purchase.entity_pb";
import { Button } from "@/shared/ui/button";
import type { LotPatch, PurchaseV3State } from "./purchase-v3.fn";
import {
    dateInput,
    DOCUMENT_LABEL,
    fileSize,
    formatDate,
    fromDateInput,
    FUNDING_LABEL,
    ITEM_TYPE_LABEL,
    LAW_LABEL,
    LOT_FORWARD,
    LOT_STAGES,
    LOT_STATUS,
    lotChecklist,
    lotStage,
    METHOD_LABEL,
    nextStageLabel,
    parseQty,
    parseRub,
    PLAN_LABEL,
    PurchaseDocumentKind,
    PurchaseFundingSource,
    PurchaseItemType,
    PurchaseLaw,
    PurchaseLotStatus,
    PurchaseMethod,
    PurchasePlanType,
    PurchaseMove,
    PurchasePermission,
    PurchaseRequestStatus,
    PurchaseRole,
    qty,
    requestKey,
    ROLE_LABEL,
    rub,
    rubInput,
    stageDocuments,
} from "./purchase-v3.schema";
import { Facts, Field, FIELD_CLASS, LogList, LotBadge, LotRoute, RequestBadge, Section, SignOffs, TermChip } from "./purchase-v3.ui";

const at = (s: PurchaseLotStatus) => lotStage(s);
const reached = (l: PurchaseLot, s: PurchaseLotStatus) => l.status === PurchaseLotStatus.COMPLETED || at(l.status) >= at(s);

/** A save button for a stage form. */
const SaveRow: FC<{ state: PurchaseV3State; disabled?: boolean; onSave: () => void; children?: ReactNode }> = ({ state, disabled, onSave, children }) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        <Button size="sm" variant="secondary" disabled={state.busy || disabled} onClick={onSave}>
            Сохранить
        </Button>
    </div>
);

/* ───────────── stage forms: each saves only its own fields ───────────── */

const ContentForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [title, setTitle] = useState(l.title);
    const [description, setDescription] = useState(l.description);
    const [quantity, setQuantity] = useState(String(l.quantity).replace(".", ","));
    const [unit, setUnit] = useState(l.unit);
    const [specification, setSpecification] = useState(l.specification);
    const [okpd2, setOkpd2] = useState(l.okpd2);
    const [ktru, setKtru] = useState(l.ktru);
    const [okved, setOkved] = useState(l.okved);
    const q = parseQty(quantity);
    const save = () =>
        state.updateLot(l, { case: "content", value: { title, description, quantity: q, unit, specification, techSpec: l.techSpec, okpd2, ktru, okved } } as LotPatch);
    const suggest = async () => {
        const s = await state.suggestCodes(title);
        if (s?.found) {
            setOkpd2(s.okpd2);
            setKtru(s.ktru);
            setOkved(s.okved);
        }
    };
    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_90px]">
                <Field label="Наименование">
                    <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
                </Field>
                <Field label="Количество">
                    <input className={FIELD_CLASS} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
                </Field>
                <Field label="Ед.">
                    <input className={FIELD_CLASS} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={32} />
                </Field>
            </div>
            <Field label="Характеристики объекта закупки" hint="Единое наименование и требования для всех объединённых заявок.">
                <textarea className={FIELD_CLASS} rows={6} value={specification} onChange={(e) => setSpecification(e.target.value)} />
            </Field>
            <Field label="Описание">
                <textarea className={FIELD_CLASS} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {l.status === PurchaseLotStatus.SPECIFICATION_CHECK && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="ОКПД2" hint={l.codesAuto ? "Подставлен по справочнику — проверьте" : undefined}>
                        <input className={FIELD_CLASS} value={okpd2} onChange={(e) => setOkpd2(e.target.value)} />
                    </Field>
                    <Field label="КТРУ">
                        <input className={FIELD_CLASS} value={ktru} onChange={(e) => setKtru(e.target.value)} />
                    </Field>
                    <Field label="ОКВЭД2">
                        <input className={FIELD_CLASS} value={okved} onChange={(e) => setOkved(e.target.value)} />
                    </Field>
                </div>
            )}
            <SaveRow state={state} disabled={!title.trim() || !(q > 0)} onSave={save}>
                {l.status === PurchaseLotStatus.SPECIFICATION_CHECK && (
                    <Button size="sm" variant="ghost" onClick={suggest}>
                        Подобрать коды по наименованию
                    </Button>
                )}
            </SaveRow>
        </div>
    );
};

const TechSpecForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [description, setDescription] = useState(l.description);
    const [techSpec, setTechSpec] = useState(l.techSpec);
    return (
        <div className="flex flex-col gap-3">
            <Field label="Техническое задание" hint="Можно написать здесь или прикрепить файлом (документ «Техническое задание»).">
                <textarea className={FIELD_CLASS} rows={10} value={techSpec} onChange={(e) => setTechSpec(e.target.value)} />
            </Field>
            <Field label="Описание">
                <textarea className={FIELD_CLASS} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <SaveRow
                state={state}
                onSave={() => state.updateLot(l, { case: "content", value: { title: l.title, quantity: l.quantity, unit: l.unit, description, specification: l.specification, okpd2: l.okpd2, ktru: l.ktru, okved: l.okved, techSpec } } as LotPatch)}
            />
        </div>
    );
};

const CuratorForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [text, setText] = useState(l.curatorJustification);
    return (
        <div className="flex flex-col gap-3">
            <Field label="Обоснование для бюджетной комиссии *" hint="Для чего нужна закупка — комиссия увидит это рядом со стоимостью.">
                <textarea className={FIELD_CLASS} rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <SaveRow state={state} onSave={() => state.updateLot(l, { case: "curator", value: { curatorJustification: text } } as LotPatch)} />
        </div>
    );
};

/** НМЦК by comparable prices: each offer × quantity, the minimum, the average, the spread. */
const PriceCalc: FC<{ l: PurchaseLot }> = ({ l }) => {
    if (l.quotations.length === 0) return <p className="text-xs text-muted-foreground">КП нет — НМЦК не из чего определить.</p>;
    return (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            {l.quotations.map((q) => (
                <div key={q.id.toString()} className="flex justify-between gap-2">
                    <span>{q.supplier}</span>
                    <span className="tabular-nums">{rub(BigInt(Math.round(Number(q.unitPrice) * l.quantity)))}</span>
                </div>
            ))}
            <div className="mt-1 flex justify-between gap-2 border-t pt-1 text-muted-foreground">
                <span>Минимальная</span>
                <span className="tabular-nums">{rub(BigInt(Math.round(Number(l.minUnitPrice) * l.quantity)))}</span>
            </div>
            <div className="flex justify-between gap-2 font-medium">
                <span>Средняя (НМЦК по умолчанию)</span>
                <span className="tabular-nums">{rub(l.calcAmount)}</span>
            </div>
            {l.quotations.length > 1 && (
                <p className={l.priceVariation > 33 ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>
                    Разброс цен: {l.priceVariation.toLocaleString("ru-RU")} %
                    {l.priceVariation > 33 && " — больше 33 %: запросите ещё КП или обоснуйте цену (п. 5.3 регламента)"}
                </p>
            )}
        </div>
    );
};

const BudgetForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [okpd2, setOkpd2] = useState(l.okpd2);
    const [ktru, setKtru] = useState(l.ktru);
    const [okved, setOkved] = useState(l.okved);
    const [funding, setFunding] = useState(l.fundingSource);
    const [kosgu, setKosgu] = useState(l.kosgu);
    const [nmck, setNmck] = useState(rubInput(l.nmck));
    const [comment, setComment] = useState(l.economistComment);
    const nmckKop = nmck.trim() ? parseRub(nmck) : 0;
    return (
        <div className="flex flex-col gap-3">
            <PriceCalc l={l} />
            <div className="grid gap-3 sm:grid-cols-3">
                <Field label="ОКПД2 *" hint={l.codesAuto ? "Подставлен автоматически" : undefined}>
                    <input className={FIELD_CLASS} value={okpd2} onChange={(e) => setOkpd2(e.target.value)} />
                </Field>
                <Field label="КТРУ">
                    <input className={FIELD_CLASS} value={ktru} onChange={(e) => setKtru(e.target.value)} />
                </Field>
                <Field label="ОКВЭД2">
                    <input className={FIELD_CLASS} value={okved} onChange={(e) => setOkved(e.target.value)} />
                </Field>
                <Field label="Источник финансирования *">
                    <select className={FIELD_CLASS} value={funding} onChange={(e) => setFunding(Number(e.target.value))}>
                        {Object.values(PurchaseFundingSource)
                            .filter((v): v is PurchaseFundingSource => typeof v === "number")
                            .map((v) => (
                                <option key={v} value={v}>
                                    {FUNDING_LABEL[v]}
                                </option>
                            ))}
                    </select>
                </Field>
                <Field label="КОСГУ *">
                    <input className={FIELD_CLASS} value={kosgu} onChange={(e) => setKosgu(e.target.value)} />
                </Field>
                <Field label="НМЦК, ₽" hint="Пусто — средняя по КП">
                    <input className={FIELD_CLASS} value={nmck} onChange={(e) => setNmck(e.target.value)} placeholder={rubInput(l.calcAmount)} inputMode="decimal" />
                </Field>
            </div>
            <Field label="Заключение экономиста">
                <textarea className={FIELD_CLASS} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            <SaveRow
                state={state}
                disabled={Number.isNaN(nmckKop)}
                onSave={() =>
                    state.updateLot(l, {
                        case: "budget",
                        value: { okpd2, ktru, okved, fundingSource: funding, kosgu, nmck: BigInt(nmckKop || 0), economistComment: comment },
                    } as LotPatch)
                }
            />
        </div>
    );
};

const FinalCostForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [cost, setCost] = useState(rubInput(l.finalCost));
    const [comment, setComment] = useState(l.finalCostComment);
    const kop = parseRub(cost);
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">НМЦК, утверждённая до комиссии: {rub(l.nmck)}</p>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <Field label="Конечная стоимость, ₽ *">
                    <input className={FIELD_CLASS} value={cost} onChange={(e) => setCost(e.target.value)} placeholder={rubInput(l.nmck)} inputMode="decimal" />
                </Field>
                <Field label="Обоснование">
                    <input className={FIELD_CLASS} value={comment} onChange={(e) => setComment(e.target.value)} />
                </Field>
            </div>
            <SaveRow state={state} disabled={!(kop > 0)} onSave={() => state.updateLot(l, { case: "finalCost", value: { finalCost: BigInt(kop), finalCostComment: comment } } as LotPatch)} />
        </div>
    );
};

const LawForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [law, setLaw] = useState(l.law);
    const [method, setMethod] = useState(l.method);
    const [comment, setComment] = useState(l.contractServiceComment);
    const methods = Object.values(PurchaseMethod).filter((v): v is PurchaseMethod => typeof v === "number" && v !== PurchaseMethod.UNSPECIFIED);
    const allowed = methods.filter((m) => law !== PurchaseLaw.FZ44 || (m !== PurchaseMethod.PROPOSAL_REQUEST && m !== PurchaseMethod.OTHER));
    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Закон *">
                    <select className={FIELD_CLASS} value={law} onChange={(e) => setLaw(Number(e.target.value))}>
                        <option value={PurchaseLaw.UNSPECIFIED}>— выберите —</option>
                        <option value={PurchaseLaw.FZ44}>44-ФЗ</option>
                        <option value={PurchaseLaw.FZ223}>223-ФЗ</option>
                    </select>
                </Field>
                <Field label="Способ определения поставщика *">
                    <select className={FIELD_CLASS} value={method} onChange={(e) => setMethod(Number(e.target.value))}>
                        <option value={PurchaseMethod.UNSPECIFIED}>— выберите —</option>
                        {allowed.map((m) => (
                            <option key={m} value={m}>
                                {METHOD_LABEL[m]}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            <Field label="Комментарий">
                <textarea className={FIELD_CLASS} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            <SaveRow state={state} onSave={() => state.updateLot(l, { case: "law", value: { law, method, contractServiceComment: comment } } as LotPatch)} />
        </div>
    );
};

const DateField: FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <Field label={label}>
        <input type="date" className={FIELD_CLASS} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
);

const ts = (v: string) => {
    const d = fromDateInput(v);
    return d ? timestampFromDate(d) : undefined;
};

/** Procurement fills the execution in as it goes: each step shows the fields up to it. */
const ExecutionForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [notice, setNotice] = useState(l.noticeNumber);
    const [noticeAt, setNoticeAt] = useState(dateInput(l.noticeAt));
    const [supplier, setSupplier] = useState(l.supplier);
    const [inn, setInn] = useState(l.supplierInn);
    const [number, setNumber] = useState(l.contractNumber);
    const [contractAt, setContractAt] = useState(dateInput(l.contractAt));
    const [amount, setAmount] = useState(rubInput(l.contractAmount));
    const [due, setDue] = useState(dateInput(l.deliveryDue));
    const [delivered, setDelivered] = useState(dateInput(l.deliveredAt));
    const amountKop = amount.trim() ? parseRub(amount) : 0;
    const single = l.method === PurchaseMethod.SINGLE_SUPPLIER;
    return (
        <div className="flex flex-col gap-3">
            {!single && (
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <Field label="Номер извещения в ЕИС">
                        <input className={FIELD_CLASS} value={notice} onChange={(e) => setNotice(e.target.value)} />
                    </Field>
                    <DateField label="Дата размещения" value={noticeAt} onChange={setNoticeAt} />
                </div>
            )}
            {reached(l, PurchaseLotStatus.TENDERING) && (
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <Field label="Поставщик">
                        <input className={FIELD_CLASS} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                    </Field>
                    <Field label="ИНН">
                        <input className={FIELD_CLASS} value={inn} onChange={(e) => setInn(e.target.value)} inputMode="numeric" />
                    </Field>
                </div>
            )}
            {reached(l, PurchaseLotStatus.CONTRACTING) && (
                <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="№ контракта">
                        <input className={FIELD_CLASS} value={number} onChange={(e) => setNumber(e.target.value)} />
                    </Field>
                    <DateField label="Дата контракта" value={contractAt} onChange={setContractAt} />
                    <Field label="Сумма, ₽">
                        <input className={FIELD_CLASS} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                    </Field>
                    <DateField label="Срок исполнения" value={due} onChange={setDue} />
                </div>
            )}
            {reached(l, PurchaseLotStatus.DELIVERY) && <DateField label="Дата поставки / оказания" value={delivered} onChange={setDelivered} />}
            <SaveRow
                state={state}
                disabled={Number.isNaN(amountKop)}
                onSave={() =>
                    state.updateLot(l, {
                        case: "execution",
                        value: {
                            noticeNumber: notice,
                            noticeAt: ts(noticeAt),
                            supplier,
                            supplierInn: inn,
                            contractNumber: number,
                            contractAt: ts(contractAt),
                            contractAmount: BigInt(amountKop || 0),
                            deliveryDue: ts(due),
                            deliveredAt: ts(delivered),
                        },
                    } as LotPatch)
                }
            />
        </div>
    );
};

const AcceptanceForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [acceptedAt, setAcceptedAt] = useState(dateInput(l.acceptedAt));
    const [comment, setComment] = useState(l.acceptanceComment);
    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <DateField label="Дата приёмки *" value={acceptedAt} onChange={setAcceptedAt} />
                <Field label="Комментарий">
                    <input className={FIELD_CLASS} value={comment} onChange={(e) => setComment(e.target.value)} />
                </Field>
            </div>
            <SaveRow state={state} onSave={() => state.updateLot(l, { case: "acceptance", value: { acceptedAt: ts(acceptedAt), acceptanceComment: comment } } as LotPatch)} />
        </div>
    );
};

const InventoryForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const [text, setText] = useState(l.inventoryNumbers.join("\n"));
    const numbers = text.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
    return (
        <div className="flex flex-col gap-3">
            <Field label="Инвентарные номера *" hint="По одному на строку — номера из раздела «Инвентарь», под которыми поставленное заведено на учёт.">
                <textarea className={FIELD_CLASS} rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <SaveRow state={state} onSave={() => state.updateLot(l, { case: "inventory", value: { inventoryNumbers: numbers } } as LotPatch)} />
        </div>
    );
};

/** The form of the purchase's current stage, for whoever acts there. */
/** Stages that have fields to fill in (approving stages have none). */
const STAGE_FORM: PurchaseLotStatus[] = [
    PurchaseLotStatus.FORMING,
    PurchaseLotStatus.SPECIFICATION,
    PurchaseLotStatus.SPECIFICATION_CHECK,
    PurchaseLotStatus.CURATOR_REVIEW,
    PurchaseLotStatus.ECONOMIST_REVIEW,
    PurchaseLotStatus.TECH_SPEC,
    PurchaseLotStatus.TECH_SPEC_CHECK,
    PurchaseLotStatus.FINAL_COST,
    PurchaseLotStatus.CONTRACT_SERVICE,
    PurchaseLotStatus.PROCUREMENT,
    PurchaseLotStatus.TENDERING,
    PurchaseLotStatus.CONTRACTING,
    PurchaseLotStatus.DELIVERY,
    PurchaseLotStatus.ACCEPTANCE,
    PurchaseLotStatus.INVENTORY,
];

const StageForm: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    switch (l.status) {
        case PurchaseLotStatus.FORMING:
        case PurchaseLotStatus.SPECIFICATION:
        case PurchaseLotStatus.SPECIFICATION_CHECK:
            return <ContentForm state={state} l={l} />;
        case PurchaseLotStatus.TECH_SPEC:
        case PurchaseLotStatus.TECH_SPEC_CHECK:
            return <TechSpecForm state={state} l={l} />;
        case PurchaseLotStatus.CURATOR_REVIEW:
            return <CuratorForm state={state} l={l} />;
        case PurchaseLotStatus.ECONOMIST_REVIEW:
            return <BudgetForm state={state} l={l} />;
        case PurchaseLotStatus.FINAL_COST:
            return <FinalCostForm state={state} l={l} />;
        case PurchaseLotStatus.CONTRACT_SERVICE:
            return <LawForm state={state} l={l} />;
        case PurchaseLotStatus.PROCUREMENT:
        case PurchaseLotStatus.TENDERING:
        case PurchaseLotStatus.CONTRACTING:
        case PurchaseLotStatus.DELIVERY:
            return <ExecutionForm state={state} l={l} />;
        case PurchaseLotStatus.ACCEPTANCE:
            return <AcceptanceForm state={state} l={l} />;
        case PurchaseLotStatus.INVENTORY:
            return <InventoryForm state={state} l={l} />;
    }
    return null;
};

const FullEditPanel: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const statuses = [...LOT_STAGES.map((s) => s.status), PurchaseLotStatus.REJECTED, PurchaseLotStatus.COMPLETED, PurchaseLotStatus.RESERVED];
    const [status, setStatus] = useState(l.status);
    const [statusBeforeReserve, setStatusBeforeReserve] = useState(l.status === PurchaseLotStatus.RESERVED ? PurchaseLotStatus.FORMING : l.status);
    const [comment, setComment] = useState("");
    const [planType, setPlanType] = useState(l.planType);
    const [planYear, setPlanYear] = useState(String(l.planYear || ""));
    const [implementingDepartment, setImplementingDepartment] = useState(l.implementingDepartment);
    const [curatorId, setCuratorId] = useState(l.curatorId.toString());
    const [assigneeUuid, setAssigneeUuid] = useState(l.assigneeUuid);
    const [commissionComment, setCommissionComment] = useState(l.commissionComment);
    const [itemType, setItemType] = useState(l.itemType);
    useEffect(() => { void state.loadEmployees(implementingDepartment); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [implementingDepartment]);
    return (
        <Card className="gap-4 border-amber-500/50 p-4">
            <p className="text-sm font-semibold">Полное редактирование закупки</p>
            <p className="text-xs text-muted-foreground">Сохраняйте каждый блок отдельно. Поля доступны независимо от текущего этапа.</p>
            <Section title="Статус закупки">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <select className={FIELD_CLASS} value={status} onChange={(e) => {
                        const next = Number(e.target.value) as PurchaseLotStatus;
                        setStatus(next);
                        if (next !== PurchaseLotStatus.RESERVED) setStatusBeforeReserve(next);
                    }}>
                        {statuses.map((s) => <option key={s} value={s}>{LOT_STATUS(s).label}</option>)}
                    </select>
                    <input className={FIELD_CLASS} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий к ручному переходу" maxLength={2048} />
                    <Button size="sm" disabled={state.busy || (status === l.status && !comment.trim() && planType === l.planType && Number(planYear || 0) === l.planYear && assigneeUuid === l.assigneeUuid && implementingDepartment === l.implementingDepartment && curatorId === l.curatorId.toString() && commissionComment === l.commissionComment && itemType === l.itemType)} onClick={async () => {
                        if (await state.setLotStatus(l, status, comment.trim(), { planType, planYear: Number(planYear) || 0, assigneeUuid, implementingDepartment, curatorId: BigInt(curatorId || "0"), commissionComment, itemType })) setComment("");
                    }}>Установить статус</Button>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={status === PurchaseLotStatus.RESERVED} onCheckedChange={(checked) => {
                        if (checked) {
                            if (status !== PurchaseLotStatus.RESERVED) setStatusBeforeReserve(status);
                            setStatus(PurchaseLotStatus.RESERVED);
                        } else if (status === PurchaseLotStatus.RESERVED) {
                            setStatus(statusBeforeReserve);
                        }
                    }} />
                    Отметить как резервную закупку
                </label>
            </Section>
            <Section title="Наименование, описание, характеристики и коды">
                <ContentForm state={state} l={{ ...l, status: PurchaseLotStatus.SPECIFICATION_CHECK }} />
            </Section>
            <Section title="Техническое задание"><TechSpecForm state={state} l={l} /></Section>
            <Section title="Обоснование проректора"><CuratorForm state={state} l={l} /></Section>
            <Section title="Бюджет, коды и НМЦК"><BudgetForm state={state} l={l} /></Section>
            <Section title="Конечная стоимость"><FinalCostForm state={state} l={l} /></Section>
            <Section title="Закон и способ закупки"><LawForm state={state} l={l} /></Section>
            <Section title="Извещение, поставщик, контракт и исполнение">
                <ExecutionForm state={state} l={{ ...l, status: PurchaseLotStatus.DELIVERY }} />
            </Section>
            <Section title="Приёмка"><AcceptanceForm state={state} l={l} /></Section>
            <Section title="Инвентарные номера"><InventoryForm state={state} l={l} /></Section>
            <Section title="План и назначение">
                <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Тип закупки"><select className={FIELD_CLASS} value={itemType} onChange={(e) => setItemType(Number(e.target.value) as PurchaseItemType)}><option value={PurchaseItemType.PRODUCT}>Товар</option><option value={PurchaseItemType.SERVICE}>Услуга</option></select></Field>
                    <Field label="Тип плана"><select className={FIELD_CLASS} value={planType} onChange={(e) => setPlanType(Number(e.target.value) as PurchasePlanType)}>
                        <option value={PurchasePlanType.UNSPECIFIED}>Не указан</option><option value={PurchasePlanType.PLANNED}>Плановая</option><option value={PurchasePlanType.UNPLANNED}>Внеплановая</option>
                    </select></Field>
                    <Field label="Год ПФХД"><input className={FIELD_CLASS} type="number" min={2000} max={2100} value={planYear} onChange={(e) => setPlanYear(e.target.value)} /></Field>
                    <Field label="Реализующий отдел"><select className={FIELD_CLASS} value={implementingDepartment} onChange={(e) => setImplementingDepartment(Number(e.target.value))}>
                        {(state.overview?.departments ?? []).map((d) => <option key={d.department} value={d.department}>{d.name}</option>)}
                    </select></Field>
                    <Field label="Направление проректора"><select className={FIELD_CLASS} value={curatorId} onChange={(e) => setCuratorId(e.target.value)}>
                        {(state.overview?.curators ?? []).map((c) => <option key={c.id.toString()} value={c.id.toString()}>{c.title}</option>)}
                    </select></Field>
                    <Field label="Исполнитель"><select className={FIELD_CLASS} value={assigneeUuid} onChange={(e) => setAssigneeUuid(e.target.value)}>
                        <option value="">— не назначен —</option>{(state.employees[implementingDepartment] ?? []).map((e) => <option key={e.uuid} value={e.uuid}>{e.name}</option>)}
                    </select></Field>
                    <Field label="Комментарий бюджетной комиссии"><textarea className={FIELD_CLASS} value={commissionComment} onChange={(e) => setCommissionComment(e.target.value)} maxLength={2048} /></Field>
                </div>
                <p className="text-xs text-muted-foreground">Сохраните эти значения кнопкой «Установить статус» выше; статус можно оставить прежним.</p>
            </Section>
        </Card>
    );
};

/* ───────────── offers and documents ───────────── */

/** A file input that looks like a button and names the chosen file. */
const FilePicker: FC<{ file: File | null; onChange: (f: File | null) => void; label?: string }> = ({ file, onChange, label = "Выбрать файл" }) => (
    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <UploadIcon className="size-3.5" /> {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">{file ? `${file.name} · ${fileSize(file.size)}` : "файл не выбран"}</span>
        <input type="file" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
);

const Quotations: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const editable = Boolean(l.allowed?.edit) && (state.can(PurchasePermission.LOT_FULL_EDIT) || l.status === PurchaseLotStatus.SPECIFICATION || l.status === PurchaseLotStatus.SPECIFICATION_CHECK);
    const [supplier, setSupplier] = useState("");
    const [inn, setInn] = useState("");
    const [price, setPrice] = useState("");
    const [note, setNote] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const kop = parseRub(price);
    if (!editable && l.quotations.length === 0) return null;
    return (
        <Section title={`Коммерческие предложения (${l.quotations.length})`}>
            {l.quotations.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="py-1 pr-2 font-medium">Поставщик</th>
                                <th className="py-1 pr-2 text-right font-medium">За ед.</th>
                                <th className="py-1 pr-2 text-right font-medium">× {qty(l.quantity)}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {l.quotations.map((q) => (
                                <tr key={q.id.toString()} className="border-t">
                                    <td className="py-1.5 pr-2">
                                        {q.supplier}
                                        {q.supplierInn && <span className="text-xs text-muted-foreground"> · ИНН {q.supplierInn}</span>}
                                        {q.note && <p className="text-xs text-muted-foreground">{q.note}</p>}
                                    </td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums">{rub(q.unitPrice)}</td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums">{rub(BigInt(Math.round(Number(q.unitPrice) * l.quantity)))}</td>
                                    <td className="py-1.5 text-right whitespace-nowrap">
                                        {q.fileSize > 0n && (
                                            <Button size="icon" variant="ghost" aria-label="Скачать КП" onClick={() => state.downloadQuotation(q)}>
                                                <DownloadIcon className="size-4" />
                                            </Button>
                                        )}
                                        {editable && (
                                            <Button size="icon" variant="ghost" aria-label="Удалить КП" onClick={() => state.deleteQuotation(q)}>
                                                <TrashIcon className="size-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {editable && (
                <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_130px_140px]">
                    <input className={FIELD_CLASS} placeholder="Поставщик *" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                    <input className={FIELD_CLASS} placeholder="ИНН" value={inn} onChange={(e) => setInn(e.target.value)} inputMode="numeric" />
                    <input className={FIELD_CLASS} placeholder="Цена за ед., ₽ *" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                    <input className={`${FIELD_CLASS} sm:col-span-2`} placeholder="Примечание" value={note} onChange={(e) => setNote(e.target.value)} />
                    <FilePicker file={file} onChange={setFile} label="Файл КП" />
                    <Button
                        size="sm"
                        className="sm:col-span-3 sm:justify-self-end"
                        disabled={state.busy || !supplier.trim() || !(kop > 0)}
                        onClick={async () => {
                            if (await state.addQuotation(l, { supplier: supplier.trim(), supplierInn: inn.trim(), unitPrice: kop, note: note.trim(), file })) {
                                setSupplier("");
                                setInn("");
                                setPrice("");
                                setNote("");
                                setFile(null);
                            }
                        }}
                    >
                        <PlusIcon className="size-4" /> Прикрепить КП
                    </Button>
                </div>
            )}
        </Section>
    );
};

const Documents: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const editable = Boolean(l.allowed?.edit);
    const fullEdit = state.can(PurchasePermission.LOT_FULL_EDIT);
    const kinds = fullEdit
        ? [PurchaseDocumentKind.SPECIFICATION, PurchaseDocumentKind.TECH_SPEC, PurchaseDocumentKind.NOTICE, PurchaseDocumentKind.CONTRACT, PurchaseDocumentKind.SHIPPING, PurchaseDocumentKind.ACCEPTANCE_ACT, PurchaseDocumentKind.OTHER]
        : stageDocuments(l.status);
    const [kind, setKind] = useState<PurchaseDocumentKind>(kinds[0]);
    const [file, setFile] = useState<File | null>(null);
    const [note, setNote] = useState("");
    const expects = editable && kinds[0] !== PurchaseDocumentKind.OTHER;
    if (!expects && l.documents.length === 0) return null;
    return (
        <Section title={`Документы (${l.documents.length})`}>
            {l.documents.map((d) => (
                <div key={d.id.toString()} className="flex items-center gap-2 text-sm">
                    <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                        <span className="text-muted-foreground">{DOCUMENT_LABEL[d.kind]}:</span> {d.fileName}{" "}
                        <span className="text-xs text-muted-foreground">
                            {fileSize(d.fileSize)} · {d.createdBy}
                        </span>
                        {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
                    </span>
                    <Button size="icon" variant="ghost" aria-label="Скачать" onClick={() => state.downloadDocument(d)}>
                        <DownloadIcon className="size-4" />
                    </Button>
                    {editable && (
                        <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => state.deleteDocument(d)}>
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </div>
            ))}
            {expects && (
                <div className="grid items-center gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[200px_1fr]">
                    <select className={FIELD_CLASS} value={kind} onChange={(e) => setKind(Number(e.target.value))}>
                        {kinds.map((k) => (
                            <option key={k} value={k}>
                                {DOCUMENT_LABEL[k]}
                            </option>
                        ))}
                    </select>
                    <FilePicker file={file} onChange={setFile} />
                    <input className={`${FIELD_CLASS} sm:col-span-2`} placeholder="Примечание" value={note} onChange={(e) => setNote(e.target.value)} />
                    <Button
                        size="sm"
                        className="sm:col-span-2 sm:justify-self-end"
                        disabled={state.busy || !file}
                        onClick={async () => {
                            if (file && (await state.addDocument(l, kind, file, note.trim()))) {
                                setFile(null);
                                setNote("");
                            }
                        }}
                    >
                        <PaperclipIcon className="size-4" /> Прикрепить
                    </Button>
                </div>
            )}
        </Section>
    );
};

/* ───────────── composition ───────────── */

/** While forming: the requests in the purchase, and the department's queue to add from. */
const Composition: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const forming = l.status === PurchaseLotStatus.FORMING && Boolean(l.allowed?.edit);
    const inside = l.requestIds.map((id) => state.requestById(id)).filter((r) => r !== undefined);
    const queue = forming
        ? state.requests.filter(
              (r) =>
                  r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW &&
                  r.implementingDepartment === l.implementingDepartment &&
                  r.itemType === l.itemType &&
                  (r.allowed?.moves.length ?? 0) > 0,
          )
        : [];
    return (
        <Section
            title={`Заявки в закупке (${l.requestIds.length})`}
            action={
                forming && (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => state.disbandLot(l)}>
                        Расформировать
                    </Button>
                )
            }
        >
            {inside.map((r) => (
                <div key={r.id.toString()} className="flex items-center gap-2 text-sm">
                    <button type="button" className="min-w-0 flex-1 text-left hover:underline" onClick={() => state.select(requestKey(r))}>
                        №{r.id.toString()} {r.title} — {qty(r.quantity)} {r.unit} <span className="text-xs text-muted-foreground">({state.departmentName(r.department)}, {r.authorName})</span>
                    </button>
                    <RequestBadge r={r} />
                    {forming && inside.length > 1 && (
                        <Button size="icon" variant="ghost" aria-label="Исключить" onClick={() => state.lotRequests(l, [], [r.id])}>
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </div>
            ))}
            {queue.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-2">
                    <p className="text-xs font-medium text-muted-foreground">Ждут объединения в вашем отделе — добавить в эту закупку:</p>
                    {queue.map((r) => (
                        <div key={r.id.toString()} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1">
                                №{r.id.toString()} {r.title} — {qty(r.quantity)} {r.unit}
                            </span>
                            <Button size="sm" variant="outline" disabled={state.busy} onClick={() => state.lotRequests(l, [r.id], [])}>
                                <PlusIcon className="size-4" /> Добавить
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
};

/* ───────────── the card ───────────── */

/** The purchase's control date: shown to everyone, changed by the implementing
 *  head or whoever works on the purchase now (the server checks). */
const Deadline: FC<{ state: PurchaseV3State; l: PurchaseLot; mayEdit: boolean }> = ({ state, l, mayEdit }) => {
    const [editing, setEditing] = useState(false);
    const [due, setDue] = useState(dateInput(l.dueAt));
    const [comment, setComment] = useState(l.dueComment);
    if (!editing) {
        return (
            <span className="flex flex-wrap items-center gap-2">
                {l.dueAt ? formatDate(l.dueAt) : "не задан"}
                {l.status !== PurchaseLotStatus.COMPLETED && <TermChip due={l.dueAt} />}
                {l.dueComment && <span className="text-xs text-muted-foreground">{l.dueComment}</span>}
                {mayEdit && l.status !== PurchaseLotStatus.COMPLETED && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}>
                        <CalendarIcon className="size-3.5" /> {l.dueAt ? "Изменить" : "Задать"}
                    </Button>
                )}
            </span>
        );
    }
    return (
        <span className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${FIELD_CLASS} w-auto`} value={due} onChange={(e) => setDue(e.target.value)} />
            <input className={`${FIELD_CLASS} w-auto min-w-48 flex-1`} placeholder="Почему такой срок" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button
                size="sm"
                disabled={state.busy}
                onClick={async () => {
                    if (await state.updateLot(l, { case: "deadline", value: { dueAt: ts(due), dueComment: comment } } as LotPatch)) setEditing(false);
                }}
            >
                Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Отмена
            </Button>
        </span>
    );
};

/** Remarks left by a transfer from a plan or registry: what may be loaded
 *  wrong. Whoever oversees the purchase marks them checked or edits them. */
const ReviewNote: FC<{ state: PurchaseV3State; l: PurchaseLot; mayEdit: boolean }> = ({ state, l, mayEdit }) => {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(l.reviewNote);
    if (!l.reviewNote) return null;
    const lines = l.reviewNote.split("\n").filter(Boolean);
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <p className="flex items-center gap-2 font-medium">
                <TriangleAlertIcon className="size-4" /> Проверьте после переноса ({lines.length})
            </p>
            <p className="text-xs opacity-80">Закупка перенесена из плана или реестра — эти поля могли загрузиться неверно. Сверьте с исходником и исправьте в карточке.</p>
            {editing ? (
                <textarea className={`${FIELD_CLASS} text-foreground`} rows={Math.min(10, lines.length + 2)} value={text} onChange={(e) => setText(e.target.value)} />
            ) : (
                <ul className="list-disc space-y-1 pl-5">
                    {lines.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </ul>
            )}
            {mayEdit && (
                <div className="flex flex-wrap gap-2">
                    {editing ? (
                        <>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={state.busy}
                                onClick={async () => {
                                    if (await state.updateLot(l, { case: "review", value: { reviewNote: text } } as LotPatch)) setEditing(false);
                                }}
                            >
                                Сохранить
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                                Отмена
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={state.busy}
                                onClick={() => state.updateLot(l, { case: "review", value: { reviewNote: "" } } as LotPatch)}
                            >
                                <CheckCircle2Icon className="size-4" /> Проверено — убрать отметку
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                                Изменить
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/** What the user does now: what is missing, the stage's fields, the decision. */
const YourStep: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const moves = l.allowed?.moves ?? [];
    const stage = LOT_STAGES[lotStage(l.status)];
    const needsAssignee = l.status === PurchaseLotStatus.FORMING || l.status === PurchaseLotStatus.APPROVED;
    const [assignee, setAssignee] = useState(l.assigneeUuid);
    const [comment, setComment] = useState("");
    const [returning, setReturning] = useState(false);
    useEffect(() => {
        if (needsAssignee && moves.length > 0) state.loadEmployees(l.implementingDepartment);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [l.id, l.status]);
    const checklist = lotChecklist(l, assignee !== "");
    const ready = checklist.every((c) => c.done);
    const employees = state.employees[l.implementingDepartment] ?? [];
    const canForward = moves.includes(PurchaseMove.FORWARD);
    const canReturn = moves.includes(PurchaseMove.RETURN);
    const hasForm = Boolean(l.allowed?.edit) && STAGE_FORM.includes(l.status);
    const showChecklist = l.status !== PurchaseLotStatus.BUDGET_COMMISSION && checklist.length > 0;
    const formStep = showChecklist ? 2 : 1;
    const decisionStep = formStep + (hasForm ? 1 : 0);

    return (
        <Card className="gap-4 border-primary/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-heading text-sm font-semibold">Ваш шаг: {stage?.label}</p>
                <TermChip label="срок этапа" due={l.stageDue} />
            </div>

            {l.status === PurchaseLotStatus.BUDGET_COMMISSION ? (
                <p className="text-sm text-muted-foreground">
                    Решение — включить в ПФХД, отклонить или вернуть — принимается протоколом на вкладке «Комиссия и ПФХД». Здесь закупку можно только вернуть экономистам.
                </p>
            ) : (
                checklist.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">1. Что нужно сделать</p>
                        {checklist.map((c) => (
                            <span key={c.label} className={cn("flex items-start gap-2 text-sm", c.done && "text-muted-foreground")}>
                                {c.done ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleIcon className="mt-0.5 size-4 shrink-0" />}
                                {c.label}
                            </span>
                        ))}
                    </div>
                )
            )}

            {needsAssignee && canForward && (
                <Field label={l.status === PurchaseLotStatus.APPROVED ? "Кто составит ТЗ" : "Исполнитель: подготовит характеристики и КП"}>
                    <select className={FIELD_CLASS} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                        <option value="">— выберите сотрудника отдела —</option>
                        {employees.map((e) => (
                            <option key={e.uuid} value={e.uuid}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                </Field>
            )}

            {hasForm && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{formStep}. Заполните и сохраните</p>
                    {/* key: the form starts over from what was saved */}
                    <StageForm key={`${l.id}-${l.status}-${l.updatedAt?.seconds}`} state={state} l={l} />
                </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">{decisionStep}. Решение</p>
                {returning && (
                    <textarea
                        className={FIELD_CLASS}
                        rows={2}
                        autoFocus
                        placeholder="Почему возвращаете — увидит предыдущий этап"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                )}
                <div className="flex flex-wrap gap-2">
                    {canForward && !returning && (
                        <Button size="sm" disabled={state.busy || !ready} onClick={() => state.moveLot(l, PurchaseMove.FORWARD, "", needsAssignee ? assignee : "")}>
                            {LOT_FORWARD[l.status] ?? "Продолжить"} <ArrowRightIcon className="size-4" />
                        </Button>
                    )}
                    {canReturn && !returning && (
                        <Button size="sm" variant="outline" onClick={() => setReturning(true)}>
                            <Undo2Icon className="size-4" /> Вернуть на прошлый этап
                        </Button>
                    )}
                    {returning && (
                        <>
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={state.busy || !comment.trim()}
                                onClick={async () => {
                                    if (await state.moveLot(l, PurchaseMove.RETURN, comment.trim())) setReturning(false);
                                }}
                            >
                                Вернуть
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReturning(false)}>
                                Отмена
                            </Button>
                        </>
                    )}
                </div>
                {canForward && !ready && !returning && <p className="text-xs text-muted-foreground">Кнопка станет доступна, когда будут выполнены все пункты выше.</p>}
                {canForward && ready && !returning && <p className="text-xs text-muted-foreground">Дальше: {nextStageLabel(l)}.</p>}
            </div>
        </Card>
    );
};

/** Somebody else's turn: who and until when. */
const Waiting: FC<{ l: PurchaseLot }> = ({ l }) => {
    const stage = LOT_STAGES[lotStage(l.status)];
    if (!stage) return null;
    const who = stage.role === PurchaseRole.ASSIGNEE && l.assigneeName ? `Исполнитель — ${l.assigneeName}` : ROLE_LABEL[stage.role];
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <HourglassIcon className="size-4 text-muted-foreground" />
            <span>
                Этап: <strong>{stage.label}</strong>
            </span>
            <span>
                Ответственный: <strong>{who}</strong>
            </span>
            <TermChip label="срок этапа" due={l.stageDue} />
        </div>
    );
};

export const LotDetail: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => {
    const moves = l.allowed?.moves ?? [];
    const fullEdit = state.can(PurchasePermission.LOT_FULL_EDIT);
    const [editing, setEditing] = useState(false);
    const mayEditDeadline = moves.length > 0 || state.can(PurchasePermission.LOT_MANAGE) || fullEdit;

    return (
        <div className="flex flex-col gap-4">
            <Section title={`Закупка №${l.id}`} action={<div className="flex items-center gap-2"><LotBadge l={l} />{fullEdit && <Button size="sm" variant={editing ? "secondary" : "outline"} onClick={() => setEditing((v) => !v)}>{editing ? "Закрыть редактор" : "Редактировать"}</Button>}</div>}>
                <p className="text-base font-medium break-words">{l.title}</p>
                <Facts
                    items={[
                        ["Тип", `${ITEM_TYPE_LABEL[l.itemType]}, ${qty(l.quantity)} ${l.unit}`],
                        ["Реализующий отдел", state.departmentName(l.implementingDepartment)],
                        ["Направление", state.curator(l.curatorId)?.title],
                        ["Исполнитель", l.assigneeName],
                        ["Стоимость", l.totalAmount > 0n ? rub(l.totalAmount) : ""],
                        ["На этапе с", l.stageSince && `${formatDate(l.stageSince)}${l.stageDue ? `, норматив — до ${formatDate(l.stageDue)}` : ""}`],
                        ["Срок закупки", <Deadline key="due" state={state} l={l} mayEdit={mayEditDeadline} />],
                    ]}
                />
                {l.lastComment && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">💬 {l.lastComment}</p>}
                {l.status !== PurchaseLotStatus.RESERVED && <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Весь маршрут закупки</summary>
                    <div className="mt-3">
                        <LotRoute status={l.status} />
                    </div>
                </details>}
            </Section>

            <ReviewNote key={`${l.id}-${l.reviewNote.length}`} state={state} l={l} mayEdit={mayEditDeadline} />

            {editing && fullEdit ? <FullEditPanel key={`${l.id}-${l.updatedAt?.seconds}`} state={state} l={l} /> : moves.length > 0 ? <YourStep key={`${l.id}-${l.status}`} state={state} l={l} /> : <Waiting l={l} />}

            <Composition state={state} l={l} />
            <Quotations state={state} l={l} />
            {/* key: the document kinds follow the stage */}
            <Documents key={l.status} state={state} l={l} />

            {(l.specification || l.curatorJustification || l.okpd2 || l.nmck > 0n || l.planYear || l.techSpec || l.description) && (
                <Section title="Сведения">
                    <Facts
                        items={[
                            ["Описание", l.description && <span className="whitespace-pre-wrap">{l.description}</span>],
                            ["Характеристики", l.specification && <span className="whitespace-pre-wrap">{l.specification}</span>],
                            ["Обоснование проректора", l.curatorJustification],
                            ["ОКПД2 / КТРУ / ОКВЭД2", l.okpd2 && `${l.okpd2} / ${l.ktru || "—"} / ${l.okved || "—"}${l.codesAuto ? " (подставлены автоматически)" : ""}`],
                            ["Источник финансирования", l.fundingSource ? FUNDING_LABEL[l.fundingSource] : ""],
                            ["КОСГУ", l.kosgu],
                            ["НМЦК", l.nmck > 0n ? rub(l.nmck) : ""],
                            ["Заключение экономиста", l.economistComment],
                            ["ПФХД", l.planYear ? `${l.planYear}, ${PLAN_LABEL[l.planType].toLowerCase()}` : ""],
                            ["Решение комиссии", l.commissionComment],
                            ["ТЗ", l.techSpec && <span className="whitespace-pre-wrap">{l.techSpec}</span>],
                            ["Конечная стоимость", l.finalCost > 0n ? `${rub(l.finalCost)}${l.finalCostComment ? ` — ${l.finalCostComment}` : ""}` : ""],
                            ["Закон, способ", l.law ? `${LAW_LABEL[l.law]}, ${METHOD_LABEL[l.method].toLowerCase()}` : ""],
                            ["Извещение", l.noticeNumber && `${l.noticeNumber} от ${formatDate(l.noticeAt)}`],
                            ["Поставщик", l.supplier && `${l.supplier}${l.supplierInn ? `, ИНН ${l.supplierInn}` : ""}`],
                            ["Контракт", l.contractNumber && `№ ${l.contractNumber} от ${formatDate(l.contractAt)} на ${rub(l.contractAmount)}`],
                            ["Сумма контракта", !l.contractNumber && l.contractAmount > 0n ? rub(l.contractAmount) : ""],
                            ["Срок исполнения контракта", l.deliveryDue ? formatDate(l.deliveryDue) : ""],
                            ["Поставлено", l.deliveredAt ? formatDate(l.deliveredAt) : ""],
                            ["Принято", l.acceptedAt ? `${formatDate(l.acceptedAt)}${l.acceptanceComment ? ` — ${l.acceptanceComment}` : ""}` : ""],
                            ["Инвентарные номера", l.inventoryNumbers.join(", ")],
                            ["Завершена", l.completedAt ? formatDate(l.completedAt) : ""],
                        ]}
                    />
                </Section>
            )}

            <SignOffs list={l.signOffs} />
            <Section title="История">
                <LogList logs={l.logs} />
            </Section>
        </div>
    );
};
