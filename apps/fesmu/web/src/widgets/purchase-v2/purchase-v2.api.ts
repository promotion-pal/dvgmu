import { createClient } from "@connectrpc/connect";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type {
    PurchaseApproval as ApprovalMessage,
    PurchaseLog as LogMessage,
    PurchaseLot as LotMessage,
    PurchaseRequest as RequestMessage,
} from "@dvgmu/contract/fesmu/entity/v2/purchase.entity_pb";
import { PurchaseService } from "@dvgmu/contract/fesmu/service/v2/purchase.service_pb";
import { connectTransport } from "@/shared/config/api";
import { parseQty, parseRub } from "./purchase-v2.schema";
import type {
    PurchaseActor,
    PurchaseApproval,
    PurchaseEmployee,
    PurchaseLog,
    PurchaseLot,
    PurchaseLotAction,
    PurchaseLotForm,
    PurchaseOverview,
    PurchasePlanType,
    PurchaseQuotationForm,
    PurchaseRequest,
    PurchaseRequestAction,
    PurchaseRequestForm,
} from "./purchase-v2.schema";

const client = createClient(PurchaseService, connectTransport);

/** What some purchase actions take besides the comment. */
export interface LotActionExtra {
    comment?: string;
    planType?: PurchasePlanType;
    planYear?: number;
    assignee?: { uuid: string; name: string };
}

const toDate = (timestamp?: Timestamp) => (timestamp ? timestampDate(timestamp) : undefined);
const idOrUndefined = (id: bigint) => (id ? id.toString() : undefined);

const fromApproval = (m: ApprovalMessage): PurchaseApproval => ({ role: m.role, name: m.name, comment: m.comment, at: toDate(m.at) });

const fromLog = (m: LogMessage): PurchaseLog => ({
    id: m.id.toString(),
    actorRole: m.actorRole,
    actorName: m.actorName,
    action: m.action,
    text: m.text,
    comment: m.comment,
    createdAt: toDate(m.createdAt),
});

const fromRequest = (m: RequestMessage): PurchaseRequest => ({
    id: m.id.toString(),
    title: m.title,
    quantity: m.quantity,
    unit: m.unit,
    description: m.description,
    department: m.department,
    departmentId: m.departmentId,
    implementingDepartment: m.implementingDepartment,
    suggestedDepartment: m.suggestedDepartment,
    itemType: m.itemType,
    curatorId: m.curatorId ? m.curatorId.toString() : "",
    status: m.status,
    authorName: m.authorName,
    authorUuid: m.authorUuid,
    lotId: idOrUndefined(m.lotId),
    mergedIntoId: idOrUndefined(m.mergedIntoId),
    approvals: m.approvals.map(fromApproval),
    lastComment: m.lastComment,
    logs: m.logs.map(fromLog),
    createdAt: toDate(m.createdAt),
});

const fromLot = (m: LotMessage): PurchaseLot => ({
    id: m.id.toString(),
    title: m.title,
    description: m.description,
    itemType: m.itemType,
    curatorId: m.curatorId.toString(),
    implementingDepartment: m.implementingDepartment,
    assigneeUuid: m.assigneeUuid,
    assigneeName: m.assigneeName,
    status: m.status,
    quantity: m.quantity,
    unit: m.unit,
    comment: m.comment,
    okpd2: m.okpd2,
    ktru: m.ktru,
    okved: m.okved,
    codesAuto: m.codesAuto,
    fundingSource: m.fundingSource,
    kosgu: m.kosgu,
    economistComment: m.economistComment,
    planType: m.planType,
    planYear: m.planYear,
    commissionComment: m.commissionComment,
    unitPrice: Number(m.unitPrice),
    minUnitPrice: Number(m.minUnitPrice),
    totalAmount: Number(m.totalAmount),
    nmck: Number(m.nmck),
    calcAmount: Number(m.calcAmount),
    requestIds: m.requestIds.map(String),
    quotations: m.quotations.map((q) => ({
        id: q.id.toString(),
        supplier: q.supplier,
        unitPrice: Number(q.unitPrice),
        note: q.note,
        fileName: q.fileName,
        fileSize: Number(q.fileSize),
        createdBy: q.createdBy,
        createdAt: toDate(q.createdAt),
    })),
    approvals: m.approvals.map(fromApproval),
    lastComment: m.lastComment,
    logs: m.logs.map(fromLog),
    createdBy: m.createdBy,
    createdAt: toDate(m.createdAt),
});

const actorMessage = (a: PurchaseActor) => ({ role: a.role, name: a.name.trim(), curatorId: BigInt(a.curatorId || 0) });

const requestFields = (v: PurchaseRequestForm) => ({
    title: v.title,
    itemType: v.itemType,
    quantity: parseQty(v.quantity),
    unit: v.unit,
    description: v.description,
});

