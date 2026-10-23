import { useState } from "react";
import { ConnectError, createClient } from "@connectrpc/connect";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { toast } from "sonner";
import type {
    PurchaseDocument,
    PurchaseEmployee,
    PurchaseLot,
    PurchaseProtocol,
    PurchaseQuotation,
    PurchaseRequest,
} from "@dvgmu/contract/fesmu/entity/v3/purchase.entity_pb";
import type { UserEmployeeDepartment } from "@dvgmu/contract/mdm/enum/user.enum_pb";
import type { PurchaseOverviewFetchResponse, PurchaseProtocolDecisionInput } from "@dvgmu/contract/fesmu/service/v3/purchase.service_pb";
import { PurchaseService } from "@dvgmu/contract/fesmu/service/v3/purchase.service_pb";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type { PurchaseLotUpdateRequestSchema, PurchaseProtocolDecisionInputSchema } from "@dvgmu/contract/fesmu/service/v3/purchase.service_pb";
import { connectTransport } from "@/shared/config/api";
import { DEPARTMENT_LABEL } from "@/shared/config/departments";
import { isOverdue, isTask, LOT_STAGES, lotKey, lotStage, PurchaseLotStatus, PurchaseMove, PurchaseRequestStatus, requestKey } from "./purchase-v3.schema";
import type { PurchaseDocumentKind, PurchaseItemType , PurchasePermission} from "./purchase-v3.schema";

const client = createClient(PurchaseService, connectTransport);

/** The server's own wording without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) => (error instanceof ConnectError ? error.rawMessage || fallback : fallback);

const readFile = async (file?: File | null) => (file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array());

const save = (name: string, content: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([content.slice()]));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

/** What the lists, tasks and summary are narrowed to; 0 / "" — any. */
export interface PurchaseFilters {
    curatorId: string;
    department: number;
    itemType: number;
    /** 1–3 — the purchase's stage (планирование, подготовка, исполнение). */
    phase: 0 | 1 | 2 | 3;
    /** "r<status>" — a request's status, "l<status>" — a purchase's. */
    status: string;
    overdueOnly: boolean;
    /** Only purchases with remarks left by a transfer from a plan or registry. */
    reviewOnly: boolean;
}

export const NO_FILTERS: PurchaseFilters = { curatorId: "", department: 0, itemType: 0, phase: 0, status: "", overdueOnly: false, reviewOnly: false };

export type PurchaseView = "tasks" | "requests" | "lots" | "summary" | "commission" | "directories";

export type LotPatch = MessageInitShape<typeof PurchaseLotUpdateRequestSchema>["patch"];
export type DecisionInit = MessageInitShape<typeof PurchaseProtocolDecisionInputSchema>;

export interface RequestFormValue {
    title: string;
    itemType: PurchaseItemType;
    quantity: number;
    description: string;
    department?: UserEmployeeDepartment;
}

export interface ProtocolFormValue {
    number: string;
    heldAt: Date;
    chairman: string;
    secretary: string;
    comment: string;
    file?: File | null;
}

/** Everything the purchases v3 page needs. Nothing is decided here: the
 *  server says what the user sees and may do (allowed on each record). */
