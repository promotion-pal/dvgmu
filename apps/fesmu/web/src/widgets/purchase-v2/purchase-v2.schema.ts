import { PermissionSection } from "@/shared/config/permissions";
import {
    PurchaseActorRole,
    PurchaseFundingSource,
    PurchaseItemType,
    PurchaseLotStatus,
    PurchasePlanType,
    PurchaseRequestStatus,
} from "@fesmu/contract/fesmu/enum/v2/purchase.enum_pb";

export { PurchaseActorRole, PurchaseFundingSource, PurchaseItemType, PurchaseLotStatus, PurchasePlanType, PurchaseRequestStatus };
export { PurchaseLotAction, PurchaseRequestAction } from "@fesmu/contract/fesmu/enum/v2/purchase.enum_pb";

/** Money is in kopecks, as the server sends it. */
export interface PurchaseApproval {
    role: PurchaseActorRole;
    name: string;
    comment: string;
    at?: Date;
}

export interface PurchaseLog {
    id: string;
    actorRole: PurchaseActorRole;
    actorName: string;
    action: string;
    text: string;
    comment: string;
    createdAt?: Date;
}

export interface PurchaseCurator {
    id: string;
    name: string;
    position: string;
    /** The portal user who is this vice-rector; empty until bound. */
    userUuid: string;
    userName: string;
}

/** An MDM department and the vice-rector over it. */
export interface PurchaseDepartment {
    id: number;
    name: string;
    /** Empty until the administrator assigns one. */
    curatorId: string;
}

/** Which department carries out purchases whose ОКПД2 starts with okpd2Prefix. */
export interface PurchaseCategory {
    id: string;
    name: string;
    okpd2Prefix: string;
    department: number;
}

/** The signed-in user as the flow sees them. */
export interface PurchaseMe {
    uuid: string;
    name: string;
    /** MDM department; 0 when the profile has none. */
    department: number;
    /** The vice-rector bound to this user; empty if none. */
    curatorId: string;
    admin: boolean;
}

export interface PurchaseEmployee {
    uuid: string;
    name: string;
    department: number;
}

export interface PurchaseRequest {
    id: string;
    title: string;
    quantity: number;
    unit: string;
    description: string;
    department: string;
    /** The author's MDM department — whose head reviews it. */
    departmentId: number;
    /** The department that carries it out; 0 until the vice-rector sends it there. */
    implementingDepartment: number;
    /** The implementing department the title suggests; 0 if none. */
    suggestedDepartment: number;
    itemType: PurchaseItemType;
    /** The vice-rector over the author's department, set when the head approves. */
    curatorId: string;
    status: PurchaseRequestStatus;
    authorName: string;
    authorUuid: string;
    lotId?: string;
    mergedIntoId?: string;
    approvals: PurchaseApproval[];
    lastComment: string;
    logs: PurchaseLog[];
    createdAt?: Date;
}

export interface PurchaseQuotation {
    id: string;
    supplier: string;
    unitPrice: number;
    note: string;
    fileName: string;
    fileSize: number;
    createdBy: string;
    createdAt?: Date;
}

export interface PurchaseLot {
    id: string;
    title: string;
    description: string;
    itemType: PurchaseItemType;
    /** The vice-rector over the implementing department. */
    curatorId: string;
    implementingDepartment: number;
    /** Who prepares it; empty until the head assigns someone. */
    assigneeUuid: string;
    assigneeName: string;
    status: PurchaseLotStatus;
    quantity: number;
    unit: string;
    comment: string;
    okpd2: string;
    ktru: string;
    okved: string;
    codesAuto: boolean;
    fundingSource: PurchaseFundingSource;
    kosgu: string;
    economistComment: string;
    planType: PurchasePlanType;
    planYear: number;
    commissionComment: string;
    unitPrice: number;
    minUnitPrice: number;
    /** What the purchase costs in the plan: the economist's НМЦК, or calcAmount until set. */
    totalAmount: number;
    /** НМЦК the economist entered; 0 until then. */
    nmck: number;
    /** Average offer price × quantity. */
    calcAmount: number;
    requestIds: string[];
    quotations: PurchaseQuotation[];
    approvals: PurchaseApproval[];
    lastComment: string;
    logs: PurchaseLog[];
    createdBy: string;
    createdAt?: Date;
}

