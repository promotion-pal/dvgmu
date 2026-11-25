import { useEffect, useState } from "react";
import type { FC } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { PurchaseActivity } from "@fesmu/contract/fesmu/entity/v3/purchase.entity_pb";
import { CommonSearchInput } from "@/shared/components/filter";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import type { PurchaseV3State } from "./purchase-v3.fn";
import { formatDateTime, ROLE_LABEL, toDate } from "./purchase-v3.schema";
import { FIELD_CLASS } from "./purchase-v3.ui";

const PERIODS = [
    [7, "7 дней"],
    [30, "30 дней"],
    [90, "90 дней"],
    [0, "Всё время"],
] as const;

type Sort = "total" | "visits" | "last" | "name";

const DAY = 24 * 60 * 60 * 1000;
/** Not seen for this long — the employee has stopped using the module. */
const IDLE_DAYS = 14;

/** The latest of the last action and the last opening of the page. */
const lastSeen = (a: PurchaseActivity) => Math.max(toDate(a.lastAt)?.getTime() ?? 0, toDate(a.lastVisitAt)?.getTime() ?? 0);

const daysAgo = (a: PurchaseActivity) => {
    const last = lastSeen(a);
    return last ? Math.floor((Date.now() - last) / DAY) : Infinity;
};

const ago = (days: number) => (days === 0 ? "сегодня" : days === 1 ? "вчера" : days === Infinity ? "—" : `${days} дн. назад`);

const Tile: FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => (
    <Card className="gap-1 p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
);

const Num: FC<{ label: string; value: number; className?: string }> = ({ label, value, className }) => (
    <span className={cn("flex flex-col items-end tabular-nums", value === 0 && "text-muted-foreground", className)}>
        <span className="text-sm font-medium">{value}</span>
        <span className="text-[11px] text-muted-foreground sm:hidden">{label}</span>
    </span>
);

const COLUMNS = "sm:grid-cols-[minmax(0,1fr)_repeat(7,64px)_110px]";

/** Who uses the module: openings of the page and actions per employee, for
 *  administrators and those with «Статистика работы сотрудников». */
