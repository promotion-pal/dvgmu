import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { PurchaseLot, PurchaseRequest } from "@fesmu/contract/fesmu/entity/v3/purchase.entity_pb";
import {
    PurchaseCommissionDecision,
    PurchaseDocumentKind,
    PurchaseFundingSource,
    PurchaseItemType,
    PurchaseLaw,
    PurchaseLotStatus,
    PurchaseMethod,
    PurchaseMove,
    PurchasePermission,
    PurchasePlanType,
    PurchaseRequestStatus,
    PurchaseRole,
} from "@fesmu/contract/fesmu/enum/v3/purchase.enum_pb";

export {
    PurchaseCommissionDecision,
    PurchaseDocumentKind,
    PurchaseFundingSource,
    PurchaseItemType,
    PurchaseLaw,
    PurchaseLotStatus,
    PurchaseMethod,
    PurchaseMove,
    PurchasePermission,
    PurchasePlanType,
    PurchaseRequestStatus,
    PurchaseRole,
};

type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export const TONE_CLASS: Record<Tone, string> = {
    gray: "bg-muted text-muted-foreground border-border",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
};

export const ROLE_LABEL: Record<PurchaseRole, string> = {
    [PurchaseRole.UNSPECIFIED]: "—",
    [PurchaseRole.EMPLOYEE]: "Сотрудник",
    [PurchaseRole.HEAD]: "Начальник отдела",
    [PurchaseRole.CURATOR]: "Курирующий проректор",
    [PurchaseRole.IMPLEMENTER_HEAD]: "Начальник реализующего отдела",
    [PurchaseRole.ASSIGNEE]: "Исполнитель",
    [PurchaseRole.ECONOMIST]: "Экономический отдел",
    [PurchaseRole.COMMISSION]: "Бюджетная комиссия",
    [PurchaseRole.CONTRACT_SERVICE]: "Контрактная служба",
    [PurchaseRole.PROCUREMENT]: "Отдел закупок",
    [PurchaseRole.ACCEPTANCE]: "Приёмка",
    [PurchaseRole.INVENTORY]: "Учёт инвентаря",
};

export const REQUEST_STATUS: Record<PurchaseRequestStatus, { label: string; tone: Tone }> = {
    [PurchaseRequestStatus.UNSPECIFIED]: { label: "—", tone: "gray" },
    [PurchaseRequestStatus.HEAD_REVIEW]: { label: "У начальника отдела", tone: "amber" },
    [PurchaseRequestStatus.REWORK]: { label: "На доработке", tone: "amber" },
    [PurchaseRequestStatus.CURATOR_REVIEW]: { label: "У проректора", tone: "blue" },
    [PurchaseRequestStatus.IMPLEMENTER_REVIEW]: { label: "В реализующем отделе", tone: "blue" },
    [PurchaseRequestStatus.IN_PURCHASE]: { label: "В закупке", tone: "green" },
    [PurchaseRequestStatus.MERGED]: { label: "Объединена", tone: "gray" },
    [PurchaseRequestStatus.REJECTED]: { label: "Отклонена", tone: "red" },
};

/** The purchase route in order, as the server has it (api route.go): who
 *  acts, which phase it belongs to. */
