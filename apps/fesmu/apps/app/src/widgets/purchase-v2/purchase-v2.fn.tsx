import { useEffect, useMemo, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import { toast } from "sonner";
import { create } from "zustand";
import { useUserProvider } from "@/features/provider/user.provider";
import { purchaseV2Api } from "./purchase-v2.api";
import type { LotActionExtra } from "./purchase-v2.api";
import { PermissionAction, permsFor } from "@/shared/config/permissions";
import { ACTOR_ROLES, curatorStats, PurchaseActorRole, PurchaseLotStatus, PurchaseRequestStatus, ROLE_SECTION } from "./purchase-v2.schema";
import type {
    PurchaseActor,
    PurchaseLot,
    PurchaseLotAction,
    PurchaseLotForm,
    PurchaseOverview,
    PurchaseQuotation,
    PurchaseQuotationForm,
    PurchaseRequest,
    PurchaseRequestAction,
    PurchaseRequestForm,
} from "./purchase-v2.schema";

/** The server's own wording without ConnectError's code prefix. */
const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

const STORAGE_KEY = "purchase-v2-actor";

const readActor = (): PurchaseActor => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        if (saved && saved.role in PurchaseActorRole) {
            return { role: saved.role, name: String(saved.name ?? ""), curatorId: String(saved.curatorId ?? "") };
        }
    } catch {
        /* storage unavailable — start as an employee */
    }
    return { role: PurchaseActorRole.EMPLOYEE, name: "", curatorId: "" };
};

interface ActorStore {
    actor: PurchaseActor;
    setActor: (patch: Partial<PurchaseActor>) => void;
}

/** "View as": the role, name and vice-rector the page acts for; kept per browser. */
export const usePurchaseV2Actor = create<ActorStore>((set, get) => ({
    actor: readActor(),
    setActor: (patch) => {
        const actor = { ...get().actor, ...patch };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(actor));
        } catch {
            /* ignore */
        }
        set({ actor });
    },
}));

export type PurchaseTarget = { kind: "request" | "lot"; id: string };

const EMPTY: PurchaseOverview = {
    requests: [],
    lots: [],
    curators: [],
    departments: [],
    categories: [],
    me: { uuid: "", name: "", department: 0, curatorId: "", admin: false },
};

const matches = (query: string, ...fields: string[]) =>
    !query || fields.some((f) => f.toLocaleLowerCase("ru").includes(query));

