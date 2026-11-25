import { useState } from "react";
import type { FC, ReactNode } from "react";
import { CheckCircle2Icon, CircleIcon, CircleDotIcon, LayersIcon, PencilIcon, PlusIcon, TrashIcon, UserCheckIcon } from "lucide-react";
import { Can, useCan } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";
import { CommonSearchInput } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import type { PurchaseV2State } from "./purchase-v2.fn";
import {
    ACTOR_LABEL,
    ROLE_SECTION,
    emptyRequestForm,
    FLOW_STEPS,
    formatDateTime,
    ITEM_TYPE_LABEL,
    LOT_STATUS,
    parseQty,
    PurchaseActorRole,
    PurchaseItemType,
    PurchaseRequestAction,
    PurchaseRequestStatus,
    qty,
    REQUEST_STATUS,
    requestForm,
    requestStep,
    rub,
    TONE_CLASS,
} from "./purchase-v2.schema";
import type { PurchaseApproval, PurchaseLog, PurchaseLot, PurchaseRequest, PurchaseRequestForm } from "./purchase-v2.schema";

export const FIELD_CLASS = "border rounded-lg px-2 py-1.5 w-full bg-background text-sm disabled:opacity-60";

export const StatusBadge: FC<{ label: string; tone: keyof typeof TONE_CLASS }> = ({ label, tone }) => (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone])}>
        {label}
    </span>
);

export const RequestBadge: FC<{ r: PurchaseRequest }> = ({ r }) => <StatusBadge {...REQUEST_STATUS[r.status]} />;
export const LotBadge: FC<{ l: PurchaseLot }> = ({ l }) => <StatusBadge {...LOT_STATUS[l.status]} />;

export const Field: FC<{ label: string; hint?: ReactNode; children: ReactNode; className?: string }> = ({ label, hint, children, className }) => (
    <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
        {label}
        {children}
        {hint && <span className="font-normal">{hint}</span>}
    </label>
);

export const Section: FC<{ title: string; action?: ReactNode; children: ReactNode; className?: string }> = ({ title, action, children, className }) => (
    <Card className={cn("gap-3 p-4", className)}>
        <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-sm font-semibold">{title}</p>
            {action}
        </div>
        {children}
    </Card>
);

/* ───────────── "view as" ───────────── */

/** Who the user is (name and department from MDM, the vice-rector they
 * are) and the role switch: only roles the user may act in (ADMIN — all;
 * an administrator may also pick a vice-rector and a name, for testing). */
export const PurchaseActorBar: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const { actor, setActor, overview, roles, viewOnly, me } = state;
    const myCurator = overview.curators.find((c) => c.id === me.curatorId);
    return (
        <Card className="flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-end">
            <Field label="Просмотр от лица" className="sm:max-w-60">
                <select
                    className={FIELD_CLASS}
                    value={actor.role}
                    onChange={(e) => setActor({ role: Number(e.target.value) as PurchaseActorRole })}
                >
                    {roles.map((r) => (
                        <option key={r} value={r}>
                            {ACTOR_LABEL[r]}
                        </option>
                    ))}
                </select>
            </Field>
            <div className="flex flex-col gap-0.5 text-sm sm:max-w-80">
                <span className="text-xs font-medium text-muted-foreground">Вы</span>
                <span className="font-medium">{me.name || "—"}</span>
                <span className="text-xs text-muted-foreground">
                    {me.department ? state.departmentName(me.department) : "Отдел в профиле не указан"}
                    {myCurator && ` · ${myCurator.name}`}
                </span>
            </div>
            {actor.role === PurchaseActorRole.VICE_RECTOR && !me.admin && !myCurator && (
                <p className="text-xs text-amber-700 sm:max-w-60">Вы не привязаны к проректору в справочнике — обратитесь к администратору.</p>
            )}
            {me.admin && actor.role === PurchaseActorRole.VICE_RECTOR && (
                <Field label="Какой проректор (администратор)" className="sm:max-w-80">
                    <select className={FIELD_CLASS} value={actor.curatorId} onChange={(e) => setActor({ curatorId: e.target.value })}>
                        <option value="">— любой —</option>
                        {overview.curators.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </Field>
            )}
            {me.admin && (
                <Field label="ФИО в истории (администратор)" className="sm:max-w-72">
                    <input className={FIELD_CLASS} value={actor.name} onChange={(e) => setActor({ name: e.target.value })} placeholder={me.name} />
                </Field>
            )}
            <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-72">
                {viewOnly
                    ? "Только просмотр: чтобы действовать, нужен доступ на изменение раздела закупок — обратитесь к администратору."
                    : "В списке — роли, на которые у вас есть доступ. В истории каждого этапа видно, кто и когда согласовал."}
            </p>
        </Card>
    );
};

