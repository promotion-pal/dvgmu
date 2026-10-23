import { useState } from "react";
import type { FC, ReactNode } from "react";
import { CheckCircle2Icon, CircleDotIcon, CircleIcon, ClockIcon, LayersIcon, TriangleAlertIcon, PencilIcon, PlusIcon, TrashIcon, UserCheckIcon } from "lucide-react";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { PurchaseLog, PurchaseLot, PurchaseRequest, PurchaseSignOff } from "@dvgmu/contract/fesmu/entity/v3/purchase.entity_pb";
import { CommonModal } from "@/shared/components/modal";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import type { PurchaseV3State, RequestFormValue } from "./purchase-v3.fn";
import {
    formatDateTime,
    nearestDue,
    termText,
    ITEM_TYPE_LABEL,
    LOT_STAGES,
    LOT_STATUS,
    lotKey,
    lotStage,
    parseQty,
    PHASE_LABEL,
    PurchaseItemType,
    PurchaseLotStatus,
    PurchaseMove,
    PurchasePermission,
    PurchaseRequestStatus,
    qty,
    REQUEST_NEXT,
    REQUEST_STATUS,
    requestKey,
    ROLE_LABEL,
    rub,
    TONE_CLASS,
} from "./purchase-v3.schema";

export const FIELD_CLASS = "border rounded-lg px-2 py-1.5 w-full bg-background text-sm disabled:opacity-60";

export const StatusBadge: FC<{ label: string; tone: keyof typeof TONE_CLASS }> = ({ label, tone }) => (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone])}>
        {label}
    </span>
);

export const RequestBadge: FC<{ r: PurchaseRequest }> = ({ r }) => <StatusBadge {...REQUEST_STATUS[r.status]} />;
export const LotBadge: FC<{ l: PurchaseLot }> = ({ l }) => <StatusBadge {...LOT_STATUS(l.status)} />;

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

/** Label–value pairs; empty values are left out. */
export const Facts: FC<{ items: [string, ReactNode][] }> = ({ items }) => {
    const shown = items.filter(([, v]) => v !== "" && v !== undefined && v !== null && v !== false);
    if (shown.length === 0) return null;
    return (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
            {shown.map(([k, v]) => (
                <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                </div>
            ))}
        </dl>
    );
};

/* ───────────── who the user is ───────────── */

export const PurchaseMeCard: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const { me } = state;
    if (!me) return null;
    const directions = me.curatorIds.map((id) => state.curator(id)?.title).filter(Boolean);
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{me.name || "—"}</span>
            {me.position && <span>{me.position}</span>}
            {me.departments.length > 0 ? (
                <span className="text-muted-foreground">{me.departments.map((d) => state.departmentName(d)).join("; ")}</span>
            ) : (
                <span className={me.admin ? "text-muted-foreground" : "text-amber-700"}>
                    {me.admin ? "без отдела — заявку подаёте от любого отдела" : "отдел в профиле не указан — подать заявку нельзя"}
                </span>
            )}
            {directions.length > 0 && <span className="text-muted-foreground">· {directions.join("; ")}</span>}
            {me.admin && <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Администратор</span>}
        </div>
    );
};

/* ───────────── route, sign-offs, log ───────────── */

/** The purchase's place on the route, phase by phase. */
export const LotRoute: FC<{ status: PurchaseLotStatus }> = ({ status }) => {
    const current = status === PurchaseLotStatus.COMPLETED ? LOT_STAGES.length : lotStage(status);
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            {([1, 2, 3] as const).map((phase) => (
                <ol key={phase} className="flex flex-col gap-1.5">
                    <li className="text-xs font-semibold text-muted-foreground">{PHASE_LABEL[phase]}</li>
                    {LOT_STAGES.map((s, i) => {
                        if (s.phase !== phase) return null;
                        const done = current >= 0 && i < current;
                        const active = i === current;
                        const Icon = done ? CheckCircle2Icon : active ? CircleDotIcon : CircleIcon;
                        return (
                            <li key={s.status} className={cn("flex items-center gap-2 text-xs", active ? "font-semibold" : done ? "" : "text-muted-foreground")}>
                                <Icon className={cn("size-3.5 shrink-0", done ? "text-emerald-600" : active ? "text-primary" : "")} />
                                {s.label}
                            </li>
                        );
                    })}
                </ol>
            ))}
            {status === PurchaseLotStatus.REJECTED && <p className="text-xs font-semibold text-red-600 sm:col-span-3">Отклонена бюджетной комиссией</p>}
            {status === PurchaseLotStatus.COMPLETED && <p className="text-xs font-semibold text-emerald-600 sm:col-span-3">Закупка завершена</p>}
        </div>
    );
};