export interface PurchaseOverview {
    requests: PurchaseRequest[];
    lots: PurchaseLot[];
    curators: PurchaseCurator[];
    departments: PurchaseDepartment[];
    categories: PurchaseCategory[];
    me: PurchaseMe;
}

/** Who the page acts as: the "view as" switch. Name and vice-rector count
 * only for an administrator; others are who MDM and the directory say. */
export interface PurchaseActor {
    role: PurchaseActorRole;
    name: string;
    curatorId: string;
}

export interface PurchaseRequestForm {
    title: string;
    itemType: PurchaseItemType;
    quantity: string;
    unit: string;
    description: string;
    /** Administrator only (testing): file for another department; 0 — own. */
    departmentId: number;
}

export interface PurchaseLotForm {
    title: string;
    description: string;
    quantity: string;
    unit: string;
    comment: string;
    okpd2: string;
    ktru: string;
    okved: string;
    fundingSource: PurchaseFundingSource;
    kosgu: string;
    /** НМЦК, ₽ as typed. */
    nmck: string;
    economistComment: string;
    planType: PurchasePlanType;
    planYear: string;
    commissionComment: string;
}

export interface PurchaseQuotationForm {
    supplier: string;
    unitPrice: string;
    note: string;
    file?: File;
}

/* ───────────── labels ───────────── */

export const ACTOR_ROLES = [
    PurchaseActorRole.EMPLOYEE,
    PurchaseActorRole.DEPT_HEAD,
    PurchaseActorRole.VICE_RECTOR,
    PurchaseActorRole.ECONOMIST,
    PurchaseActorRole.BUDGET_COMMISSION,
] as const;

/** Раздел доступа каждой роли: действовать в роли — право на изменение раздела
 * (как в api, internal/modules/purchase/access.go). */
export const ROLE_SECTION: Record<PurchaseActorRole, PermissionSection> = {
    [PurchaseActorRole.UNSPECIFIED]: PermissionSection.UNSPECIFIED,
    [PurchaseActorRole.EMPLOYEE]: PermissionSection.PURCHASE_REQUEST,
    [PurchaseActorRole.DEPT_HEAD]: PermissionSection.PURCHASE_HEAD,
    [PurchaseActorRole.VICE_RECTOR]: PermissionSection.PURCHASE_VICE_RECTOR,
    [PurchaseActorRole.ECONOMIST]: PermissionSection.PURCHASE_ECONOMIST,
    [PurchaseActorRole.BUDGET_COMMISSION]: PermissionSection.PURCHASE_COMMISSION,
};

export const ACTOR_LABEL: Record<PurchaseActorRole, string> = {
    [PurchaseActorRole.UNSPECIFIED]: "—",
    [PurchaseActorRole.EMPLOYEE]: "Сотрудник",
    [PurchaseActorRole.DEPT_HEAD]: "Начальник отдела",
    [PurchaseActorRole.VICE_RECTOR]: "Курирующий проректор",
    [PurchaseActorRole.ECONOMIST]: "Экономический отдел",
    [PurchaseActorRole.BUDGET_COMMISSION]: "Бюджетная комиссия",
};

type Tone = "gray" | "blue" | "amber" | "green" | "red";