/* ───────────── timeline, approvals, log ───────────── */

export const PurchaseTimeline: FC<{ current: number }> = ({ current }) => (
    <ol className="flex flex-col gap-2">
        {FLOW_STEPS.map((step, i) => {
            const done = current < 0 ? false : i < current;
            const active = i === current;
            const Icon = done ? CheckCircle2Icon : active ? CircleDotIcon : CircleIcon;
            return (
                <li key={step.key} className={cn("flex items-center gap-2 text-xs", active ? "font-semibold" : done ? "" : "text-muted-foreground")}>
                    <Icon className={cn("size-4 shrink-0", done ? "text-emerald-600" : active ? "text-primary" : "")} />
                    {step.label}
                </li>
            );
        })}
        {current === FLOW_STEPS.length && <li className="text-xs font-semibold text-emerald-600">Включена в ПФХД</li>}
        {current < 0 && <li className="text-xs font-semibold text-red-600">Процесс остановлен</li>}
    </ol>
);

/** "Approved by …" — each earlier stage's latest sign-off. */
export const PurchaseApprovals: FC<{ approvals: PurchaseApproval[]; title?: string }> = ({ approvals, title = "Согласовано" }) => {
    if (approvals.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {approvals.map((a) => (
                <div key={a.role} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <UserCheckIcon className="size-4 text-emerald-600" />
                    <span className="text-muted-foreground">{ACTOR_LABEL[a.role]}:</span>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
                    {a.comment && <span className="w-full pl-6 text-xs text-muted-foreground">«{a.comment}»</span>}
                </div>
            ))}
        </div>
    );
};