export const SignOffs: FC<{ list: PurchaseSignOff[]; title?: string }> = ({ list, title = "Согласовано" }) => {
    if (list.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {list.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <UserCheckIcon className="size-4 text-emerald-600" />
                    <span className="text-muted-foreground">{ROLE_LABEL[s.role]}:</span>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(s.at)}</span>
                    {s.comment && <span className="w-full pl-6 text-xs text-muted-foreground">«{s.comment}»</span>}
                </div>
            ))}
        </div>
    );
};

export const LogList: FC<{ logs: PurchaseLog[] }> = ({ logs }) => {
    if (logs.length === 0) return <p className="text-xs text-muted-foreground">Записей нет</p>;
    return (
        <ol className="relative flex flex-col gap-3 border-l pl-4">
            {[...logs].reverse().map((l) => (
                <li key={l.id.toString()} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <p>
                        <span className="font-medium">{l.actorName}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                            · {ROLE_LABEL[l.role]} · {formatDateTime(l.createdAt)}
                        </span>
                    </p>
                    <p className="text-muted-foreground">{l.text}</p>
                    {l.comment && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs">💬 {l.comment}</p>}
                </li>
            ))}
        </ol>
    );
};

/* ───────────── moves ───────────── */

export interface MoveButton {
    move: PurchaseMove;
    label: string;
    disabled?: boolean;
}

/** Продолжить / Вернуть / Отклонить with one comment box; return and reject need it. */
export const MovePanel: FC<{
    title: string;
    hint?: ReactNode;
    buttons: MoveButton[];
    busy: boolean;
    onMove: (move: PurchaseMove, comment: string) => Promise<unknown>;
    children?: ReactNode;
}> = ({ title, hint, buttons, busy, onMove, children }) => {
    const [comment, setComment] = useState("");
    if (buttons.length === 0) return null;
    return (
        <Card className="gap-3 border-primary/40 p-4">
            <p className="font-heading text-sm font-semibold">{title}</p>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            {children}
            <textarea
                className={FIELD_CLASS}
                rows={2}
                placeholder="Комментарий (обязателен при возврате и отклонении)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
                {buttons.map((b) => {
                    const needComment = b.move !== PurchaseMove.FORWARD;
                    return (
                        <Button
                            key={b.move}
                            size="sm"
                            variant={b.move === PurchaseMove.FORWARD ? "default" : b.move === PurchaseMove.REJECT ? "destructive" : "outline"}
                            disabled={busy || b.disabled || (needComment && !comment.trim())}
                            onClick={async () => {
                                await onMove(b.move, comment.trim());
                                setComment("");
                            }}
                        >
                            {b.label}
                        </Button>
                    );
                })}
            </div>
        </Card>
    );
};

/* ───────────── lists ───────────── */

/** "Этап: осталось 2 дн." — how much time is left, coloured when it runs out. */
export const TermChip: FC<{ label?: string; due?: Timestamp }> = ({ label, due }) => {
    const term = termText(due);
    if (!term) return null;
    return (
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] whitespace-nowrap", TONE_CLASS[term.tone])}>
            <ClockIcon className="size-3" />
            {label && `${label}: `}
            {term.text}
        </span>
    );
};

const rowClass = (active: boolean) =>
    cn("flex w-full min-w-0 gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50", active && "border-primary bg-muted/50");