export const TONE_CLASS: Record<Tone, string> = {
    gray: "bg-muted text-muted-foreground border-border",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

export const REQUEST_STATUS: Record<PurchaseRequestStatus, { label: string; tone: Tone }> = {
    [PurchaseRequestStatus.UNSPECIFIED]: { label: "—", tone: "gray" },
    [PurchaseRequestStatus.HEAD_REVIEW]: { label: "У начальника отдела", tone: "amber" },
    [PurchaseRequestStatus.REWORK]: { label: "На доработке", tone: "amber" },
    [PurchaseRequestStatus.VICE_RECTOR_REVIEW]: { label: "У проректора", tone: "blue" },
    [PurchaseRequestStatus.IN_LOT]: { label: "В закупке", tone: "green" },
    [PurchaseRequestStatus.REJECTED]: { label: "Отклонена", tone: "red" },
    [PurchaseRequestStatus.MERGED]: { label: "Объединена", tone: "gray" },
    [PurchaseRequestStatus.IMPLEMENTER_REVIEW]: { label: "В реализующем отделе", tone: "blue" },
};

export const ITEM_TYPE_LABEL: Record<PurchaseItemType, string> = {
    [PurchaseItemType.UNSPECIFIED]: "—",
    [PurchaseItemType.PRODUCT]: "Товар",
    [PurchaseItemType.SERVICE]: "Услуга",
};

export const LOT_STATUS: Record<PurchaseLotStatus, { label: string; tone: Tone }> = {
    [PurchaseLotStatus.UNSPECIFIED]: { label: "—", tone: "gray" },
    [PurchaseLotStatus.FORMING]: { label: "Формируется", tone: "blue" },
    [PurchaseLotStatus.SPECIFICATION]: { label: "У исполнителя", tone: "blue" },
    [PurchaseLotStatus.IMPLEMENTER_CHECK]: { label: "На проверке", tone: "amber" },
    [PurchaseLotStatus.VICE_RECTOR_REVIEW]: { label: "У проректора", tone: "amber" },
    [PurchaseLotStatus.ECONOMIST_REVIEW]: { label: "Экономический отдел", tone: "amber" },
    [PurchaseLotStatus.BUDGET_COMMISSION]: { label: "Бюджетная комиссия", tone: "amber" },
    [PurchaseLotStatus.APPROVED]: { label: "В ПФХД", tone: "green" },
    [PurchaseLotStatus.REJECTED]: { label: "Отклонена", tone: "red" },
};

export const FUNDING_LABEL: Record<PurchaseFundingSource, string> = {
    [PurchaseFundingSource.UNSPECIFIED]: "Не указан",
    [PurchaseFundingSource.STATE_TASK]: "Субсидия на госзадание",
    [PurchaseFundingSource.TARGET_SUBSIDY]: "Целевая субсидия",
    [PurchaseFundingSource.INCOME]: "Приносящая доход деятельность",
    [PurchaseFundingSource.OMS]: "Средства ОМС",
};

export const PLAN_TYPE_LABEL: Record<PurchasePlanType, string> = {
    [PurchasePlanType.UNSPECIFIED]: "Не выбрано",
    [PurchasePlanType.PLANNED]: "Плановая",
    [PurchasePlanType.UNPLANNED]: "Внеплановая",
};

/** The steps a request and its purchase pass, for the timeline. */
export const FLOW_STEPS = [
    { key: "employee", label: "Заявка сотрудника" },
    { key: "head", label: "Начальник отдела" },
    { key: "curator", label: "Курирующий проректор" },
    { key: "forming", label: "Реализующий отдел: объединение" },
    { key: "spec", label: "Исполнитель: характеристики и КП" },
    { key: "check", label: "Реализующий начальник: проверка" },
    { key: "lotCurator", label: "Проректор: согласование закупки" },
    { key: "economist", label: "Экономисты: бюджет и НМЦК" },
    { key: "commission", label: "Бюджетная комиссия → ПФХД" },
] as const;

/** Which step is current; FLOW_STEPS.length when decided, -1 when stopped. */
export const requestStep = (r: PurchaseRequest, lot?: PurchaseLot): number => {
    if (lot) return lotStep(lot);
    switch (r.status) {
        case PurchaseRequestStatus.REWORK:
            return 0;
        case PurchaseRequestStatus.HEAD_REVIEW:
            return 1;
        case PurchaseRequestStatus.VICE_RECTOR_REVIEW:
            return 2;
        case PurchaseRequestStatus.IMPLEMENTER_REVIEW:
            return 3;
        default:
            return -1;
    }
};

export const lotStep = (l: PurchaseLot): number => {
    switch (l.status) {
        case PurchaseLotStatus.FORMING:
            return 3;
        case PurchaseLotStatus.SPECIFICATION:
            return 4;
        case PurchaseLotStatus.IMPLEMENTER_CHECK:
            return 5;
        case PurchaseLotStatus.VICE_RECTOR_REVIEW:
            return 6;
        case PurchaseLotStatus.ECONOMIST_REVIEW:
            return 7;
        case PurchaseLotStatus.BUDGET_COMMISSION:
            return 8;
        case PurchaseLotStatus.APPROVED:
            return 9;
        default:
            return -1;
    }
};

/* ───────────── money ───────────── */

const rubFormat = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 });
const rubShortFormat = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });

