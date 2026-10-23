import { Fragment, useState } from "react";
import type { ComponentProps, FC } from "react";
import { ChevronDownIcon, InfoIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import type { Debtor } from "@dvgmu/contract/fesmu/entity/v1/debtor.entity_pb";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonError } from "@/shared/components/state/error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { DEBTOR_COLUMN_ORIGIN, DEBTOR_COLUMNS } from "./debtor-admin.columns";
import type { DebtorColumn } from "./debtor-admin.columns";
import {
    DEBTOR_KIND_LABEL,
    debtorDue,
    formatDebtorAmount,
    formatDebtorDate,
    todayISO,
    useDebtorOperations,
} from "./debtor-admin.fn";
import type { DebtorKindFilter, DebtorTotals } from "./debtor-admin.fn";

interface DebtorRefreshButtonProps {
    loading: boolean;
    onClick: () => void;
}
const DebtorRefreshButton: FC<DebtorRefreshButtonProps> = ({ loading, onClick }) => (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
        <RefreshCwIcon className={cn(loading && "animate-spin")} />
        {loading ? "Загрузка из 1С…" : "Обновить"}
    </Button>
);

interface DebtorKindTabsProps {
    value: DebtorKindFilter;
    onChange: (value: DebtorKindFilter) => void;
    /** Число записей на каждой вкладке с учётом остальных фильтров. */
    counts: Record<DebtorKindFilter, number>;
}
const DebtorKindTabs: FC<DebtorKindTabsProps> = ({ value, onChange, counts }) => (
    <div role="tablist" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/40">
        {(Object.keys(DEBTOR_KIND_LABEL) as DebtorKindFilter[]).map((key) => (
            <button
                key={key}
                type="button"
                role="tab"
                aria-selected={value === key}
                onClick={() => onChange(key)}
                className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    value === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
            >
                {DEBTOR_KIND_LABEL[key]}
                <span className="text-xs text-muted-foreground tabular-nums">{counts[key]}</span>
            </button>
        ))}
    </div>
);

interface DebtorOnlyDebtProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}
const DebtorOnlyDebt: FC<DebtorOnlyDebtProps> = ({ checked, onChange }) => (
    <label className="flex items-center gap-2 self-end h-9 text-sm cursor-pointer select-none">
        <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
        Только с суммой к оплате
    </label>
);

/** Предупреждения: какие данные 1С не получены (графики, квитанции). */
const DebtorWarnings: FC<{ warnings: string[] }> = ({ warnings }) =>
    warnings.length === 0 ? null : (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <TriangleAlertIcon className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex flex-col gap-1">
                {warnings.map((w) => (
                    <p key={w}>{w}</p>
                ))}
            </div>
        </div>
    );