export const PurchaseLogList: FC<{ logs: PurchaseLog[] }> = ({ logs }) => {
    if (logs.length === 0) return <p className="text-xs text-muted-foreground">Записей нет</p>;
    return (
        <ol className="relative flex flex-col gap-3 border-l pl-4">
            {[...logs].reverse().map((l) => (
                <li key={l.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <p>
                        <span className="font-medium">{l.actorName}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                            · {ACTOR_LABEL[l.actorRole]} · {formatDateTime(l.createdAt)}
                        </span>
                    </p>
                    <p className="text-muted-foreground">{l.text}</p>
                    {l.comment && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs">💬 {l.comment}</p>}
                </li>
            ))}
        </ol>
    );
};

/* ───────────── stage actions ───────────── */

export interface StageButton {
    label: string;
    needComment?: boolean;
    /** Blocked until something else on the card is filled in. */
    disabled?: boolean;
    variant?: "default" | "outline" | "destructive" | "secondary";
    run: (comment: string) => Promise<unknown>;
}

/** What the acting role can do right now, with one comment box for all buttons. */
export const StageActions: FC<{ title: string; hint?: ReactNode; buttons: StageButton[]; busy: boolean; children?: ReactNode }> = ({
    title,
    hint,
    buttons,
    busy,
    children,
}) => {
    const [comment, setComment] = useState("");
    if (buttons.length === 0) return null;
    const needsComment = buttons.some((b) => b.needComment);
    return (
        <Section title={title} className="border-primary/40">
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            {children}
            <textarea
                className={cn(FIELD_CLASS, "min-h-16")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={needsComment ? "Комментарий (обязателен для возврата и отклонения)" : "Комментарий (необязательно)"}
            />
            <div className="flex flex-wrap gap-2">
                {buttons.map((b) => (
                    <Button
                        key={b.label}
                        size="sm"
                        variant={b.variant ?? "default"}
                        disabled={busy || b.disabled || (b.needComment && !comment.trim())}
                        onClick={async () => {
                            if (await b.run(comment.trim())) setComment("");
                        }}
                    >
                        {b.label}
                    </Button>
                ))}
            </div>
        </Section>
    );
};

/* ───────────── left column ───────────── */

export type MergeMode = "requests" | "lot";

export const PurchaseList: FC<{ state: PurchaseV2State; onNewRequest: () => void; onMerge: (mode: MergeMode) => void }> = ({
    state,
    onNewRequest,
    onMerge,
}) => {
    const { actor, requests, lots, target, setTarget, onlyTasks, setOnlyTasks, mergeIds, toggleMerge, headMergeIds, lotMergeIds } = state;
    const isHead = actor.role === PurchaseActorRole.DEPT_HEAD;
    const canAct = useCan(ROLE_SECTION[actor.role]);
    const canMerge = (r: PurchaseRequest) => canAct && state.mergeable.some((m) => m.id === r.id);
    const showRequests = actor.role !== PurchaseActorRole.ECONOMIST && actor.role !== PurchaseActorRole.BUDGET_COMMISSION;

    return (
        <Card className="gap-3 p-4">
            <div className="flex flex-col gap-2">
                <CommonSearchInput value={state.search} onChange={state.setSearch} placeholder="Поиск: название, отдел, №" />
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox checked={onlyTasks} onCheckedChange={(v) => setOnlyTasks(Boolean(v))} />
                    {actor.role === PurchaseActorRole.EMPLOYEE ? "Только мои заявки" : "Только ждущие моего решения"}
                </label>
                {actor.role === PurchaseActorRole.EMPLOYEE && (
                    <Can section={PermissionSection.PURCHASE_REQUEST}>
                        <Button size="sm" onClick={onNewRequest}>
                            <PlusIcon className="size-4" /> Новая заявка
                        </Button>
                    </Can>
                )}
                {isHead && (
                    <Can section={PermissionSection.PURCHASE_HEAD}>
                        {lotMergeIds.length > 0 && (
                            <Button size="sm" onClick={() => onMerge("lot")}>
                                <LayersIcon className="size-4" /> Сформировать закупку ({lotMergeIds.length})
                            </Button>
                        )}
                        {headMergeIds.length > 1 && (
                            <Button size="sm" variant="outline" onClick={() => onMerge("requests")}>
                                <LayersIcon className="size-4" /> Объединить заявки отдела ({headMergeIds.length})
                            </Button>
                        )}
                        {mergeIds.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Отметьте заявки: в реализующем отделе — чтобы сформировать закупку, на согласовании — чтобы объединить заявки своего отдела.
                            </p>
                        )}
                    </Can>
                )}
            </div>

            {(showRequests || !onlyTasks) && (
                <ListBlock title="Заявки" empty="Заявок нет" count={requests.length}>
                    {requests.map((r) => (
                        <ListRow
                            key={r.id}
                            active={target?.kind === "request" && target.id === r.id}
                            onClick={() => setTarget({ kind: "request", id: r.id })}
                            check={canMerge(r) ? { checked: mergeIds.includes(r.id), toggle: () => toggleMerge(r.id) } : undefined}
                            title={`#${r.id} ${r.title}`}
                            sub={`${ITEM_TYPE_LABEL[r.itemType]} · ${qty(r.quantity)} ${r.unit} · ${r.department}`}
                            badge={<RequestBadge r={r} />}
                        />
                    ))}
                </ListBlock>
            )}

            {(actor.role !== PurchaseActorRole.EMPLOYEE || lots.length > 0 || !onlyTasks) && (
                <ListBlock title="Закупки" empty="Закупок нет" count={lots.length}>
                    {lots.map((l) => (
                        <ListRow
                            key={l.id}
                            active={target?.kind === "lot" && target.id === l.id}
                            onClick={() => setTarget({ kind: "lot", id: l.id })}
                            title={`#${l.id} ${l.title}`}
                            sub={`${qty(l.quantity)} ${l.unit} · ${l.totalAmount ? rub(l.totalAmount) : "без КП"} · ${state.curatorName(l.curatorId)}`}
                            badge={<LotBadge l={l} />}
                        />
                    ))}
                </ListBlock>
            )}
        </Card>
    );
};

const ListBlock: FC<{ title: string; empty: string; count: number; children: ReactNode }> = ({ title, empty, count, children }) => (
    <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-semibold">
            {title} <span className="font-normal text-muted-foreground">{count}</span>
        </p>
        {count === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <div className="flex max-h-[28rem] flex-col gap-0.5 overflow-y-auto">{children}</div>}
    </div>
);

const ListRow: FC<{
    active: boolean;
    onClick: () => void;
    title: string;
    sub: string;
    badge: ReactNode;
    check?: { checked: boolean; toggle: () => void };
}> = ({ active, onClick, title, sub, badge, check }) => (
    <div className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted", active && "bg-muted")}>
        {check && <Checkbox className="mt-0.5" checked={check.checked} onCheckedChange={check.toggle} aria-label="Выбрать для объединения" />}
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
            <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium">{title}</span>
                {badge}
            </span>
            <span className="truncate text-xs text-muted-foreground">{sub}</span>
        </button>
    </div>
);

/* ───────────── request form ───────────── */

/** The employee fills in what and how much; the department head, editing,
 * also picks the curating vice-rector. */
export const PurchaseRequestFormModal: FC<{
    state: PurchaseV2State;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initial?: PurchaseRequest;
}> = ({ state, open, onOpenChange, initial }) => {
    const [form, setForm] = useState<PurchaseRequestForm>(emptyRequestForm());
    const [lastKey, setLastKey] = useState<string>();
    // Reset when the dialog opens for another request (or a new one).
    const key = open ? (initial?.id ?? "new") : undefined;
    if (key !== lastKey) {
        setLastKey(key);
        if (key) setForm(initial ? requestForm(initial) : emptyRequestForm());
    }

    const { me } = state;
    const set = (patch: Partial<PurchaseRequestForm>) => setForm((f) => ({ ...f, ...patch }));
    // A new request is filed for the author's own department (from MDM);
    // only an administrator, testing, may pick another one.
    const department = initial ? initial.departmentId : form.departmentId || me.department;
    const valid = form.title.trim() && parseQty(form.quantity) > 0 && (initial || department);

    const submit = async () => {
        const ok = initial ? await state.updateRequest(initial.id, form) : await state.createRequest(form);
        if (ok) onOpenChange(false);
    };

    return (
        <CommonModal
            open={open}
            onOpenChange={onOpenChange}
            title={initial ? `Заявка #${initial.id}` : "Новая заявка на закупку"}
            description={initial ? "Изменения попадут в историю заявки." : "Заявка уйдёт начальнику отдела на согласование."}
            className="sm:max-w-lg"
        >
            <div className="flex flex-col gap-3">
                <Field label="Наименование товара или услуги *">
                    <input className={FIELD_CLASS} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Например: Ноутбук для преподавателя" />
                </Field>
                <Field label="Тип *">
                    <select className={FIELD_CLASS} value={form.itemType} onChange={(e) => set({ itemType: Number(e.target.value) as PurchaseItemType })}>
                        <option value={PurchaseItemType.PRODUCT}>{ITEM_TYPE_LABEL[PurchaseItemType.PRODUCT]}</option>
                        <option value={PurchaseItemType.SERVICE}>{ITEM_TYPE_LABEL[PurchaseItemType.SERVICE]}</option>
                    </select>
                </Field>
                <Field label="Количество *">
                    <input className={FIELD_CLASS} inputMode="decimal" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                </Field>
                {!initial && me.admin ? (
                    <Field label="Отдел (администратор)">
                        <select className={FIELD_CLASS} value={department} onChange={(e) => set({ departmentId: Number(e.target.value) })}>
                            <option value={0}>— выберите —</option>
                            {state.overview.departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                ) : (
                    <p className="text-sm">
                        <span className="text-muted-foreground">Отдел: </span>
                        {department ? state.departmentName(department) : <span className="text-amber-700">в вашем профиле не указан — обратитесь к администратору</span>}
                    </p>
                )}
                <Field label="Описание (необязательно)">
                    <textarea className={cn(FIELD_CLASS, "min-h-20")} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Характеристики, для чего нужно" />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button disabled={!valid || state.busy} onClick={submit}>
                        {initial ? "Сохранить" : "Отправить начальнику"}
                    </Button>
                </div>
            </div>
        </CommonModal>
    );
};

/** The implementing department the vice-rector sends a request to. */
export const DepartmentSelect: FC<{ state: PurchaseV2State; value: number; onChange: (id: number) => void; label?: string; hint?: ReactNode }> = ({
    state,
    value,
    onChange,
    label = "Реализующий отдел",
    hint,
}) => (
    <Field label={label} hint={hint}>
        <select className={FIELD_CLASS} value={value} onChange={(e) => onChange(Number(e.target.value))}>
            <option value={0}>— выберите —</option>
            {[...state.overview.departments].sort((x, y) => x.name.localeCompare(y.name, "ru")).map((d) => (
                <option key={d.id} value={d.id}>
                    {d.name}
                </option>
            ))}
        </select>
    </Field>
);

/* ───────────── merging ───────────── */

/** The head merges requests into one request; the vice-rector into a purchase. */
export const PurchaseMergeModal: FC<{ state: PurchaseV2State; mode: MergeMode; open: boolean; onOpenChange: (open: boolean) => void }> = ({
    state,
    mode,
    open,
    onOpenChange,
}) => {
    const ids = mode === "lot" ? state.lotMergeIds : state.headMergeIds;
    const chosen = ids.map(state.requestById).filter((r): r is PurchaseRequest => Boolean(r));
    const [title, setTitle] = useState("");
    const total = chosen.reduce((a, r) => a + r.quantity, 0);
    const units = new Set(chosen.map((r) => r.unit));
    const types = new Set(chosen.map((r) => r.itemType));

    const submit = async () => {
        const ok = mode === "lot" ? await state.createLot(ids, title) : await state.mergeRequests(ids, title);
        if (ok) {
            setTitle("");
            onOpenChange(false);
        }
    };

    return (
        <CommonModal
            open={open}
            onOpenChange={onOpenChange}
            title={mode === "lot" ? "Сформировать закупку" : "Объединить заявки отдела"}
            description={
                mode === "lot"
                    ? "Схожие заявки объединятся в одну закупку вашего отдела. Затем назначьте исполнителя — он подготовит характеристики и КП."
                    : "Выбранные заявки станут одной заявкой с общим количеством; исходные останутся в истории с пометкой «Объединена»."
            }
            className="sm:max-w-lg"
        >
            <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                    {chosen.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2">
                            <span className="truncate">
                                #{r.id} {r.title} <span className="text-muted-foreground">({r.department})</span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                                {qty(r.quantity)} {r.unit}
                            </span>
                        </li>
                    ))}
                    <li className="mt-1 flex justify-between border-t pt-1 font-medium">
                        <span>Итого</span>
                        <span className="tabular-nums">{qty(total)} {chosen[0]?.unit}</span>
                    </li>
                </ul>
                {types.size > 1 && <p className="text-xs text-red-600">Товары и услуги объединить нельзя — снимите лишние галочки.</p>}
                {units.size > 1 && <p className="text-xs text-amber-700">У заявок разные единицы измерения — проверьте количество после объединения.</p>}
                <Field label={mode === "lot" ? "Название закупки" : "Название заявки"} hint="Пусто — возьмём название первой заявки.">
                    <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={chosen[0]?.title} />
                </Field>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button disabled={chosen.length < (mode === "lot" ? 1 : 2) || types.size > 1 || state.busy} onClick={submit}>
                        {mode === "lot" ? "Сформировать" : "Объединить"}
                    </Button>
                </div>
            </div>
        </CommonModal>
    );
};

/* ───────────── request detail ───────────── */

export const PurchaseRequestDetail: FC<{ state: PurchaseV2State; r: PurchaseRequest; onEdit: () => void }> = ({ state, r, onEdit }) => {
    const { actor, busy, me } = state;
    const lot = state.lotById(r.lotId);
    const mergedInto = r.mergedIntoId ? state.requestById(r.mergedIntoId) : undefined;
    // The vice-rector picks where it goes; the title suggests a department.
    const [implementing, setImplementing] = useState(r.implementingDepartment || r.suggestedDepartment);
    const [lastId, setLastId] = useState(r.id);
    if (lastId !== r.id) {
        setLastId(r.id);
        setImplementing(r.implementingDepartment || r.suggestedDepartment);
    }
    const act = (action: PurchaseRequestAction, success: string) => (comment: string) => state.requestAction(r.id, action, comment, success);

    const buttons: StageButton[] = [];
    let stageTitle = "";
    let stageHint: ReactNode;
    const own = me.admin || r.authorUuid === me.uuid || !r.authorUuid;
    if (actor.role === PurchaseActorRole.EMPLOYEE && r.status === PurchaseRequestStatus.REWORK && own) {
        stageTitle = "Доработка заявки";
        buttons.push({ label: "Отправить снова", run: act(PurchaseRequestAction.SUBMIT, "Заявка снова у начальника") });
    }

    const headHere = actor.role === PurchaseActorRole.DEPT_HEAD && r.status === PurchaseRequestStatus.HEAD_REVIEW && state.inMyDepartment(r.departmentId);
    // The vice-rector over the department, from the directory.
    const nextCurator = state.departmentCurator(r.departmentId);
    if (headHere) {
        stageTitle = "Решение начальника отдела";
        stageHint = nextCurator
            ? `После согласования заявка уйдёт проректору: ${state.curatorName(nextCurator)}. Отметьте несколько заявок слева, чтобы объединить их в одну.`
            : "Для отдела не назначен курирующий проректор — согласовать нельзя, обратитесь к администратору.";
        buttons.push(
            {
                label: "Согласовать → проректору",
                disabled: !nextCurator && r.departmentId !== 0,
                run: act(PurchaseRequestAction.HEAD_APPROVE, "Заявка передана проректору"),
            },
            { label: "Вернуть сотруднику", variant: "outline", needComment: true, run: act(PurchaseRequestAction.HEAD_RETURN, "Заявка возвращена") },
            { label: "Отклонить", variant: "destructive", needComment: true, run: act(PurchaseRequestAction.HEAD_REJECT, "Заявка отклонена") },
        );
    }

    const vrHere = actor.role === PurchaseActorRole.VICE_RECTOR && r.status === PurchaseRequestStatus.VICE_RECTOR_REVIEW && state.isMyCurator(r.curatorId);
    if (vrHere) {
        stageTitle = "Решение проректора";
        buttons.push(
            {
                label: "Согласовать → в реализующий отдел",
                disabled: !implementing,
                run: (comment) => state.requestAction(r.id, PurchaseRequestAction.VICE_RECTOR_APPROVE, comment, "Заявка передана в реализующий отдел", implementing),
            },
            { label: "Вернуть начальнику", variant: "outline", needComment: true, run: act(PurchaseRequestAction.VICE_RECTOR_RETURN, "Заявка возвращена начальнику") },
            { label: "Отклонить", variant: "destructive", needComment: true, run: act(PurchaseRequestAction.VICE_RECTOR_REJECT, "Заявка отклонена") },
        );
    }

    const implHere =
        actor.role === PurchaseActorRole.DEPT_HEAD && r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW && state.inMyDepartment(r.implementingDepartment);
    if (implHere) {
        stageTitle = "Реализующий отдел";
        stageHint = "Отметьте эту и схожие заявки в списке слева и нажмите «Сформировать закупку». Если заявка не по профилю отдела — верните её проректору.";
        buttons.push({ label: "Вернуть проректору", variant: "outline", needComment: true, run: act(PurchaseRequestAction.IMPLEMENTER_RETURN, "Заявка возвращена проректору") });
    }

    const canEdit = (actor.role === PurchaseActorRole.EMPLOYEE && r.status === PurchaseRequestStatus.REWORK && own) || headHere;
    const canDelete =
        actor.role === PurchaseActorRole.EMPLOYEE && own && (r.status === PurchaseRequestStatus.REWORK || r.status === PurchaseRequestStatus.REJECTED);

    return (
        <>
            <Card className="gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-heading text-base font-semibold">
                            Заявка #{r.id}: {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {r.authorName} · {r.department} · {formatDateTime(r.createdAt)}
                        </p>
                    </div>
                    <RequestBadge r={r} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Тип</dt>
                    <dd>{ITEM_TYPE_LABEL[r.itemType]}</dd>
                    <dt className="text-muted-foreground">Количество</dt>
                    <dd>
                        {qty(r.quantity)} {r.unit}
                    </dd>
                    <dt className="text-muted-foreground">Отдел</dt>
                    <dd>{r.departmentId ? state.departmentName(r.departmentId) : r.department || "—"}</dd>
                    <dt className="text-muted-foreground">Проректор</dt>
                    <dd>{r.curatorId ? state.curatorName(r.curatorId) : <span className="text-muted-foreground">определится при согласовании начальником</span>}</dd>
                    <dt className="text-muted-foreground">Реализующий отдел</dt>
                    <dd>{r.implementingDepartment ? state.departmentName(r.implementingDepartment) : <span className="text-muted-foreground">выберет проректор</span>}</dd>
                    <dt className="text-muted-foreground">Описание</dt>
                    <dd className="whitespace-pre-wrap">{r.description || "—"}</dd>
                </dl>
                {r.lastComment && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        Причина: {r.lastComment}
                    </p>
                )}
                <PurchaseApprovals approvals={r.approvals} />
                {r.mergedIntoId && (
                    <p className="text-sm">
                        Объединена в заявку{" "}
                        <button className="font-medium text-primary underline" onClick={() => state.setTarget({ kind: "request", id: r.mergedIntoId! })}>
                            #{r.mergedIntoId} {mergedInto?.title}
                        </button>
                        {mergedInto && (
                            <>
                                {" "}
                                — <RequestBadge r={mergedInto} />
                            </>
                        )}
                    </p>
                )}
                {lot && (
                    <p className="text-sm">
                        В закупке{" "}
                        <button className="font-medium text-primary underline" onClick={() => state.setTarget({ kind: "lot", id: lot.id })}>
                            #{lot.id} {lot.title}
                        </button>{" "}
                        — <LotBadge l={lot} />
                    </p>
                )}
                {(canEdit || canDelete) && (
                    <Can section={ROLE_SECTION[actor.role]}>
                    <div className="flex gap-2">
                        {canEdit && (
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <PencilIcon className="size-4" /> Редактировать
                            </Button>
                        )}
                        {canDelete && (
                            <Button size="sm" variant="ghost" onClick={() => state.deleteRequest(r)}>
                                <TrashIcon className="size-4" /> Удалить
                            </Button>
                        )}
                    </div>
                    </Can>
                )}
            </Card>

            <Can section={ROLE_SECTION[actor.role]}>
                <StageActions title={stageTitle} hint={stageHint} buttons={buttons} busy={busy}>
                    {vrHere && (
                        <DepartmentSelect
                            state={state}
                            value={implementing}
                            onChange={setImplementing}
                            hint={
                                r.suggestedDepartment
                                    ? `По виду закупки предлагается: ${state.departmentName(r.suggestedDepartment)}`
                                    : "По наименованию отдел не определился — выберите вручную."
                            }
                        />
                    )}
                </StageActions>
            </Can>

            <Section title="История заявки">
                <PurchaseLogList logs={r.logs} />
            </Section>

            {r.status !== PurchaseRequestStatus.MERGED && (
                <Section title="Этапы">
                    <PurchaseTimeline current={requestStep(r, lot)} />
                </Section>
            )}
        </>
    );
};

/* ───────────── vice-rector: actual purchases ───────────── */

/** After the commission: the purchases of the vice-rector's direction. */
export const PurchaseActualLots: FC<{ state: PurchaseV2State }> = ({ state }) => {
    const lots = state.actualLots;
    if (lots.length === 0) return null;
    return (
        <Section title={`Актуальные закупки (${lots.length})`}>
            <p className="text-xs text-muted-foreground">Одобрены бюджетной комиссией — далее подготовка ТЗ и проведение закупки.</p>
            <div className="flex flex-col gap-0.5">
                {lots.map((l) => (
                    <ListRow
                        key={l.id}
                        active={state.target?.kind === "lot" && state.target.id === l.id}
                        onClick={() => state.setTarget({ kind: "lot", id: l.id })}
                        title={`#${l.id} ${l.title}`}
                        sub={`${rub(l.totalAmount)} · ${state.departmentName(l.implementingDepartment)} · ПФХД ${l.planYear}`}
                        badge={<LotBadge l={l} />}
                    />
                ))}
            </div>
        </Section>
    );
};