/** Everything the purchases v2 page needs: data, the role's view of it, actions. */
export const usePurchaseV2 = () => {
    const { actor: chosen, setActor } = usePurchaseV2Actor();
    // Subscribed so the roles follow the user once it is loaded.
    useUserProvider((s) => s.user);
    const hasPermission = useUserProvider((s) => s.hasPermission);
    /** Roles the user may act in: the right to change their section (ADMIN — all). */
    const actRoles: PurchaseActorRole[] = ACTOR_ROLES.filter((r) => hasPermission(...permsFor(ROLE_SECTION[r], PermissionAction.POST)));
    /** Without any, the page is view-only: through the roles whose sections are open for viewing. */
    const roles: PurchaseActorRole[] = actRoles.length ? actRoles : ACTOR_ROLES.filter((r) => hasPermission(...permsFor(ROLE_SECTION[r])));
    const profile = useUserProvider((s) => s.profile);
    const [overview, setOverview] = useState<PurchaseOverview>(EMPTY);
    const me = overview.me;
    // A remembered role the user no longer has falls back to the first
    // available one. The vice-rector is the one the user is bound to; only an
    // administrator picks one (testing).
    const actor = {
        ...chosen,
        role: roles.includes(chosen.role) ? chosen.role : (roles[0] ?? chosen.role),
        curatorId: me.admin ? chosen.curatorId : me.curatorId,
    };
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [target, setTarget] = useState<PurchaseTarget>();
    const [onlyTasks, setOnlyTasks] = useState(true);
    const [search, setSearch] = useState("");
    /** Vice-rectors unticked in the filter; new ones show up ticked. */
    const [hiddenCurators, setHiddenCurators] = useState<string[]>([]);
    const [pickedForMerge, setMergeIds] = useState<string[]>([]);

    // The signed-in user's name, until the person types another one.
    useEffect(() => {
        if (!actor.name && profile) {
            const name = `${profile.lastName} ${profile.firstName}`.trim();
            if (name) setActor({ name });
        }
    }, [profile, actor.name, setActor]);

    const fetch = async (quiet = false) => {
        if (!quiet) setLoading(true);
        setError(false);
        try {
            setOverview(await purchaseV2Api.overview());
        } catch (err) {
            console.error("Ошибка при получении закупок:", err);
            setError(true);
            toast.error(errorText(err, "Не удалось загрузить закупки"));
        } finally {
            setLoading(false);
        }
    };

    /** Runs a change, says how it went, and reloads everything. */
    const run = async (work: () => Promise<unknown>, success: string, fallback: string) => {
        setBusy(true);
        try {
            await work();
            toast.success(success);
            await fetch(true);
            return true;
        } catch (err) {
            console.error(fallback, err);
            toast.error(errorText(err, fallback));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const curatorName = (id: string) => overview.curators.find((c) => c.id === id)?.name ?? "—";
    const departmentName = (id: number) => (id ? (overview.departments.find((d) => d.id === id)?.name ?? `Отдел #${id}`) : "—");
    /** The vice-rector the directory puts over a department; empty if none. */
    const departmentCurator = (id: number) => overview.departments.find((d) => d.id === id)?.curatorId ?? "";
    /** The user belongs to department id (an administrator — to any). */
    const inMyDepartment = (id: number) => me.admin || (me.department !== 0 && me.department === id);
    const isMyCurator = (id: string) => (me.admin && !actor.curatorId) || id === actor.curatorId;
    const requestById = (id: string) => overview.requests.find((r) => r.id === id);
    const lotById = (id?: string) => (id ? overview.lots.find((l) => l.id === id) : undefined);

    // Requests without a vice-rector yet (at the head) are never filtered out.
    const curatorShown = (id: string) => !id || !hiddenCurators.includes(id);
    const toggleCurator = (id: string) =>
        setHiddenCurators((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
    const showAllCurators = (show: boolean) => setHiddenCurators(show ? [] : statCurators.map((s) => s.curator.id));

    const isMyRequestTask = (r: PurchaseRequest) => {
        switch (actor.role) {
            case PurchaseActorRole.EMPLOYEE:
                return me.admin || r.authorUuid === me.uuid;
            case PurchaseActorRole.DEPT_HEAD:
                return (
                    (r.status === PurchaseRequestStatus.HEAD_REVIEW && inMyDepartment(r.departmentId)) ||
                    (r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW && inMyDepartment(r.implementingDepartment))
                );
            case PurchaseActorRole.VICE_RECTOR:
                return r.status === PurchaseRequestStatus.VICE_RECTOR_REVIEW && isMyCurator(r.curatorId);
            default:
                return false;
        }
    };

    const isMyLotTask = (l: PurchaseLot) => {
        switch (actor.role) {
            case PurchaseActorRole.EMPLOYEE:
                // What the employee prepares, and where their own requests went.
                return (
                    (l.status === PurchaseLotStatus.SPECIFICATION && (me.admin || l.assigneeUuid === me.uuid)) ||
                    overview.requests.some((r) => r.lotId === l.id && r.authorUuid === me.uuid)
                );
            case PurchaseActorRole.DEPT_HEAD:
                return (
                    (l.status === PurchaseLotStatus.FORMING || l.status === PurchaseLotStatus.IMPLEMENTER_CHECK) &&
                    inMyDepartment(l.implementingDepartment)
                );
            case PurchaseActorRole.VICE_RECTOR:
                return l.status === PurchaseLotStatus.VICE_RECTOR_REVIEW && isMyCurator(l.curatorId);
            case PurchaseActorRole.ECONOMIST:
                return l.status === PurchaseLotStatus.ECONOMIST_REVIEW;
            case PurchaseActorRole.BUDGET_COMMISSION:
                return l.status === PurchaseLotStatus.BUDGET_COMMISSION;
            default:
                return false;
        }
    };

    /** After the commission: the purchases of the acting vice-rector's
     * direction — over the implementing department or over a requester's. */
    const actualLots = overview.lots.filter(
        (l) =>
            l.status === PurchaseLotStatus.APPROVED &&
            (isMyCurator(l.curatorId) || overview.requests.some((r) => r.lotId === l.id && isMyCurator(r.curatorId))),
    );

    const query = search.trim().toLocaleLowerCase("ru");

    const requests = useMemo(
        () =>
            overview.requests.filter(
                (r) =>
                    curatorShown(r.curatorId) &&
                    (!onlyTasks || isMyRequestTask(r)) &&
                    matches(query, r.title, r.department, r.authorName, `#${r.id}`),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [overview, onlyTasks, query, hiddenCurators, actor],
    );

    const lots = useMemo(
        () =>
            overview.lots.filter(
                (l) =>
                    curatorShown(l.curatorId) &&
                    (!onlyTasks || isMyLotTask(l)) &&
                    matches(query, l.title, l.okpd2, l.ktru, `#${l.id}`),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [overview, onlyTasks, query, hiddenCurators, actor],
    );

    /** Vice-rectors the user has anything of: the server sends each user only
     * their own part, so a vice-rector sees just their direction. */
    const statCurators = curatorStats(overview).filter((s) => s.lots > 0 || s.requestsWaiting > 0 || s.curator.id === me.curatorId);
    const stats = statCurators.filter((s) => curatorShown(s.curator.id));

    const activeRequest = target?.kind === "request" ? requestById(target.id) : undefined;
    const activeLot = target?.kind === "lot" ? lotById(target.id) : undefined;

    /** What the head may tick: requests of their department under review
     * (to merge into one) and requests their department carries out (to merge
     * into a purchase). */
    const headMergeable = overview.requests.filter(
        (r) => actor.role === PurchaseActorRole.DEPT_HEAD && r.status === PurchaseRequestStatus.HEAD_REVIEW && inMyDepartment(r.departmentId),
    );
    const lotMergeable = overview.requests.filter(
        (r) =>
            actor.role === PurchaseActorRole.DEPT_HEAD &&
            r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW &&
            inMyDepartment(r.implementingDepartment),
    );
    const mergeable = [...headMergeable, ...lotMergeable];

    // Ticks survive only on requests the current role may still merge.
    const mergeIds = pickedForMerge.filter((id) => mergeable.some((r) => r.id === id));
    /** Ticked requests to merge into one request, and to merge into a purchase. */
    const headMergeIds = mergeIds.filter((id) => headMergeable.some((r) => r.id === id));
    const lotMergeIds = mergeIds.filter((id) => lotMergeable.some((r) => r.id === id));

    const toggleMerge = (id: string) => setMergeIds(mergeIds.includes(id) ? mergeIds.filter((x) => x !== id) : [...mergeIds, id]);

    /* ───────────── actions ───────────── */

    const createRequest = (v: PurchaseRequestForm) =>
        run(() => purchaseV2Api.requestCreate(actor, v), "Заявка отправлена начальнику отдела", "Не удалось создать заявку");

    const updateRequest = (id: string, v: PurchaseRequestForm) =>
        run(() => purchaseV2Api.requestUpdate(actor, id, v), "Заявка сохранена", "Не удалось сохранить заявку");

    const requestAction = (id: string, action: PurchaseRequestAction, comment = "", success = "Готово", implementingDepartment = 0) =>
        run(() => purchaseV2Api.requestAction(actor, id, action, comment, implementingDepartment), success, "Не удалось выполнить действие");

    const deleteRequest = async (r: PurchaseRequest) => {
        if (!confirm(`Удалить заявку «${r.title}»?`)) return;
        if (await run(() => purchaseV2Api.requestDelete(actor, r.id), "Заявка удалена", "Не удалось удалить заявку")) {
            setTarget(undefined);
        }
    };

    const mergeRequests = async (ids: string[], title: string) => {
        let id = "";
        const ok = await run(
            async () => (id = await purchaseV2Api.requestMerge(actor, ids, title)),
            "Заявки объединены",
            "Не удалось объединить заявки",
        );
        if (ok) {
            setMergeIds([]);
            setTarget({ kind: "request", id });
        }
        return ok;
    };

    const createLot = async (ids: string[], title: string) => {
        let id = "";
        const ok = await run(
            async () => (id = await purchaseV2Api.lotCreate(actor, ids, title)),
            "Закупка сформирована",
            "Не удалось сформировать закупку",
        );
        if (ok) {
            setMergeIds([]);
            setTarget({ kind: "lot", id });
        }
        return ok;
    };

    const updateLot = (id: string, v: PurchaseLotForm) =>
        run(() => purchaseV2Api.lotUpdate(actor, id, v), "Закупка сохранена", "Не удалось сохранить закупку");

    const lotRequests = (id: string, add: string[], remove: string[]) =>
        run(() => purchaseV2Api.lotRequests(actor, id, add, remove), "Состав закупки изменён", "Не удалось изменить состав");

    const lotAction = (id: string, action: PurchaseLotAction, extra: LotActionExtra = {}, success = "Готово") =>
        run(() => purchaseV2Api.lotAction(actor, id, action, extra), success, "Не удалось выполнить действие");

    /** The commission decides on several purchases at once. */
    const lotActionMany = async (ids: string[], action: PurchaseLotAction, extra: LotActionExtra) => {
        setBusy(true);
        let done = 0;
        const failed: string[] = [];
        for (const id of ids) {
            try {
                await purchaseV2Api.lotAction(actor, id, action, extra);
                done++;
            } catch (err) {
                failed.push(`#${id}: ${errorText(err, "ошибка")}`);
            }
        }
        setBusy(false);
        if (done) toast.success(`Готово: ${done}`);
        if (failed.length) toast.error(`Не выполнено — ${failed.join("; ")}`);
        await fetch(true);
    };

    /* ───────────── directories (administrator) ───────────── */

    const saveCurator = (c: { id: string; name: string; position: string; userUuid: string; userName: string }) =>
        run(() => purchaseV2Api.curatorSave(c), "Проректор сохранён", "Не удалось сохранить проректора");

    const saveDepartment = (department: number, curatorId: string) =>
        run(() => purchaseV2Api.departmentSave(department, curatorId), "Отдел сохранён", "Не удалось сохранить отдел");

    const saveCategory = (c: { id: string; name: string; okpd2Prefix: string; department: number }) =>
        run(() => purchaseV2Api.categorySave(c), "Категория сохранена", "Не удалось сохранить категорию");

    const deleteCategory = (id: string) =>
        run(() => purchaseV2Api.categoryDelete(id), "Категория удалена", "Не удалось удалить категорию");

    const addQuotation = (lotId: string, v: PurchaseQuotationForm) =>
        run(() => purchaseV2Api.quotationCreate(actor, lotId, v), "КП прикреплено", "Не удалось прикрепить КП");

    const deleteQuotation = async (q: PurchaseQuotation) => {
        if (!confirm(`Удалить КП «${q.supplier}»?`)) return;
        await run(() => purchaseV2Api.quotationDelete(actor, q.id), "КП удалено", "Не удалось удалить КП");
    };

    const downloadQuotation = async (q: PurchaseQuotation) => {
        try {
            const file = await purchaseV2Api.quotationFile(q.id);
            const url = URL.createObjectURL(new Blob([file.content.slice()]));
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name || "КП";
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(errorText(err, "Не удалось скачать КП"));
        }
    };

    return {
        actor,
        setActor,
        roles,
        viewOnly: actRoles.length === 0,
        overview,
        loading,
        error,
        busy,
        fetch,
        target,
        setTarget,
        activeRequest,
        activeLot,
        onlyTasks,
        setOnlyTasks,
        search,
        setSearch,
        requests,
        lots,
        stats,
        statCurators,
        curatorName,
        requestById,
        lotById,
        curatorShown,
        toggleCurator,
        showAllCurators,
        hiddenCurators,
        mergeable,
        mergeIds,
        toggleMerge,
        setMergeIds,
        createRequest,
        updateRequest,
        requestAction,
        deleteRequest,
        mergeRequests,
        createLot,
        saveCurator,
        saveDepartment,
        saveCategory,
        deleteCategory,
        departmentName,
        departmentCurator,
        inMyDepartment,
        isMyCurator,
        headMergeIds,
        lotMergeIds,
        actualLots,
        me,
        updateLot,
        lotRequests,
        lotAction,
        lotActionMany,
        addQuotation,
        deleteQuotation,
        downloadQuotation,
    };
};

export type PurchaseV2State = ReturnType<typeof usePurchaseV2>;