const RequestRow: FC<{ state: PurchaseV3State; r: PurchaseRequest; picked?: boolean; onPick?: (on: boolean) => void }> = ({ state, r, picked, onPick }) => (
    <div
        role="button"
        tabIndex={0}
        onClick={() => state.select(requestKey(r))}
        onKeyDown={(e) => e.key === "Enter" && state.select(requestKey(r))}
        className={cn(rowClass(state.selected === requestKey(r)), "cursor-pointer")}
    >
        {onPick && <Checkbox checked={picked} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => onPick(Boolean(v))} className="mt-0.5" />}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Заявка №{r.id.toString()}</span>
                <RequestBadge r={r} />
            </div>
            <span className="line-clamp-2 text-sm font-medium break-words">{r.title}</span>
            <span className="truncate text-xs text-muted-foreground">
                {qty(r.quantity)} {r.unit} · {state.departmentName(r.department)}
            </span>
            {(r.allowed?.moves.length ?? 0) > 0 && <TermChip label="Этап" due={r.stageDue} />}
        </div>
    </div>
);

const LotRow: FC<{ state: PurchaseV3State; l: PurchaseLot }> = ({ state, l }) => (
    <button type="button" onClick={() => state.select(lotKey(l))} className={rowClass(state.selected === lotKey(l))}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <LayersIcon className="size-3.5" /> Закупка №{l.id.toString()}
                </span>
                <LotBadge l={l} />
            </div>
            <span className="line-clamp-2 text-sm font-medium break-words">{l.title}</span>
            <span className="flex min-w-0 justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                    {state.departmentName(l.implementingDepartment)} · {state.curatorName(l.curatorId)}
                </span>
                {l.totalAmount > 0n && <span className="shrink-0 tabular-nums">{rub(l.totalAmount)}</span>}
            </span>
            {((l.stageDue || l.dueAt) && l.status !== PurchaseLotStatus.COMPLETED) || l.reviewNote ? (
                <span className="flex flex-wrap gap-1">
                    {l.status !== PurchaseLotStatus.COMPLETED && <TermChip label="Этап" due={l.stageDue} />}
                    {l.status !== PurchaseLotStatus.COMPLETED && <TermChip label="Срок закупки" due={l.dueAt} />}
                    {l.reviewNote && (
                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]", TONE_CLASS.amber)}>
                            <TriangleAlertIcon className="size-3" /> проверить: {l.reviewNote.split("\n").length}
                        </span>
                    )}
                </span>
            ) : null}
        </div>
    </button>
);

const byDue = <T extends PurchaseLot | PurchaseRequest>(a: T, b: T) => {
    const x = nearestDue(a)?.seconds ?? BigInt(Number.MAX_SAFE_INTEGER);
    const y = nearestDue(b)?.seconds ?? BigInt(Number.MAX_SAFE_INTEGER);
    return x < y ? -1 : x > y ? 1 : 0;
};