const SummaryTile: FC<{ label: string; value: string; hint?: string; accent?: boolean }> = ({ label, value, hint, accent }) => (
    <div className={cn("rounded-lg border border-border p-3 min-w-0", accent && "border-primary/40 bg-primary/5")}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums truncate">{value}</p>
        {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
    </div>
);

interface DebtorSummaryProps {
    count: number;
    totals: DebtorTotals;
    fetchedAt: string;
}
const DebtorSummary: FC<DebtorSummaryProps> = ({ count, totals, fetchedAt }) => (
    <div className="flex flex-col gap-2 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryTile label="К оплате сейчас" value={formatDebtorAmount(totals.due)} hint={`Договоров: ${count}`} accent />
            <SummaryTile label="Остаток по договорам за весь срок" value={formatDebtorAmount(totals.current)} />
            <SummaryTile label="Оплачено за период" value={formatDebtorAmount(totals.credit)} hint={`Начислено ${formatDebtorAmount(totals.debit)}`} />
            <SummaryTile
                label="Без графика оплаты в 1С"
                value={String(totals.withoutSchedule)}
                hint="К оплате — весь остаток"
            />
        </div>
        <p className="text-xs text-muted-foreground">Последнее обновление: {fetchedAt}</p>
    </div>
);

const Amount: FC<{ value: number; className?: string }> = ({ value, className }) => (
    <span className={cn("tabular-nums", value === 0 && "text-muted-foreground", className)}>{formatDebtorAmount(value)}</span>
);

/** Column title with a hint on where the value comes from. */
const DebtorColumnHead: FC<{ column: DebtorColumn; kind: DebtorKindFilter }> = ({ column, kind }) => (
    <span className={cn("inline-flex items-center gap-1", column.numeric && "flex-row-reverse")}>
        {column.titleByKind?.[kind] ?? column.title}
        <Tooltip>
            <TooltipTrigger asChild>
                <button type="button" aria-label={`Как получается «${column.title}»`} className="text-muted-foreground hover:text-foreground">
                    <InfoIcon className="size-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent className="flex-col items-start text-left font-normal">
                <span className="font-medium">{DEBTOR_COLUMN_ORIGIN[column.origin]}</span>
                <span>{column.rule}</span>
            </TooltipContent>
        </Tooltip>
    </span>
);

// Ближайший платёж и квитанция видны в раскрытой строке (график и квитанция), в таблице их нет.
const HIDDEN_COLUMNS = new Set(["next", "receipt"]);
const ROW_COLUMNS = DEBTOR_COLUMNS.filter((column) => !column.detail && !HIDDEN_COLUMNS.has(column.key));

const DueCell: FC<{ item: Debtor }> = ({ item }) =>
    item.hasSchedule ? (
        <Amount value={item.dueNow} className={cn("font-semibold", item.dueNow > 0 && "text-destructive")} />
    ) : (
        <div className="flex flex-col items-end">
            <Amount value={item.current} className="font-semibold" />
            <span className="text-xs text-muted-foreground">нет графика — весь остаток</span>
        </div>
    );

const DetailStat: FC<{ label: string; value: number; strong?: boolean }> = ({ label, value, strong }) => (
    <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Amount value={value} className={cn(strong && "font-semibold")} />
    </div>
);

/** Все проводки по договору: начисления и оплаты с датами и документами. */
const DebtorOperations: FC<{ contractRef: string }> = ({ contractRef }) => {
    const { operations, loading, error } = useDebtorOperations(contractRef);
    if (loading) {
        return (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" /> Загрузка операций из 1С…
            </p>
        );
    }
    if (error) return <p className="text-sm text-destructive whitespace-pre-wrap break-words">{error}</p>;
    if (operations.length === 0) return <p className="text-sm text-muted-foreground">Операций по договору в 1С нет.</p>;

    // Нарастающий остаток после каждой операции.
    const balances = operations.reduce<number[]>((acc, op) => [...acc, (acc.at(-1) ?? 0) + op.debit - op.credit], []);
    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Документ</TableHead>
                        <TableHead className="text-right">Начислено</TableHead>
                        <TableHead className="text-right">Оплачено / списано</TableHead>
                        <TableHead className="text-right">Остаток</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {operations.map((op, i) => {
                        return (
                            <TableRow key={i}>
                                <TableCell className="tabular-nums">{formatDebtorDate(op.date)}</TableCell>
                                <TableCell className="whitespace-normal">
                                    {op.document.replace(/^Документ\./, "")}
                                    {op.number && <span className="text-muted-foreground"> № {op.number}</span>}
                                </TableCell>
                                <TableCell className="text-right">{op.debit ? <Amount value={op.debit} /> : ""}</TableCell>
                                <TableCell className="text-right">{op.credit ? <Amount value={op.credit} /> : ""}</TableCell>
                                <TableCell className="text-right"><Amount value={balances[i]} /></TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

/** Полная информация по договору — в раскрытой строке. */
const DebtorDetails: FC<{ item: Debtor; today: string }> = ({ item, today }) => (
    <div className="grid gap-4 p-3 lg:grid-cols-3 bg-muted/30 rounded-lg">
        <section className="flex flex-col gap-2 lg:col-span-3">
            <h4 className="text-sm font-medium">Операции по договору (счёт 205.31)</h4>
            {item.contractRef ? (
                <DebtorOperations contractRef={item.contractRef} />
            ) : (
                <p className="text-sm text-muted-foreground">Ссылка на договор не получена.</p>
            )}
        </section>
        <section className="flex flex-col gap-3">
            <h4 className="text-sm font-medium">Задолженность</h4>
            <div className="grid grid-cols-2 gap-3">
                <DetailStat label="К оплате сейчас" value={debtorDue(item)} strong />
                <DetailStat label="Остаток по договору (весь срок)" value={item.current} />
                <DetailStat label="На начало периода" value={item.opening} />
                <DetailStat label="Начислено за период" value={item.debit} />
                <DetailStat label="Оплачено за период" value={item.credit} />
                <DetailStat label="На конец периода" value={item.closing} />
            </div>
        </section>

        {item.schedule.length > 0 && (
            <section className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">График оплаты</h4>
                <ul className="flex flex-col gap-1 text-sm">
                    {item.schedule.map((p, i) => {
                        const due = p.until <= today;
                        return (
                            <li key={i} className="flex justify-between gap-3">
                                <span className="tabular-nums">до {formatDebtorDate(p.until)}</span>
                                <span className="flex items-center gap-2">
                                    <span className="tabular-nums">{formatDebtorAmount(p.amount)}</span>
                                    <Badge variant={due ? "secondary" : "outline"}>{due ? "срок наступил" : "предстоит"}</Badge>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        )}

        {item.receipt && (
            <section className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Квитанция на оплату</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Номер</dt>
                    <dd>
                        {item.receipt.number} от {formatDebtorDate(item.receipt.date)}
                    </dd>
                    <dt className="text-muted-foreground">Сумма</dt>
                    <dd className="tabular-nums">{formatDebtorAmount(item.receipt.amount)}</dd>
                    <dt className="text-muted-foreground">Действует до</dt>
                    <dd>{item.receipt.validUntil ? formatDebtorDate(item.receipt.validUntil) : "—"}</dd>
                    <dt className="text-muted-foreground">УИН</dt>
                    <dd className="font-mono text-xs break-all">{item.receipt.uin || "—"}</dd>
                    <dt className="text-muted-foreground">Назначение</dt>
                    <dd className="whitespace-normal">{item.receipt.purpose || "—"}</dd>
                </dl>
            </section>
        )}
    </div>
);

interface DebtorTableProps extends ComponentProps<typeof CommonControlState> {
    list: Debtor[];
    /** Вкладка, на которой показана таблица: меняет заголовок колонки контрагента. */
    kind: DebtorKindFilter;
    /** Row number of the first item, so numbering continues across pages. */
    offset: number;
    /** Totals over every filtered row, not just this page. */
    totals: DebtorTotals;
    errorMessage: string;
    onRetry: () => void;
}
const DebtorTable: FC<DebtorTableProps> = ({ list, kind, offset, totals, errorMessage, onRetry, ...state }) => {
    const [open, setOpen] = useState<Set<string>>(() => new Set());
    const today = todayISO();
    const toggle = (key: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    return (
        <CommonControlState
            {...state}
            error={<CommonError title="1С не ответила" description={errorMessage} onRetry={onRetry} />}
        >
            <TooltipProvider delayDuration={150}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {ROW_COLUMNS.map((column) => (
                                <TableHead key={column.key} className={cn(column.key === "index" && "w-12", column.numeric && "text-right")}>
                                    <DebtorColumnHead column={column} kind={kind} />
                                </TableHead>
                            ))}
                            <TableHead className="w-8" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((item, i) => {
                            const key = `${item.kontragent}|${item.contract}|${offset + i}`;
                            const expanded = open.has(key);
                            return (
                                <Fragment key={key}>
                                    <TableRow
                                        className="cursor-pointer"
                                        onClick={() => toggle(key)}
                                        aria-expanded={expanded}
                                    >
                                        <TableCell className="text-muted-foreground tabular-nums align-top">{offset + i + 1}</TableCell>
                                        <TableCell className="whitespace-normal align-top">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span>{item.kontragent || "—"}</span>
                                                {item.inn && <span className="font-mono text-xs text-muted-foreground">ИНН {item.inn}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-normal align-top">{item.contract || "—"}</TableCell>
                                        <TableCell className="text-right align-top"><DueCell item={item} /></TableCell>
                                        <TableCell className="align-top text-muted-foreground">
                                            <ChevronDownIcon className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                                        </TableCell>
                                    </TableRow>
                                    {expanded && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={ROW_COLUMNS.length + 1} className="whitespace-normal">
                                                <DebtorDetails item={item} today={today} />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-medium">Итого по фильтру</TableCell>
                            <TableCell className="text-right"><Amount value={totals.due} className="font-semibold" /></TableCell>
                            <TableCell colSpan={3} className="text-xs text-muted-foreground">
                                Остаток за весь срок: {formatDebtorAmount(totals.current)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TooltipProvider>
        </CommonControlState>
    );
};

export { DebtorKindTabs, DebtorRefreshButton, DebtorOnlyDebt, DebtorSummary, DebtorTable, DebtorWarnings };
