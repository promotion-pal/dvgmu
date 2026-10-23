import { useEffect, useMemo, useState } from "react";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonFilterDateRange, CommonPagination, CommonSearchInput, usePagination } from "@/shared/components/filter";
import { formatDate } from "@/features/utils/date";
import {
    DEBTOR_KIND_HINT,
    DEBTOR_KIND_OF,
    DebtorDiagnose,
    DebtorInfo,
    DebtorKindTabs,
    DebtorOnlyDebt,
    DebtorRefreshButton,
    DebtorSummary,
    DebtorTable,
    DebtorWarnings,
    debtorDue,
    defaultDebtorPeriod,
    sumDebtors,
    useDebtorAdmin,
} from "@/widgets/debtor-admin";
import type { DebtorKindFilter, DebtorPeriod } from "@/widgets/debtor-admin";

export function DebtorAdmin() {
    const { fetch, debtors, fetchedAt, source, kindByInn, warnings, errorMessage } = useDebtorAdmin();
    const [range, setRange] = useState<DebtorPeriod>(defaultDebtorPeriod);
    const [search, setSearch] = useState("");
    const [kind, setKind] = useState<DebtorKindFilter>("person");
    const [onlyDebt, setOnlyDebt] = useState(true);

    // Fresh read from 1C on every visit and period change — the server keeps no copy.
    useEffect(() => {
        fetch(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range.from, range.to]);

    const query = search.trim().toLowerCase();

    // Search and "only with debt" apply to both tabs, so each tab's count is shown before switching.
    const matching = useMemo(
        () =>
            debtors.list.filter(
                (item) =>
                    (!onlyDebt || debtorDue(item) > 0) &&
                    (!query || [item.kontragent, item.contract, item.inn].some((value) => value.toLowerCase().includes(query))),
            ),
        [debtors.list, onlyDebt, query],
    );
    const counts = useMemo(
        () => ({
            person: matching.filter((item) => item.kind === DEBTOR_KIND_OF.person).length,
            organization: matching.filter((item) => item.kind === DEBTOR_KIND_OF.organization).length,
        }),
        [matching],
    );
    // Сначала те, кому платить сейчас больше всего.
    const filtered = useMemo(
        () => matching.filter((item) => item.kind === DEBTOR_KIND_OF[kind]).sort((a, b) => debtorDue(b) - debtorDue(a)),
        [matching, kind],
    );

    const totals = useMemo(() => sumDebtors(filtered), [filtered]);
    const { pageItems, paginationProps } = usePagination(filtered, { resetKey: `${query}|${kind}|${onlyDebt}` });
    const hasData = fetchedAt !== undefined;

    return (
        <CommonWrapper
            title="Задолженность студентов"
            description="Долги по договорам на обучение к оплате на сегодня. Данные из 1С."
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <DebtorKindTabs value={kind} onChange={setKind} counts={counts} />
                    <DebtorRefreshButton loading={debtors.loading} onClick={() => fetch(range)} />
                    <DebtorDiagnose />
                </div>
            }
            filter={{
                render: {
                    count: filtered.length,
                    className: "w-full",
                    children: (
                        <>
                            <CommonSearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder={kind === "organization" ? "Поиск по организации, договору, ИНН" : "Поиск по ФИО, договору, ИНН"}
                                className="self-end"
                            />
                            <CommonFilterDateRange
                                label="Период"
                                from={range.from}
                                to={range.to}
                                onChange={setRange}
                            />
                            <DebtorOnlyDebt checked={onlyDebt} onChange={setOnlyDebt} />
                        </>
                    ),
                },
            }}
        >
            <>
                <DebtorInfo source={source} kindByInn={kindByInn} />
                <p className="mb-4 text-sm text-muted-foreground">{DEBTOR_KIND_HINT[kind]} Нажмите на строку, чтобы увидеть полный остаток, график оплаты и квитанцию.</p>
                <DebtorWarnings warnings={warnings} />
                {hasData && !debtors.error && (
                    <DebtorSummary
                        count={filtered.length}
                        totals={totals}
                        fetchedAt={formatDate("datetime", fetchedAt)}
                    />
                )}
                <DebtorTable
                    list={pageItems}
                    kind={kind}
                    offset={(paginationProps.page - 1) * paginationProps.pageSize}
                    totals={totals}
                    errorMessage={errorMessage}
                    onRetry={() => fetch(range)}
                    // Refreshing keeps the old table on screen; skeleton only on the first load.
                    isLoading={debtors.loading && !hasData}
                    isError={debtors.error}
                    isEmpty={filtered.length === 0}
                />
                <CommonPagination {...paginationProps} />
            </>
        </CommonWrapper>
    );
}