/** The left column: tasks, requests or purchases, with picking for merging. */
export const PurchaseList: FC<{
    state: PurchaseV3State;
    onNewRequest: () => void;
    onMerge: (mode: MergeMode, ids: bigint[]) => void;
    /** Shown on the purchases tab instead of the rows (the code layout). */
    lotsContent?: ReactNode;
}> = ({ state, onNewRequest, onMerge, lotsContent }) => {
    const [picked, setPicked] = useState<bigint[]>([]);
    const { view } = state;
    const pick = (id: bigint, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
    const pickedRequests = picked.map((id) => state.requestById(id)).filter((r): r is PurchaseRequest => Boolean(r));
    const allAt = (status: PurchaseRequestStatus) => pickedRequests.length > 0 && pickedRequests.every((r) => r.status === status && r.allowed?.moves.length);
    const tasks = [...state.tasks].sort((a, b) => byDue(a.kind === "request" ? a.r : a.l, b.kind === "request" ? b.r : b.l));
    const lots = state.filteredLots;
    const requests = state.filteredRequests;
    const empty = (text: string) => <p className="p-4 text-center text-sm text-muted-foreground">{text}</p>;

    return (
        <Card className="gap-3 p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                <span>
                    {view === "tasks" ? `Ждут вашего решения: ${tasks.length}` : view === "requests" ? `Заявок: ${requests.length}` : `Закупок: ${lots.length}`}
                    {view !== "lots" && state.activeFilters > 0 && " (с фильтрами)"}
                </span>
                {state.can(PurchasePermission.REQUEST_CREATE) && (
                    <Button size="sm" className="shrink-0" onClick={onNewRequest}>
                        <PlusIcon className="size-4" /> Заявка
                    </Button>
                )}
            </div>

            {view === "requests" && pickedRequests.length > 0 && (
                <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-2 text-xs">
                    <span className="self-center">Выбрано: {pickedRequests.length}</span>
                    {allAt(PurchaseRequestStatus.HEAD_REVIEW) && pickedRequests.length > 1 && (
                        <Button size="sm" variant="outline" onClick={() => onMerge("request", picked)}>
                            Объединить заявки
                        </Button>
                    )}
                    {allAt(PurchaseRequestStatus.IMPLEMENTER_REVIEW) && (
                        <Button size="sm" onClick={() => onMerge("lot", picked)}>
                            <LayersIcon className="size-4" /> Сформировать закупку
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
                        Сбросить
                    </Button>
                </div>
            )}

            {view === "tasks" &&
                (tasks.length === 0
                    ? empty(
                          state.me?.admin
                              ? "Здесь — то, что ждёт вас по вашей должности: ваш отдел, направление или порученное вам. Как администратор действовать в любой заявке и закупке вы можете со вкладок «Заявки» и «Закупки»."
                              : "Задач нет — всё, что ждёт вашего решения, появится здесь.",
                      )
                    : tasks.map((t) => (t.kind === "request" ? <RequestRow key={requestKey(t.r)} state={state} r={t.r} /> : <LotRow key={lotKey(t.l)} state={state} l={t.l} />)))}

            {view === "requests" &&
                (requests.length === 0
                    ? empty(state.activeFilters ? "Под фильтр ничего не подходит" : "Заявок в работе нет — все поданные уже в закупках")
                    : requests.map((r) => {
                          const pickable =
                              (r.status === PurchaseRequestStatus.HEAD_REVIEW || r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW) && (r.allowed?.moves.length ?? 0) > 0;
                          return <RequestRow key={requestKey(r)} state={state} r={r} picked={picked.includes(r.id)} onPick={pickable ? (on) => pick(r.id, on) : undefined} />;
                      }))}

            {view === "requests" && state.requestsInPurchases > 0 && state.filters.status === "" && (
                <p className="px-1 text-xs text-muted-foreground">
                    Ещё {state.requestsInPurchases} заявок уже стали закупками или объединены — они на вкладке{" "}
                    <button type="button" className="text-primary underline" onClick={() => state.setView("lots")}>
                        «Закупки»
                    </button>
                    , внутри своей закупки.
                </p>
            )}

            {view === "lots" && lotsContent}
            {view === "lots" && !lotsContent && (lots.length === 0 ? empty(state.activeFilters ? "Под фильтр ничего не подходит" : "Закупок нет") : lots.map((l) => <LotRow key={lotKey(l)} state={state} l={l} />))}
        </Card>
    );
};

/* ───────────── request form ───────────── */

export const RequestFormModal: FC<{ state: PurchaseV3State; open: boolean; onOpenChange: (open: boolean) => void; initial?: PurchaseRequest }> = ({
    state,
    open,
    onOpenChange,
    initial,
}) => (
    <CommonModal
        open={open}
        onOpenChange={onOpenChange}
        title={initial ? `Заявка №${initial.id}` : "Новая заявка на закупку"}
        description={initial ? "Изменения попадут в историю заявки." : "Заявка уйдёт начальнику вашего отдела на согласование."}
        className="sm:max-w-lg"
    >
        {/* key: a fresh form for each opening */}
        {open && <RequestForm key={initial?.id.toString() ?? "new"} state={state} initial={initial} onDone={() => onOpenChange(false)} />}
    </CommonModal>
);

const RequestForm: FC<{ state: PurchaseV3State; initial?: PurchaseRequest; onDone: () => void }> = ({ state, initial, onDone }) => {
    const own = state.me?.departments ?? [];
    // An administrator without a department of their own files for any one.
    const anyDepartment = Boolean(state.me?.admin) && own.length === 0;
    const departments = anyDepartment ? (state.overview?.departments ?? []).map((d) => d.department) : own;
    const [title, setTitle] = useState(initial?.title ?? "");
    const [itemType, setItemType] = useState(initial?.itemType ?? PurchaseItemType.PRODUCT);
    const [quantity, setQuantity] = useState(initial ? String(initial.quantity).replace(".", ",") : "1");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [department, setDepartment] = useState<number>(anyDepartment ? 0 : (departments[0] ?? 0));
    const q = parseQty(quantity);
    const valid = title.trim() !== "" && q > 0 && (initial !== undefined || department !== 0);

    const submit = async () => {
        const value: RequestFormValue = { title: title.trim(), itemType, quantity: q, description: description.trim(), department };
        const ok = initial ? await state.updateRequest(initial, value) : await state.createRequest(value);
        if (ok) onDone();
    };

    return (
        <div className="flex flex-col gap-3">
            <Field label="Наименование товара или услуги *">
                <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="Например: ноутбук для кафедры" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Тип">
                    <select className={FIELD_CLASS} value={itemType} onChange={(e) => setItemType(Number(e.target.value))}>
                        <option value={PurchaseItemType.PRODUCT}>Товар</option>
                        <option value={PurchaseItemType.SERVICE}>Услуга</option>
                    </select>
                </Field>
                <Field label="Количество *">
                    <input className={FIELD_CLASS} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
                </Field>
            </div>
            {!initial && (departments.length > 1 || anyDepartment) && (
                <Field
                    label="От какого отдела *"
                    hint={anyDepartment ? "У вас в профиле нет отдела — как администратор подайте от любого: заявка уйдёт начальнику этого отдела." : undefined}
                >
                    <select className={FIELD_CLASS} value={department} onChange={(e) => setDepartment(Number(e.target.value))}>
                        {anyDepartment && <option value={0}>— выберите отдел —</option>}
                        {departments.map((d) => (
                            <option key={d} value={d}>
                                {state.departmentName(d)}
                            </option>
                        ))}
                    </select>
                </Field>
            )}
            {!initial && departments.length === 0 && !state.me?.admin && (
                <p className="text-xs text-amber-700">В вашем профиле не указан отдел — заявку подать нельзя, обратитесь к администратору.</p>
            )}
            <Field label="Зачем нужно, требования">
                <textarea className={FIELD_CLASS} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4096} />
            </Field>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onDone}>
                    Отмена
                </Button>
                <Button disabled={!valid || state.busy} onClick={submit}>
                    {initial ? "Сохранить" : "Подать заявку"}
                </Button>
            </div>
        </div>
    );
};

/* ───────────── merging ───────────── */

export type MergeMode = "request" | "lot";

/** The head merges requests into one; the implementing head merges them into a purchase. */
export const MergeModal: FC<{ state: PurchaseV3State; mode?: MergeMode; ids: bigint[]; onClose: () => void }> = ({ state, mode, ids, onClose }) => {
    const list = ids.map((id) => state.requestById(id)).filter((r): r is PurchaseRequest => Boolean(r));
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [direction, setDirection] = useState(0n);
    const total = list.reduce((s, r) => s + r.quantity, 0);
    const implementing = list[0]?.implementingDepartment ?? 0;
    const pickDirection = mode === "lot" && implementing !== 0 && state.needsDirection(implementing);
    return (
        <CommonModal
            open={Boolean(mode)}
            onOpenChange={(open) => !open && onClose()}
            title={mode === "lot" ? "Сформировать закупку" : "Объединить заявки"}
            description={
                mode === "lot"
                    ? "Схожие заявки станут одной закупкой; дальше вы назначите исполнителя."
                    : "Заявки отдела станут одной; исходные останутся в истории как объединённые."
            }
            className="sm:max-w-lg"
        >
            <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-2 text-sm">
                    {list.map((r) => (
                        <li key={r.id.toString()}>
                            №{r.id.toString()} {r.title} — {qty(r.quantity)} {r.unit} <span className="text-xs text-muted-foreground">({state.departmentName(r.department)})</span>
                        </li>
                    ))}
                    <li className="text-xs text-muted-foreground">Итого: {qty(total)}</li>
                </ul>
                <Field label={mode === "lot" ? "Наименование закупки" : "Наименование заявки *"}>
                    <input className={FIELD_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={list[0]?.title} maxLength={255} />
                </Field>
                <Field label="Описание">
                    <textarea className={FIELD_CLASS} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                {pickDirection && <DirectionPick state={state} department={implementing} value={direction} onChange={setDirection} />}
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Отмена
                    </Button>
                    <Button
                        disabled={state.busy || (mode === "request" && !title.trim()) || (pickDirection && !direction)}
                        onClick={async () => {
                            const ok =
                                mode === "lot"
                                    ? await state.createLot(ids, title.trim(), description.trim(), pickDirection ? direction : 0n)
                                    : await state.mergeRequests(ids, title.trim(), description.trim());
                            if (ok) onClose();
                        }}
                    >
                        {mode === "lot" ? "Сформировать" : "Объединить"}
                    </Button>
                </div>
            </div>
        </CommonModal>
    );
};

/** For an administrator where the directory puts the department in no direction. */
export const DirectionPick: FC<{ state: PurchaseV3State; department: number; value: bigint; onChange: (id: bigint) => void }> = ({ state, department, value, onChange }) => (
    <Field
        label="Проректор (направление) *"
        hint={`Отдел «${state.departmentName(department)}» не отнесён к направлению в справочнике. Как администратор выберите сами — или отнесите отдел в «Справочниках», чтобы дальше выбиралось автоматически.`}
    >
        <select className={FIELD_CLASS} value={value.toString()} onChange={(e) => onChange(BigInt(e.target.value))}>
            <option value="0">— выберите направление —</option>
            {state.overview?.curators.map((c) => (
                <option key={c.id.toString()} value={c.id.toString()}>
                    {c.title}
                </option>
            ))}
        </select>
    </Field>
);

/* ───────────── request card ───────────── */

/** Whose turn it is while the request is not the user's to act on. */
const REQUEST_WAITS: Partial<Record<PurchaseRequestStatus, string>> = {
    [PurchaseRequestStatus.HEAD_REVIEW]: "Начальник отдела",
    [PurchaseRequestStatus.REWORK]: "Автор заявки",
    [PurchaseRequestStatus.CURATOR_REVIEW]: "Курирующий проректор",
    [PurchaseRequestStatus.IMPLEMENTER_REVIEW]: "Реализующий отдел",
};

export const RequestDetail: FC<{ state: PurchaseV3State; r: PurchaseRequest; onEdit: () => void }> = ({ state, r, onEdit }) => {
    const allowed = r.allowed;
    const [implementing, setImplementing] = useState<number>(r.suggestedDepartment);
    const [direction, setDirection] = useState(0n);
    const pickDirection = r.status === PurchaseRequestStatus.HEAD_REVIEW && state.needsDirection(r.department);
    const lot = r.lotId ? state.lotById(r.lotId) : undefined;
    const moves = allowed?.moves ?? [];
    const buttons: MoveButton[] = [];
    if (moves.includes(PurchaseMove.FORWARD))
        buttons.push({ move: PurchaseMove.FORWARD, label: REQUEST_NEXT[r.status] ?? "Продолжить", disabled: pickDirection && !direction });
    if (moves.includes(PurchaseMove.RETURN)) buttons.push({ move: PurchaseMove.RETURN, label: "Вернуть на прошлый этап" });
    if (moves.includes(PurchaseMove.REJECT)) buttons.push({ move: PurchaseMove.REJECT, label: "Отклонить" });

    return (
        <div className="flex flex-col gap-4">
            <Section
                title={`Заявка №${r.id}`}
                action={
                    <div className="flex items-center gap-2">
                        {allowed?.edit && (
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <PencilIcon className="size-4" /> Изменить
                            </Button>
                        )}
                        {allowed?.remove && (
                            <Button size="sm" variant="ghost" onClick={() => state.deleteRequest(r)}>
                                <TrashIcon className="size-4" />
                            </Button>
                        )}
                        <RequestBadge r={r} />
                    </div>
                }
            >
                <p className="text-base font-medium">{r.title}</p>
                <Facts
                    items={[
                        ["Тип", ITEM_TYPE_LABEL[r.itemType]],
                        ["Количество", `${qty(r.quantity)} ${r.unit}`],
                        ["Отдел", state.departmentName(r.department)],
                        ["Автор", r.authorName],
                        ["Проректор", r.curatorId ? state.curator(r.curatorId)?.title : ""],
                        ["Реализующий отдел", r.implementingDepartment ? state.departmentName(r.implementingDepartment) : ""],
                        ["Подана", formatDateTime(r.createdAt)],
                        ["Срок этапа", r.stageDue && moves.length > 0 ? <TermChip key="term" due={r.stageDue} /> : ""],
                        ["Описание", r.description],
                    ]}
                />
                {r.lastComment && (r.status === PurchaseRequestStatus.REWORK || r.status === PurchaseRequestStatus.REJECTED || moves.length > 0) && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">💬 {r.lastComment}</p>
                )}
                {lot && (
                    <button type="button" className="flex items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm hover:bg-muted/50" onClick={() => state.select(lotKey(lot))}>
                        <span>
                            В закупке №{lot.id.toString()} «{lot.title}»
                        </span>
                        <LotBadge l={lot} />
                    </button>
                )}
                {r.mergedIntoId > 0n && (
                    <button type="button" className="text-left text-sm text-primary underline" onClick={() => state.select(`r${r.mergedIntoId}`)}>
                        Объединена в заявку №{r.mergedIntoId.toString()}
                    </button>
                )}
                <SignOffs list={r.signOffs} />
            </Section>

            {moves.length === 0 && REQUEST_WAITS[r.status] && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                    <span>
                        Этап: <strong>{REQUEST_STATUS[r.status].label}</strong>
                    </span>
                    <span>
                        Ответственный: <strong>{REQUEST_WAITS[r.status]}</strong>
                    </span>
                    <TermChip label="срок этапа" due={r.stageDue} />
                </div>
            )}
            <MovePanel
                title="Ваше решение"
                busy={state.busy}
                buttons={buttons}
                hint={
                    r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW
                        ? "Чтобы двигать заявку дальше, отметьте её в списке «Заявки» и сформируйте закупку — одну или вместе со схожими."
                        : undefined
                }
                onMove={(move, comment) =>
                    move === PurchaseMove.FORWARD && r.status === PurchaseRequestStatus.CURATOR_REVIEW
                        ? state.moveRequest(r, move, comment, implementing)
                        : state.moveRequest(r, move, comment, 0, move === PurchaseMove.FORWARD && pickDirection ? direction : 0n)
                }
            >
                {pickDirection && moves.includes(PurchaseMove.FORWARD) && (
                    <DirectionPick state={state} department={r.department} value={direction} onChange={setDirection} />
                )}
                {r.status === PurchaseRequestStatus.CURATOR_REVIEW && moves.includes(PurchaseMove.FORWARD) && (
                    <Field label="Реализующий отдел" hint={r.suggestedDepartment ? "Предложен по виду закупки; можно выбрать другой." : "По наименованию не определился — выберите."}>
                        <select className={FIELD_CLASS} value={implementing} onChange={(e) => setImplementing(Number(e.target.value))}>
                            <option value={0}>— выберите —</option>
                            {state.overview?.departments.map((d) => (
                                <option key={d.department} value={d.department}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                )}
            </MovePanel>
            {r.status === PurchaseRequestStatus.IMPLEMENTER_REVIEW && moves.length > 0 && (
                <Button
                    variant="secondary"
                    className="self-start"
                    disabled={state.busy || state.needsDirection(r.implementingDepartment)}
                    onClick={() => state.createLot([r.id], "", "")}
                    title={state.needsDirection(r.implementingDepartment) ? "Отдел без направления — сформируйте через список «Заявки», там можно выбрать проректора" : undefined}
                >
                    <LayersIcon className="size-4" /> Сформировать закупку только из этой заявки
                </Button>
            )}

            <Section title="История">
                <LogList logs={r.logs} />
            </Section>
        </div>
    );
};