export const LOT_STAGES: { status: PurchaseLotStatus; label: string; role: PurchaseRole; phase: 1 | 2 | 3 }[] = [
    { status: PurchaseLotStatus.FORMING, label: "Формирование, исполнитель", role: PurchaseRole.IMPLEMENTER_HEAD, phase: 1 },
    { status: PurchaseLotStatus.SPECIFICATION, label: "Характеристики и КП", role: PurchaseRole.ASSIGNEE, phase: 1 },
    { status: PurchaseLotStatus.SPECIFICATION_CHECK, label: "Проверка начальником", role: PurchaseRole.IMPLEMENTER_HEAD, phase: 1 },
    { status: PurchaseLotStatus.CURATOR_REVIEW, label: "Согласование проректором", role: PurchaseRole.CURATOR, phase: 1 },
    { status: PurchaseLotStatus.ECONOMIST_REVIEW, label: "Бюджет и НМЦК", role: PurchaseRole.ECONOMIST, phase: 1 },
    { status: PurchaseLotStatus.BUDGET_COMMISSION, label: "Бюджетная комиссия", role: PurchaseRole.COMMISSION, phase: 1 },
    { status: PurchaseLotStatus.APPROVED, label: "Поручение ТЗ", role: PurchaseRole.IMPLEMENTER_HEAD, phase: 2 },
    { status: PurchaseLotStatus.TECH_SPEC, label: "Техническое задание", role: PurchaseRole.ASSIGNEE, phase: 2 },
    { status: PurchaseLotStatus.TECH_SPEC_CHECK, label: "Проверка ТЗ", role: PurchaseRole.IMPLEMENTER_HEAD, phase: 2 },
    { status: PurchaseLotStatus.TECH_SPEC_CURATOR, label: "Подтверждение ТЗ проректором", role: PurchaseRole.CURATOR, phase: 2 },
    { status: PurchaseLotStatus.FINAL_COST, label: "Конечная стоимость", role: PurchaseRole.ECONOMIST, phase: 2 },
    { status: PurchaseLotStatus.CONTRACT_SERVICE, label: "Закон и способ закупки", role: PurchaseRole.CONTRACT_SERVICE, phase: 2 },
    { status: PurchaseLotStatus.PROCUREMENT, label: "Передана в отдел закупок", role: PurchaseRole.PROCUREMENT, phase: 2 },
    { status: PurchaseLotStatus.TENDERING, label: "Проведение закупки", role: PurchaseRole.PROCUREMENT, phase: 3 },
    { status: PurchaseLotStatus.CONTRACTING, label: "Заключение контракта", role: PurchaseRole.PROCUREMENT, phase: 3 },
    { status: PurchaseLotStatus.DELIVERY, label: "Исполнение контракта", role: PurchaseRole.PROCUREMENT, phase: 3 },
    { status: PurchaseLotStatus.ACCEPTANCE, label: "Приёмка", role: PurchaseRole.ACCEPTANCE, phase: 3 },
    { status: PurchaseLotStatus.INVENTORY, label: "Постановка на учёт", role: PurchaseRole.INVENTORY, phase: 3 },
];

export const PHASE_LABEL: Record<1 | 2 | 3, string> = {
    1: "I. Планирование",
    2: "II. Подготовка",
    3: "III. Исполнение",
};

export const lotStage = (status: PurchaseLotStatus) => LOT_STAGES.findIndex((s) => s.status === status);

export const LOT_STATUS = (status: PurchaseLotStatus): { label: string; tone: Tone } => {
    if (status === PurchaseLotStatus.COMPLETED) return { label: "Завершена", tone: "green" };
    if (status === PurchaseLotStatus.REJECTED) return { label: "Отклонена комиссией", tone: "red" };
    const stage = LOT_STAGES[lotStage(status)];
    if (!stage) return { label: "—", tone: "gray" };
    const tone: Tone = status === PurchaseLotStatus.BUDGET_COMMISSION ? "violet" : stage.phase === 1 ? "blue" : stage.phase === 2 ? "amber" : "green";
    return { label: stage.label, tone };
};

/** Where FORWARD leads from the purchase's stage; a service skips the inventory. */
export const nextStageLabel = (l: PurchaseLot) => {
    if (l.status === PurchaseLotStatus.ACCEPTANCE && l.itemType === PurchaseItemType.SERVICE) return "закупка завершена";
    const next = LOT_STAGES[lotStage(l.status) + 1];
    return next ? next.label.toLowerCase() : "закупка завершена";
};

/** From APPROVED on the request has become a purchase proper. */
export const isActual = (l: PurchaseLot) => lotStage(l.status) >= lotStage(PurchaseLotStatus.APPROVED) || l.status === PurchaseLotStatus.COMPLETED;

export const REQUEST_NEXT: Partial<Record<PurchaseRequestStatus, string>> = {
    [PurchaseRequestStatus.REWORK]: "Отправить начальнику",
    [PurchaseRequestStatus.HEAD_REVIEW]: "Согласовать → проректору",
    [PurchaseRequestStatus.CURATOR_REVIEW]: "Согласовать → в реализующий отдел",
};

export const ITEM_TYPE_LABEL: Record<PurchaseItemType, string> = {
    [PurchaseItemType.UNSPECIFIED]: "—",
    [PurchaseItemType.PRODUCT]: "Товар",
    [PurchaseItemType.SERVICE]: "Услуга",
};

export const FUNDING_LABEL: Record<PurchaseFundingSource, string> = {
    [PurchaseFundingSource.UNSPECIFIED]: "Не указан",
    [PurchaseFundingSource.STATE_TASK]: "Субсидия на госзадание",
    [PurchaseFundingSource.TARGET_SUBSIDY]: "Целевая субсидия",
    [PurchaseFundingSource.INCOME]: "Приносящая доход деятельность",
    [PurchaseFundingSource.OMS]: "Средства ОМС",
};