export const usePurchaseV3 = () => {
    const [overview, setOverview] = useState<PurchaseOverviewFetchResponse>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<PurchaseView>("tasks");
    const [selected, setSelected] = useState<string>();
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<PurchaseFilters>(NO_FILTERS);
    /** How the purchases tab lays them out: a list, or by classifier code. */
    const [lotLayout, setLotLayout] = useState<"list" | "okpd2" | "ktru">("list");
    const [employees, setEmployees] = useState<Partial<Record<number, PurchaseEmployee[]>>>({});

    const me = overview?.me;

    /** Opens a record ("r12" — request, "l5" — purchase); from the summary
     *  views it goes to the list it is in. */
    const select = (key?: string) => {
        setSelected(key);
        if (key && view !== "tasks" && view !== "requests" && view !== "lots") setView(key.startsWith("r") ? "requests" : "lots");
    };
    const can = (p: PurchasePermission) => Boolean(me && (me.admin || me.permissions.includes(p)));

    const fetch = async (quiet = false) => {
        if (!quiet) setLoading(true);
        setError(undefined);
        try {
            setOverview(await client.purchaseOverviewFetch({}));
        } catch (err) {
            console.error("Ошибка при получении закупок:", err);
            setError(errorText(err, "Не удалось загрузить закупки"));
        } finally {
            setLoading(false);
        }
    };

    /** Runs a change, tells how it went, reloads. true — done. */
    const run = async (call: () => Promise<unknown>, done: string, failed: string) => {
        setBusy(true);
        try {
            await call();
            toast.success(done);
            await fetch(true);
            return true;
        } catch (err) {
            toast.error(errorText(err, failed));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const requests = overview?.requests ?? [];
    const lots = overview?.lots ?? [];
    const query = search.trim().toLocaleLowerCase("ru");
    const matches = (...fields: string[]) => !query || fields.some((f) => f.toLocaleLowerCase("ru").includes(query));
    const curatorOfDepartment = (d: number) => overview?.departments.find((x) => x.department === d)?.curatorId;
    const f = filters;
    /** A request that went into a purchase or was merged lives on inside it:
     *  the requests list shows it only when that status is picked. */
    const isOpen = (r: PurchaseRequest) => r.status !== PurchaseRequestStatus.IN_PURCHASE && r.status !== PurchaseRequestStatus.MERGED;
    const requestFits = (r: PurchaseRequest) =>
        (f.status !== "" || isOpen(r)) &&
        matches(r.title, r.authorName, departmentName(r.department), `№${r.id}`) &&
        (!f.curatorId || [r.curatorId, curatorOfDepartment(r.department)].some((c) => c?.toString() === f.curatorId)) &&
        (!f.department || r.department === f.department || r.implementingDepartment === f.department) &&
        (!f.itemType || r.itemType === f.itemType) &&
        (!f.status || f.status === `r${r.status}`) &&
        (!f.overdueOnly || isOverdue(r)) &&
        !f.reviewOnly &&
        // A stage narrows to purchases; requests still on their own way are stage I.
        (f.phase === 0 || (f.phase === 1 && !r.lotId));
    const lotFits = (l: PurchaseLot) =>
        matches(l.title, l.assigneeName, l.supplier, departmentName(l.implementingDepartment), `№${l.id}`) &&
        (!f.curatorId || l.curatorId.toString() === f.curatorId) &&
        (!f.department ||
            l.implementingDepartment === f.department ||
            l.requestIds.some((id) => requests.find((r) => r.id === id)?.department === f.department)) &&
        (!f.itemType || l.itemType === f.itemType) &&
        (!f.status || f.status === `l${l.status}`) &&
        (!f.overdueOnly || isOverdue(l)) &&
        (!f.reviewOnly || l.reviewNote !== "") &&
        (f.phase === 0 || LOT_STAGES[lotStage(l.status)]?.phase === f.phase || (f.phase === 3 && l.status === PurchaseLotStatus.COMPLETED));
    const activeFilters = Object.entries(f).filter(([k, v]) => v !== NO_FILTERS[k as keyof PurchaseFilters]).length + (query ? 1 : 0);

    const departmentName = (d: number) => overview?.departments.find((x) => x.department === d)?.name ?? DEPARTMENT_LABEL[d as UserEmployeeDepartment] ?? `#${d}`;
    const curator = (id: bigint) => overview?.curators.find((c) => c.id === id);
    /** An administrator picks the direction himself where the directory has none. */
    const needsDirection = (department: number) => Boolean(me?.admin) && !curatorOfDepartmentId(department);
    function curatorOfDepartmentId(d: number) {
        return overview?.departments.find((x) => x.department === d)?.curatorId ?? 0n;
    }
    const curatorName = (id: bigint) => {
        const c = curator(id);
        return c ? c.shortTitle || c.title : "—";
    };

    const loadEmployees = async (department: number) => {
        if (employees[department]) return;
        try {
            const r = await client.purchaseEmployeeFetch({ department });
            setEmployees((e) => ({ ...e, [department]: r.list }));
        } catch (err) {
            toast.error(errorText(err, "Не удалось получить сотрудников"));
        }
    };

    const download = async (fetchFile: () => Promise<{ fileName: string; content: Uint8Array }>, fallback: string) => {
        try {
            const f = await fetchFile();
            save(f.fileName || fallback, f.content);
        } catch (err) {
            toast.error(errorText(err, "Не удалось скачать файл"));
        }
    };

    return {
        overview,
        me,
        can,
        loading,
        error,
        busy,
        view,
        setView,
        search,
        filters,
        setFilters: (patch: Partial<PurchaseFilters>) => setFilters((x) => ({ ...x, ...patch })),
        resetFilters: () => {
            setFilters(NO_FILTERS);
            setSearch("");
        },
        activeFilters,
        lotLayout,
        setLotLayout,
        setSearch,
        fetch,
        requests,
        lots,
        protocols: overview?.protocols ?? [],
        /** Everything waiting on the user, before filters — for the tab's count. */
        allTasks: requests.filter(isTask).length + lots.filter(isTask).length,
        tasks: [
            ...requests.filter((r) => isTask(r) && requestFits(r)).map((r) => ({ kind: "request" as const, r })),
            ...lots.filter((l) => isTask(l) && lotFits(l)).map((l) => ({ kind: "lot" as const, l })),
        ],
        filteredRequests: requests.filter(requestFits),
        /** Requests still on their own way (not in a purchase, not merged). */
        openRequests: requests.filter(isOpen).length,
        /** Requests that have become purchases — for the hint under the list. */
        requestsInPurchases: requests.length - requests.filter(isOpen).length,
        filteredLots: lots.filter(lotFits),
        selected,
        select,
        activeRequest: requests.find((r) => requestKey(r) === selected),
        activeLot: lots.find((l) => lotKey(l) === selected),
        requestById: (id: bigint) => requests.find((r) => r.id === id),
        lotById: (id: bigint) => lots.find((l) => l.id === id),
        departmentName,
        curator,
        curatorName,
        needsDirection,
        employees,
        loadEmployees,

        // ── Requests
        createRequest: (v: RequestFormValue) =>
            run(() => client.purchaseRequestCreate({ ...v, unit: "", department: v.department ?? 0 }), "Заявка подана начальнику отдела", "Не удалось подать заявку"),
        updateRequest: (r: PurchaseRequest, v: RequestFormValue) =>
            run(() => client.purchaseRequestUpdate({ id: r.id, ...v, unit: r.unit }), "Заявка сохранена", "Не удалось сохранить заявку"),
        deleteRequest: (r: PurchaseRequest) =>
            confirm(`Удалить заявку №${r.id} «${r.title}»?`)
                ? run(() => client.purchaseRequestDelete({ id: r.id }), "Заявка удалена", "Не удалось удалить заявку").then((ok) => ok && select(undefined))
                : Promise.resolve(),
        moveRequest: (r: PurchaseRequest, move: PurchaseMove, comment: string, implementingDepartment = 0, curatorId = 0n) =>
            run(
                () => client.purchaseRequestMove({ id: r.id, move, comment, implementingDepartment, curatorId }),
                move === PurchaseMove.FORWARD ? "Заявка передана дальше" : move === PurchaseMove.RETURN ? "Заявка возвращена" : "Заявка отклонена",
                "Не удалось",
            ),
        mergeRequests: (ids: bigint[], title: string, description: string) =>
            run(() => client.purchaseRequestMerge({ requestIds: ids, title, description }), "Заявки объединены", "Не удалось объединить"),

        // ── Purchases
        createLot: async (ids: bigint[], title: string, description: string, curatorId = 0n) => {
            let id = 0n;
            const ok = await run(async () => {
                id = (await client.purchaseLotCreate({ requestIds: ids, title, description, curatorId })).id;
            }, "Закупка сформирована", "Не удалось сформировать закупку");
            if (ok) {
                setView("lots");
                setSelected(`l${id}`);
            }
            return ok;
        },
        lotRequests: (l: PurchaseLot, addIds: bigint[], removeIds: bigint[]) =>
            run(() => client.purchaseLotRequests({ lotId: l.id, addIds, removeIds }), "Состав закупки изменён", "Не удалось изменить состав"),
        disbandLot: (l: PurchaseLot) => {
            const comment = prompt(`Расформировать закупку №${l.id}? Заявки вернутся в очередь отдела. Причина:`);
            return comment === null
                ? Promise.resolve(false)
                : run(() => client.purchaseLotDisband({ id: l.id, comment }), "Закупка расформирована", "Не удалось расформировать").then((ok) => {
                      if (ok) select(undefined);
                      return ok;
                  });
        },
        updateLot: (l: PurchaseLot, patch: LotPatch) =>
            run(() => client.purchaseLotUpdate({ id: l.id, patch } as MessageInitShape<typeof PurchaseLotUpdateRequestSchema>), "Сохранено", "Не удалось сохранить"),
        moveLot: (l: PurchaseLot, move: PurchaseMove, comment: string, assigneeUuid = "") =>
            run(
                () => client.purchaseLotMove({ id: l.id, move, comment, assigneeUuid }),
                move === PurchaseMove.FORWARD ? "Закупка передана дальше" : "Закупка возвращена",
                "Не удалось",
            ),

        addQuotation: async (l: PurchaseLot, v: { supplier: string; supplierInn: string; unitPrice: number; note: string; file?: File | null }) =>
            run(
                async () =>
                    client.purchaseQuotationCreate({
                        lotId: l.id,
                        supplier: v.supplier,
                        supplierInn: v.supplierInn,
                        unitPrice: BigInt(v.unitPrice),
                        note: v.note,
                        fileName: v.file?.name ?? "",
                        fileContent: await readFile(v.file),
                    }),
                "КП прикреплено",
                "Не удалось прикрепить КП",
            ),
        deleteQuotation: (q: PurchaseQuotation) =>
            confirm(`Удалить КП «${q.supplier}»?`) ? run(() => client.purchaseQuotationDelete({ id: q.id }), "КП удалено", "Не удалось удалить КП") : Promise.resolve(false),
        downloadQuotation: (q: PurchaseQuotation) => download(() => client.purchaseQuotationFileFetch({ id: q.id }).then((r) => ({ fileName: r.fileName, content: r.content })), "КП"),

        addDocument: async (l: PurchaseLot, kind: PurchaseDocumentKind, file: File, note: string) =>
            run(
                async () => client.purchaseDocumentCreate({ lotId: l.id, kind, note, fileName: file.name, fileContent: await readFile(file) }),
                "Документ прикреплён",
                "Не удалось прикрепить документ",
            ),
        deleteDocument: (d: PurchaseDocument) =>
            confirm(`Удалить «${d.fileName}»?`) ? run(() => client.purchaseDocumentDelete({ id: d.id }), "Документ удалён", "Не удалось удалить") : Promise.resolve(false),
        downloadDocument: (d: PurchaseDocument) => download(() => client.purchaseDocumentFileFetch({ id: d.id }).then((r) => ({ fileName: r.fileName, content: r.content })), "Документ"),

        // ── Commission
        createProtocol: async (v: ProtocolFormValue, decisions: DecisionInit[]) =>
            run(
                async () =>
                    client.purchaseProtocolCreate({
                        number: v.number,
                        heldAt: timestampFromDate(v.heldAt),
                        chairman: v.chairman,
                        secretary: v.secretary,
                        comment: v.comment,
                        decisions: decisions as PurchaseProtocolDecisionInput[],
                        fileName: v.file?.name ?? "",
                        fileContent: await readFile(v.file),
                    }),
                "Протокол оформлен, решения применены",
                "Не удалось оформить протокол",
            ),
        uploadProtocolFile: async (p: PurchaseProtocol, file: File) =>
            run(
                async () =>
                    client.purchaseProtocolUpdate({
                        id: p.id,
                        number: p.number,
                        heldAt: p.heldAt,
                        chairman: p.chairman,
                        secretary: p.secretary,
                        comment: p.comment,
                        fileName: file.name,
                        fileContent: await readFile(file),
                    }),
                "Файл протокола загружен",
                "Не удалось загрузить файл",
            ),
        downloadProtocol: (p: PurchaseProtocol) =>
            download(() => client.purchaseProtocolFileFetch({ id: p.id }).then((r) => ({ fileName: r.fileName, content: r.content })), `Протокол ${p.number}`),

        // ── Directories
        saveCurator: (v: { id: bigint; title: string; shortTitle: string; personName: string; userUuid: string; userName: string; sortOrder: number }) =>
            run(() => client.purchaseCuratorSave(v), "Направление сохранено", "Не удалось сохранить"),
        deleteCurator: (id: bigint) => run(() => client.purchaseCuratorDelete({ id }), "Направление удалено", "Не удалось удалить"),
        saveDepartment: (department: number, curatorId: bigint) =>
            run(() => client.purchaseDepartmentSave({ department, curatorId }), "Отдел отнесён к направлению", "Не удалось сохранить"),
        saveCategory: (v: { id: bigint; name: string; okpd2Prefix: string; implementingDepartment: number }) =>
            run(() => client.purchaseCategorySave(v), "Вид закупки сохранён", "Не удалось сохранить"),
        deleteCategory: (id: bigint) => run(() => client.purchaseCategoryDelete({ id }), "Вид закупки удалён", "Не удалось удалить"),
        suggestCodes: (title: string) => client.purchaseCodeSuggestFetch({ title }).then((r) => r.suggestion),
    };
};

export type PurchaseV3State = ReturnType<typeof usePurchaseV3>;