export const ActivityView: FC<{ state: PurchaseV3State }> = ({ state }) => {
    const [days, setDays] = useState<number>(30);
    const [list, setList] = useState<PurchaseActivity[]>();
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState(0);
    const [sort, setSort] = useState<Sort>("total");
    const [open, setOpen] = useState("");

    useEffect(() => {
        let live = true;
        state
            .fetchActivity(days)
            .then((l) => {
                if (!live) return;
                setList(l);
                setError("");
            })
            .catch((err: Error) => live && setError(err.message));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days]);

    const all = list ?? [];
    const departments = [...new Set(all.flatMap((a) => a.departments))]
        .filter(Boolean)
        .map((d) => ({ d, name: state.departmentName(d) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const q = search.trim().toLocaleLowerCase("ru");
    const shown = all
        .filter((a) => !q || `${a.name} ${a.position}`.toLocaleLowerCase("ru").includes(q))
        .filter((a) => !department || a.departments.includes(department))
        .sort((x, y) =>
            sort === "name"
                ? x.name.localeCompare(y.name, "ru")
                : sort === "last"
                  ? lastSeen(y) - lastSeen(x)
                  : sort === "visits"
                    ? y.visits - x.visits
                    : y.total - x.total || y.visits - x.visits,
        );

    const visited = shown.filter((a) => a.visits > 0).length;
    const working = shown.filter((a) => a.total > 0).length;
    const actions = shown.reduce((s, a) => s + a.total, 0);
    const watching = shown.filter((a) => a.visits > 0 && a.total === 0).length;
    const idle = shown.filter((a) => daysAgo(a) >= IDLE_DAYS).length;

    return (
        <div className="flex flex-col gap-4">
            <Card className="gap-2 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Период">
                        {PERIODS.map(([d, label]) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDays(d)}
                                className={cn("flex-1 rounded-md px-3 py-1", days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <CommonSearchInput className="min-w-0 flex-1 [&_input]:w-full" value={search} onChange={setSearch} placeholder="Сотрудник или должность" />
                    {departments.length > 1 && (
                        <select className={cn(FIELD_CLASS, "w-full sm:w-auto sm:max-w-56")} value={department} onChange={(e) => setDepartment(Number(e.target.value))} aria-label="Отдел">
                            <option value={0}>Все отделы</option>
                            {departments.map(({ d, name }) => (
                                <option key={d} value={d}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    )}
                    <select className={cn(FIELD_CLASS, "w-full sm:w-auto")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
                        <option value="total">Больше действий</option>
                        <option value="visits">Чаще заходят</option>
                        <option value="last">Недавно были</option>
                        <option value="name">По алфавиту</option>
                    </select>
                </div>
                <p className="text-xs text-muted-foreground">
                    «Заходы» — сколько раз сотрудник открыл страницу «Закупки» (считаются с момента выкладки этой версии). «Действия» — подача заявок, «Продолжить» и
                    «Вернуть», правки, файлы, решения комиссии; импортированные записи не считаются.
                    {!state.me?.admin && " Видны сотрудники и действия вашего отдела или направления."}
                </p>
            </Card>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {!list && !error && <p className="p-4 text-center text-sm text-muted-foreground">Загрузка…</p>}

            {list && (
                <>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                        <Tile label="Заходили в закупки" value={visited} hint="открывали страницу за период" />
                        <Tile label="Работали в модуле" value={working} hint={`${actions} действий за период`} />
                        <Tile label="Только смотрят" value={watching} hint="заходили, но ничего не сделали" />
                        <Tile label="Активны за неделю" value={shown.filter((a) => daysAgo(a) < 7).length} hint="заход или действие за 7 дней" />
                        <Tile label={`Не заходят ${IDLE_DAYS}+ дней`} value={idle} hint="последний раз давно" />
                    </div>

                    <Card className="gap-0 overflow-hidden p-0">
                        <div className={cn("hidden gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid", COLUMNS)}>
                            <span>Сотрудник</span>
                            <span className="text-right">Заходов</span>
                            <span className="text-right">Действий</span>
                            <span className="text-right">Заявок</span>
                            <span className="text-right">Продвинул</span>
                            <span className="text-right">Вернул</span>
                            <span className="text-right">Правки</span>
                            <span className="text-right">Файлы</span>
                            <span className="text-right">Последний раз</span>
                        </div>
                        {shown.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">За этот период никто не заходил</p>}
                        {shown.map((a) => {
                            const opened = open === a.uuid;
                            const last = daysAgo(a);
                            return (
                                <div key={a.uuid} className="border-b last:border-b-0">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(opened ? "" : a.uuid)}
                                        className={cn("grid w-full grid-cols-4 items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 sm:grid-cols-none", COLUMNS, opened && "bg-muted/40")}
                                    >
                                        <span className="col-span-4 flex min-w-0 items-start gap-2 sm:col-span-1">
                                            <ChevronRightIcon className={cn("mt-0.5 size-4 shrink-0 transition-transform", opened && "rotate-90")} />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">{a.name || "Без имени"}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {[a.position, a.departments.map((d) => state.departmentName(d)).join(", ")].filter(Boolean).join(" · ") || "Должность не указана"}
                                                </span>
                                            </span>
                                        </span>
                                        <Num label="заходов" value={a.visits} />
                                        <Num label="действий" value={a.total} />
                                        <Num label="заявок" value={a.created} />
                                        <Num label="продвинул" value={a.forwards} />
                                        <Num label="вернул" value={a.returns} />
                                        <Num label="правки" value={a.edits} />
                                        <Num label="файлы" value={a.files} />
                                        <span className="col-span-4 flex flex-col text-xs sm:col-span-1 sm:items-end">
                                            <span className={cn(last >= IDLE_DAYS && "text-amber-600 dark:text-amber-400")}>{ago(last)}</span>
                                            <span className="text-muted-foreground">{a.activeDays} дн. активности</span>
                                        </span>
                                    </button>
                                    {opened && (
                                        <div className="flex flex-col gap-2 bg-muted/20 px-3 py-3 sm:pl-9">
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                <span>Последний заход: {formatDateTime(a.lastVisitAt)}</span>
                                                <span>Роли: {a.roles.map((r) => ROLE_LABEL[r]).join(", ") || "—"}</span>
                                                <span>Записей затронуто: {a.records}</span>
                                                {a.total > 0 && (
                                                    <span>
                                                        Первое действие: {formatDateTime(a.firstAt)} · последнее: {formatDateTime(a.lastAt)}
                                                    </span>
                                                )}
                                            </div>
                                            {a.recent.length > 0 ? (
                                                <>
                                                    <p className="text-xs font-medium">Последние действия</p>
                                                    <ul className="flex flex-col gap-1">
                                                        {a.recent.map((l) => (
                                                            <li key={l.id.toString()} className="grid gap-x-3 text-xs sm:grid-cols-[120px_1fr]">
                                                                <span className="text-muted-foreground tabular-nums">{formatDateTime(l.createdAt)}</span>
                                                                <span className="min-w-0">
                                                                    <span className="text-muted-foreground">{ROLE_LABEL[l.role]}:</span> {l.text}
                                                                    {l.comment && <span className="text-muted-foreground"> — «{l.comment}»</span>}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">Заходил, но действий за период нет.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Card>
                </>
            )}
        </div>
    );
};