/** The only place the page talks to the purchase service. */
export const purchaseV2Api = {
    async overview(): Promise<PurchaseOverview> {
        const r = await client.purchaseOverview({});
        return {
            requests: r.requests.map(fromRequest),
            lots: r.lots.map(fromLot),
            curators: r.curators.map((c) => ({ id: c.id.toString(), name: c.name, position: c.position, userUuid: c.userUuid, userName: c.userName })),
            departments: r.departments.map((d) => ({ id: d.department, name: d.name, curatorId: d.curatorId ? d.curatorId.toString() : "" })),
            categories: r.categories.map((c) => ({ id: c.id.toString(), name: c.name, okpd2Prefix: c.okpd2Prefix, department: c.department })),
            me: {
                uuid: r.me?.uuid ?? "",
                name: r.me?.name ?? "",
                department: r.me?.department ?? 0,
                curatorId: r.me?.curatorId ? r.me.curatorId.toString() : "",
                admin: r.me?.admin ?? false,
            },
        };
    },

    /** The department is the author's own (MDM); departmentId counts only for an administrator. */
    async requestCreate(actor: PurchaseActor, v: PurchaseRequestForm) {
        await client.purchaseRequestCreate({ actor: actorMessage(actor), ...requestFields(v), departmentId: v.departmentId });
    },

    async requestUpdate(actor: PurchaseActor, id: string, v: PurchaseRequestForm) {
        await client.purchaseRequestUpdate({ actor: actorMessage(actor), id: BigInt(id), ...requestFields(v) });
    },

    async requestMerge(actor: PurchaseActor, requestIds: string[], title: string): Promise<string> {
        const r = await client.purchaseRequestMerge({ actor: actorMessage(actor), requestIds: requestIds.map(BigInt), title });
        return r.id.toString();
    },

    /** implementingDepartment: where the vice-rector sends it (0 — the suggested one). */
    async requestAction(actor: PurchaseActor, id: string, action: PurchaseRequestAction, comment = "", implementingDepartment = 0) {
        await client.purchaseRequestAction({ actor: actorMessage(actor), id: BigInt(id), action, comment, implementingDepartment });
    },

    async requestDelete(actor: PurchaseActor, id: string) {
        await client.purchaseRequestDelete({ actor: actorMessage(actor), id: BigInt(id) });
    },

    async lotCreate(actor: PurchaseActor, requestIds: string[], title: string): Promise<string> {
        const r = await client.purchaseLotCreate({ actor: actorMessage(actor), requestIds: requestIds.map(BigInt), title });
        return r.id.toString();
    },

    async lotUpdate(actor: PurchaseActor, id: string, v: PurchaseLotForm) {
        await client.purchaseLotUpdate({
            actor: actorMessage(actor),
            id: BigInt(id),
            title: v.title,
            description: v.description,
            quantity: parseQty(v.quantity),
            unit: v.unit,
            comment: v.comment,
            okpd2: v.okpd2,
            ktru: v.ktru,
            okved: v.okved,
            fundingSource: v.fundingSource,
            kosgu: v.kosgu,
            nmck: BigInt(parseRub(v.nmck) || 0),
            economistComment: v.economistComment,
            planType: v.planType,
            planYear: Number(v.planYear) || 0,
            commissionComment: v.commissionComment,
        });
    },

    async lotRequests(actor: PurchaseActor, lotId: string, addIds: string[], removeIds: string[]) {
        await client.purchaseLotRequests({
            actor: actorMessage(actor),
            lotId: BigInt(lotId),
            addIds: addIds.map(BigInt),
            removeIds: removeIds.map(BigInt),
        });
    },

    async lotAction(actor: PurchaseActor, id: string, action: PurchaseLotAction, extra: LotActionExtra = {}) {
        await client.purchaseLotAction({
            actor: actorMessage(actor),
            id: BigInt(id),
            action,
            comment: extra.comment ?? "",
            planType: extra.planType,
            planYear: extra.planYear,
            assigneeUuid: extra.assignee?.uuid ?? "",
            assigneeName: extra.assignee?.name ?? "",
        });
    },

    /** Employees of a department (0 — all), from MDM. */
    async employees(department = 0): Promise<PurchaseEmployee[]> {
        const r = await client.purchaseEmployeeFetch({ department });
        return r.list.map((e) => ({ uuid: e.uuid, name: e.name, department: e.department }));
    },

    async curatorSave(c: { id: string; name: string; position: string; userUuid: string; userName: string }) {
        await client.purchaseCuratorSave({ id: BigInt(c.id || 0), name: c.name, position: c.position, userUuid: c.userUuid, userName: c.userName });
    },

    async departmentSave(department: number, curatorId: string) {
        await client.purchaseDepartmentSave({ department, curatorId: BigInt(curatorId || 0) });
    },

    async categorySave(c: { id: string; name: string; okpd2Prefix: string; department: number }) {
        await client.purchaseCategorySave({ id: BigInt(c.id || 0), name: c.name, okpd2Prefix: c.okpd2Prefix, department: c.department });
    },

    async categoryDelete(id: string) {
        await client.purchaseCategoryDelete({ id: BigInt(id) });
    },

    async quotationCreate(actor: PurchaseActor, lotId: string, v: PurchaseQuotationForm) {
        const content = v.file ? new Uint8Array(await v.file.arrayBuffer()) : new Uint8Array();
        await client.purchaseQuotationCreate({
            actor: actorMessage(actor),
            lotId: BigInt(lotId),
            supplier: v.supplier,
            unitPrice: BigInt(parseRub(v.unitPrice) || 0),
            note: v.note,
            fileName: v.file?.name ?? "",
            fileContent: content,
        });
    },

    async quotationDelete(actor: PurchaseActor, id: string) {
        await client.purchaseQuotationDelete({ actor: actorMessage(actor), id: BigInt(id) });
    },

    async quotationFile(id: string): Promise<{ name: string; content: Uint8Array }> {
        const r = await client.purchaseQuotationFile({ id: BigInt(id) });
        return { name: r.fileName, content: r.content };
    },

    async codeSuggest(title: string) {
        const r = await client.purchaseCodeSuggest({ title });
        return r.suggestion;
    },
};