export const rub = (kop: number) => rubFormat.format(kop / 100);
/** "1,2 млн ₽" for tiles and bars. */
export const rubShort = (kop: number) => `${rubShortFormat.format(kop / 100)} ₽`;
export const qty = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** "12 345,67" or "12345.67" → kopecks; NaN when it isn't a price. */
export const parseRub = (text: string): number => {
    const clean = text.replace(/\s|₽/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Math.round(Number(clean) * 100);
};

/** Kopecks as typed into a ₽ field: "425000,00"; empty for 0. */
export const rubInput = (kop: number) => (kop ? (kop / 100).toFixed(2).replace(".", ",") : "");

export interface NmckCalc {
    /** Each offer's price × quantity. */
    rows: { supplier: string; unitPrice: number; amount: number }[];
    minAmount: number;
    avgAmount: number;
    /** Coefficient of variation of unit prices, %; undefined with fewer than two offers. */
    variation?: number;
}

/** НМЦК by comparable market prices: the offers × quantity, their minimum and
 * average, and how much the prices spread (they count as uniform at ≤ 33 %). */
export const nmckCalc = (l: PurchaseLot): NmckCalc => {
    const rows = l.quotations.map((q) => ({ supplier: q.supplier, unitPrice: q.unitPrice, amount: Math.round(q.unitPrice * l.quantity) }));
    const prices = l.quotations.map((q) => q.unitPrice);
    let variation: number | undefined;
    if (prices.length > 1) {
        const mean = prices.reduce((a, p) => a + p, 0) / prices.length;
        const sd = Math.sqrt(prices.reduce((a, p) => a + (p - mean) ** 2, 0) / (prices.length - 1));
        variation = mean ? (sd / mean) * 100 : 0;
    }
    return {
        rows,
        minAmount: Math.round(l.minUnitPrice * l.quantity),
        avgAmount: l.calcAmount,
        variation,
    };
};

export const NMCK_UNIFORM_MAX = 33;

export const parseQty = (text: string): number => {
    const clean = text.replace(/\s/g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
};

export const formatDateTime = (date?: Date) =>
    date ? date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/* ───────────── finance stats ───────────── */

/** The money stages, in flow order; each owns a fixed chart color. */
export const MONEY_STAGES = [
    { key: "forming", label: "Реализующий отдел", color: "bg-[#2a78d6] dark:bg-[#3987e5]" },
    { key: "curator", label: "У проректора", color: "bg-[#eb6834] dark:bg-[#d95926]" },
    { key: "economist", label: "Экономисты", color: "bg-[#1baf7a] dark:bg-[#199e70]" },
    { key: "commission", label: "Бюджетная комиссия", color: "bg-[#eda100] dark:bg-[#c98500]" },
    { key: "planned", label: "ПФХД: плановые", color: "bg-[#e87ba4] dark:bg-[#d55181]" },
    { key: "unplanned", label: "ПФХД: внеплановые", color: "bg-[#008300] dark:bg-[#008300]" },
] as const;

export type MoneyStage = (typeof MONEY_STAGES)[number]["key"];

export const moneyStageOf = (l: PurchaseLot): MoneyStage | undefined => {
    switch (l.status) {
        case PurchaseLotStatus.FORMING:
        case PurchaseLotStatus.SPECIFICATION:
        case PurchaseLotStatus.IMPLEMENTER_CHECK:
            return "forming";
        case PurchaseLotStatus.VICE_RECTOR_REVIEW:
            return "curator";
        case PurchaseLotStatus.ECONOMIST_REVIEW:
            return "economist";
        case PurchaseLotStatus.BUDGET_COMMISSION:
            return "commission";
        case PurchaseLotStatus.APPROVED:
            return l.planType === PurchasePlanType.UNPLANNED ? "unplanned" : "planned";
        default:
            return undefined;
    }
};

export type StageSums = Record<MoneyStage, number>;

export const emptySums = (): StageSums => ({ forming: 0, curator: 0, economist: 0, commission: 0, planned: 0, unplanned: 0 });

export const sumOf = (s: StageSums) => MONEY_STAGES.reduce((acc, st) => acc + s[st.key], 0);

export interface CuratorStats {
    curator: PurchaseCurator;
    sums: StageSums;
    total: number;
    lots: number;
    rejected: number;
    requestsWaiting: number;
}

/** Money per vice-rector and stage; rejected purchases are counted apart. */
export const curatorStats = (overview: PurchaseOverview): CuratorStats[] =>
    overview.curators.map((curator) => {
        const sums = emptySums();
        let lots = 0;
        let rejected = 0;
        for (const l of overview.lots) {
            if (l.curatorId !== curator.id) continue;
            lots++;
            const stage = moneyStageOf(l);
            if (stage) sums[stage] += l.totalAmount;
            else rejected += l.totalAmount;
        }
        const requestsWaiting = overview.requests.filter(
            (r) =>
                r.curatorId === curator.id &&
                (r.status === PurchaseRequestStatus.VICE_RECTOR_REVIEW || r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW),
        ).length;
        return { curator, sums, total: sumOf(sums), lots, rejected, requestsWaiting };
    });

export const emptyRequestForm = (): PurchaseRequestForm => ({
    title: "",
    itemType: PurchaseItemType.PRODUCT,
    quantity: "1",
    // Left to the server: "шт." for a product, "усл." for a service.
    unit: "",
    description: "",
    departmentId: 0,
});

export const requestForm = (r: PurchaseRequest): PurchaseRequestForm => ({
    title: r.title,
    itemType: r.itemType,
    quantity: String(r.quantity),
    // Re-derived from the type, so switching товар ↔ услуга fixes the unit too.
    unit: "",
    description: r.description,
    departmentId: r.departmentId,
});

export const lotForm = (l: PurchaseLot): PurchaseLotForm => ({
    title: l.title,
    description: l.description,
    quantity: String(l.quantity),
    unit: "",
    comment: l.comment,
    okpd2: l.okpd2,
    ktru: l.ktru,
    okved: l.okved,
    fundingSource: l.fundingSource,
    kosgu: l.kosgu,
    // Until the economist sets one, the field starts at the average-based amount.
    nmck: rubInput(l.nmck || l.calcAmount),
    economistComment: l.economistComment,
    planType: l.planType,
    planYear: l.planYear ? String(l.planYear) : String(new Date().getFullYear() + 1),
    commissionComment: l.commissionComment,
});

/** The КТРУ catalog search on zakupki.gov.ru, for picking the exact position. */
export const ktruSearchUrl = (query: string) =>
    `https://zakupki.gov.ru/epz/ktru/search/results.html?searchString=${encodeURIComponent(query)}`;