export const PLAN_LABEL: Record<PurchasePlanType, string> = {
    [PurchasePlanType.UNSPECIFIED]: "—",
    [PurchasePlanType.PLANNED]: "Плановая",
    [PurchasePlanType.UNPLANNED]: "Внеплановая",
};

export const LAW_LABEL: Record<PurchaseLaw, string> = {
    [PurchaseLaw.UNSPECIFIED]: "Не выбран",
    [PurchaseLaw.FZ44]: "44-ФЗ",
    [PurchaseLaw.FZ223]: "223-ФЗ",
};

export const METHOD_LABEL: Record<PurchaseMethod, string> = {
    [PurchaseMethod.UNSPECIFIED]: "Не выбран",
    [PurchaseMethod.ELECTRONIC_AUCTION]: "Электронный аукцион",
    [PurchaseMethod.OPEN_TENDER]: "Открытый конкурс",
    [PurchaseMethod.QUOTATION_REQUEST]: "Запрос котировок",
    [PurchaseMethod.PROPOSAL_REQUEST]: "Запрос предложений (223-ФЗ)",
    [PurchaseMethod.SINGLE_SUPPLIER]: "У единственного поставщика",
    [PurchaseMethod.OTHER]: "Иной способ (223-ФЗ)",
};

export const DOCUMENT_LABEL: Record<PurchaseDocumentKind, string> = {
    [PurchaseDocumentKind.UNSPECIFIED]: "—",
    [PurchaseDocumentKind.SPECIFICATION]: "Характеристики",
    [PurchaseDocumentKind.TECH_SPEC]: "Техническое задание",
    [PurchaseDocumentKind.NOTICE]: "Извещение",
    [PurchaseDocumentKind.CONTRACT]: "Контракт",
    [PurchaseDocumentKind.SHIPPING]: "Накладная / УПД",
    [PurchaseDocumentKind.ACCEPTANCE_ACT]: "Акт приёмки",
    [PurchaseDocumentKind.OTHER]: "Прочее",
};

/** Which documents fit the purchase's stage, the first is suggested. */
export const stageDocuments = (status: PurchaseLotStatus): PurchaseDocumentKind[] => {
    switch (status) {
        case PurchaseLotStatus.SPECIFICATION:
        case PurchaseLotStatus.SPECIFICATION_CHECK:
            return [PurchaseDocumentKind.SPECIFICATION, PurchaseDocumentKind.OTHER];
        case PurchaseLotStatus.TECH_SPEC:
        case PurchaseLotStatus.TECH_SPEC_CHECK:
            return [PurchaseDocumentKind.TECH_SPEC, PurchaseDocumentKind.OTHER];
        case PurchaseLotStatus.PROCUREMENT:
        case PurchaseLotStatus.TENDERING:
            return [PurchaseDocumentKind.NOTICE, PurchaseDocumentKind.OTHER];
        case PurchaseLotStatus.CONTRACTING:
            return [PurchaseDocumentKind.CONTRACT, PurchaseDocumentKind.OTHER];
        case PurchaseLotStatus.DELIVERY:
            return [PurchaseDocumentKind.SHIPPING, PurchaseDocumentKind.CONTRACT, PurchaseDocumentKind.OTHER];
        case PurchaseLotStatus.ACCEPTANCE:
            return [PurchaseDocumentKind.ACCEPTANCE_ACT, PurchaseDocumentKind.SHIPPING, PurchaseDocumentKind.OTHER];
        default:
            return [PurchaseDocumentKind.OTHER];
    }
};

/* ───────────── formatting ───────────── */

const rubFormat = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 2 });
const rubShortFormat = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });

/** Kopecks → "12 345,67 ₽". */
export const rub = (kop: bigint | number) => rubFormat.format(Number(kop) / 100);
export const rubShort = (kop: bigint | number) => `${rubShortFormat.format(Number(kop) / 100)} ₽`;
export const qty = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** "12 345,67" → kopecks; NaN when it isn't a price. */
export const parseRub = (text: string): number => {
    const clean = text.replace(/\s|₽/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Math.round(Number(clean) * 100);
};

/** Kopecks as typed into a ₽ field: "425000,00"; empty for 0. */
export const rubInput = (kop: bigint | number) => (Number(kop) ? (Number(kop) / 100).toFixed(2).replace(".", ",") : "");

export const parseQty = (text: string): number => {
    const clean = text.replace(/\s/g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
};

export const toDate = (t?: Timestamp) => (t ? timestampDate(t) : undefined);

export const formatDateTime = (t?: Timestamp) =>
    t ? timestampDate(t).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const formatDate = (t?: Timestamp) => (t ? timestampDate(t).toLocaleDateString("ru-RU") : "—");

/** A timestamp as an <input type="date"> value. */
export const dateInput = (t?: Timestamp) => {
    if (!t) return "";
    const d = timestampDate(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** An <input type="date"> value as a local-noon date (no day shift by time zone). */
export const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`) : undefined);

export const fileSize = (bytes: bigint | number) => {
    const n = Number(bytes);
    return n < 1024 ? `${n} Б` : n < 1 << 20 ? `${Math.round(n / 1024)} КБ` : `${(n / (1 << 20)).toFixed(1)} МБ`;
};

export const requestKey = (r: PurchaseRequest) => `r${r.id}`;
export const lotKey = (l: PurchaseLot) => `l${l.id}`;

/** The user's task: they may act on the record now, and by their own rights —
 *  an administrator may act anywhere, but that does not make it their task. */
export const isTask = (x: PurchaseRequest | PurchaseLot) => (x.allowed?.moves.length ?? 0) > 0 && Boolean(x.allowed?.mine);

/* ───────────── what a stage asks for ───────────── */

/** What «Продолжить» says at each stage of a purchase. */
export const LOT_FORWARD: Partial<Record<PurchaseLotStatus, string>> = {
    [PurchaseLotStatus.FORMING]: "Передать исполнителю",
    [PurchaseLotStatus.SPECIFICATION]: "Отправить начальнику на проверку",
    [PurchaseLotStatus.SPECIFICATION_CHECK]: "Принять и передать проректору",
    [PurchaseLotStatus.CURATOR_REVIEW]: "Согласовать и передать экономистам",
    [PurchaseLotStatus.ECONOMIST_REVIEW]: "Утвердить НМЦК и передать на комиссию",
    [PurchaseLotStatus.APPROVED]: "Поручить ТЗ исполнителю",
    [PurchaseLotStatus.TECH_SPEC]: "Отправить ТЗ на проверку",
    [PurchaseLotStatus.TECH_SPEC_CHECK]: "Принять ТЗ и передать проректору",
    [PurchaseLotStatus.TECH_SPEC_CURATOR]: "Подтвердить ТЗ и передать экономистам",
    [PurchaseLotStatus.FINAL_COST]: "Утвердить стоимость и передать в контрактную службу",
    [PurchaseLotStatus.CONTRACT_SERVICE]: "Передать в отдел закупок",
    [PurchaseLotStatus.PROCUREMENT]: "Закупка размещена",
    [PurchaseLotStatus.TENDERING]: "Поставщик определён",
    [PurchaseLotStatus.CONTRACTING]: "Контракт заключён",
    [PurchaseLotStatus.DELIVERY]: "Поставлено — на приёмку",
    [PurchaseLotStatus.ACCEPTANCE]: "Принято",
    [PurchaseLotStatus.INVENTORY]: "Поставлено на учёт — завершить",
};

export interface CheckItem {
    label: string;
    done: boolean;
}

/** What must be done before «Продолжить», as the server checks it (api route.go
 *  lotReady). The assignee is picked in the card, so it comes in as a flag. */
export const lotChecklist = (l: PurchaseLot, assigneePicked: boolean): CheckItem[] => {
    const hasTechSpecFile = l.documents.some((d) => d.kind === PurchaseDocumentKind.TECH_SPEC);
    switch (l.status) {
        case PurchaseLotStatus.FORMING:
            return [{ label: "Выбрать исполнителя — он подготовит характеристики и КП", done: assigneePicked }];
        case PurchaseLotStatus.SPECIFICATION:
            return [
                { label: "Описать характеристики объекта закупки", done: l.specification.trim() !== "" },
                { label: `Прикрепить КП (рекомендуется не менее трёх, сейчас ${l.quotations.length})`, done: l.quotations.length > 0 },
            ];
        case PurchaseLotStatus.SPECIFICATION_CHECK:
            return [
                { label: "Проверить характеристики и КП исполнителя", done: true },
                { label: "Проверить код ОКПД2 (подставлен по справочнику)", done: l.okpd2 !== "" },
            ];
        case PurchaseLotStatus.CURATOR_REVIEW:
            return [{ label: "Написать обоснование закупки для бюджетной комиссии", done: l.curatorJustification.trim() !== "" }];
        case PurchaseLotStatus.ECONOMIST_REVIEW:
            return [
                { label: "Проверить ОКПД2", done: l.okpd2 !== "" },
                { label: "Указать источник финансирования", done: l.fundingSource !== PurchaseFundingSource.UNSPECIFIED },
                { label: "Указать КОСГУ", done: l.kosgu !== "" },
                { label: "Утвердить НМЦК (по умолчанию — средняя по КП)", done: l.nmck > 0n || l.calcAmount > 0n },
            ];
        case PurchaseLotStatus.APPROVED:
            return [{ label: "Выбрать, кто составит ТЗ", done: assigneePicked }];
        case PurchaseLotStatus.TECH_SPEC:
            return [{ label: "Написать ТЗ или прикрепить его файлом", done: l.techSpec.trim() !== "" || hasTechSpecFile }];
        case PurchaseLotStatus.TECH_SPEC_CHECK:
            return [{ label: "Проверить ТЗ исполнителя", done: true }];
        case PurchaseLotStatus.TECH_SPEC_CURATOR:
            return [{ label: "Ознакомиться с ТЗ и подтвердить", done: true }];
        case PurchaseLotStatus.FINAL_COST:
            return [{ label: "Указать конечную стоимость с учётом ТЗ", done: l.finalCost > 0n }];
        case PurchaseLotStatus.CONTRACT_SERVICE:
            return [
                { label: "Выбрать закон (44-ФЗ / 223-ФЗ)", done: l.law !== PurchaseLaw.UNSPECIFIED },
                { label: "Выбрать способ определения поставщика", done: l.method !== PurchaseMethod.UNSPECIFIED },
            ];
        case PurchaseLotStatus.PROCUREMENT:
            return l.method === PurchaseMethod.SINGLE_SUPPLIER
                ? [{ label: "Закупка у единственного поставщика — извещение не нужно", done: true }]
                : [{ label: "Указать номер извещения в ЕИС", done: l.noticeNumber !== "" }];
        case PurchaseLotStatus.TENDERING:
            return [{ label: "Указать поставщика по итогам закупки", done: l.supplier !== "" }];
        case PurchaseLotStatus.CONTRACTING:
            return [{ label: "Указать номер, дату и сумму контракта", done: l.contractNumber !== "" && l.contractAt !== undefined && l.contractAmount > 0n }];
        case PurchaseLotStatus.DELIVERY:
            return [{ label: "Указать дату поставки (оказания услуги)", done: l.deliveredAt !== undefined }];
        case PurchaseLotStatus.ACCEPTANCE:
            return [{ label: "Указать дату приёмки", done: l.acceptedAt !== undefined }];
        case PurchaseLotStatus.INVENTORY:
            return [{ label: "Указать инвентарные номера поставленного", done: l.inventoryNumbers.length > 0 }];
    }
    return [];
};

/* ───────────── terms ───────────── */

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from today to the date: negative — overdue. */
export const daysLeft = (t?: Timestamp) => {
    if (!t) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = timestampDate(t);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / DAY);
};

/** "осталось 3 дн." / "сегодня" / "просрочено на 5 дн.", with a tone. */
export const termText = (t?: Timestamp): { text: string; tone: Tone } | undefined => {
    const d = daysLeft(t);
    if (d === undefined) return undefined;
    if (d < 0) return { text: `просрочено на ${-d} дн.`, tone: "red" };
    if (d === 0) return { text: "срок сегодня", tone: "amber" };
    if (d <= 2) return { text: `осталось ${d} дн.`, tone: "amber" };
    return { text: `осталось ${d} дн.`, tone: "gray" };
};

/** The nearer of the stage's term and the purchase's control date. */
export const nearestDue = (x: PurchaseLot | PurchaseRequest): Timestamp | undefined => {
    const dates = [x.stageDue, "dueAt" in x ? x.dueAt : undefined].filter((t): t is Timestamp => t !== undefined);
    return dates.sort((a, b) => Number(a.seconds - b.seconds))[0];
};

export const isOverdue = (x: PurchaseLot | PurchaseRequest) => (daysLeft(nearestDue(x)) ?? 1) < 0;
