import { useEffect, useRef, useState } from "react";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { Debtor, DebtorOperation } from "@dvgmu/contract/entity/v1/debtor.entity_pb";
import { DebtorKind } from "@dvgmu/contract/enum/v1/debtor.enum_pb";
import { DebtorService } from "@dvgmu/contract/service/v1/debtor.service_pb";
import { useFetchState } from "@/features/lib/fetch";
import { connectTransport } from "@/shared/config/api";

const debtorClient = createClient(DebtorService, connectTransport);

const moneyFormat = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const formatDebtorAmount = (amount: number) => moneyFormat.format(amount);

type DebtorKindFilter = "person" | "organization";

const DEBTOR_KIND_LABEL: Record<DebtorKindFilter, string> = {
    person: "Студенты",
    organization: "Организации",
};

/** Пояснение под вкладкой: кто попадает в перечень. */
const DEBTOR_KIND_HINT: Record<DebtorKindFilter, string> = {
    person: "Обучающиеся по договорам об оказании платных образовательных услуг и их плательщики (физические лица).",
    organization:
        "Организации и органы власти — в основном заказчики целевого обучения. Обучающийся, как правило, указан в наименовании договора.",
};

const DEBTOR_KIND_OF: Record<DebtorKindFilter, DebtorKind> = {
    person: DebtorKind.PERSON,
    organization: DebtorKind.ORGANIZATION,
};

interface DebtorPeriod {
    from?: string;
    to?: string;
}

const toISODate = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** This year so far — the same default the server uses for an empty period. */
const defaultDebtorPeriod = (): DebtorPeriod => {
    const now = new Date();
    return { from: `${now.getFullYear()}-01-01`, to: toISODate(now) };
};

const debtorErrorMessage = (error: unknown): string => {
    const err = ConnectError.from(error);
    switch (err.code) {
        case Code.InvalidArgument:
            return err.rawMessage.replace(/^debtor: invalid request: /, "") || "Некорректный период.";
        case Code.FailedPrecondition:
            return "Подключение к 1С не настроено на сервере (переменные ONEC_*).";
        case Code.Unavailable:
            return "1С сейчас недоступна. Попробуйте обновить позже.";
        case Code.DeadlineExceeded:
            return "1С не ответила вовремя. Попробуйте обновить ещё раз.";
        default:
            return "Не удалось получить данные из 1С.";
    }
};

/**
 * Сколько по договору нужно оплатить сейчас. С графиком — расчёт сервера
 * (остаток минус платежи, срок которых не наступил); без графика 1С —
 * весь остаток, иначе долг потерялся бы.
 */
const debtorDue = (item: Debtor) => (item.hasSchedule ? item.dueNow : item.current);

/** ISO `YYYY-MM-DD` → `ДД.ММ.ГГГГ`. */
const formatDebtorDate = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "—");

const todayISO = () => toISODate(new Date());

/** Первый платёж графика со сроком сегодня или позже. */
const nextPayment = (item: Debtor, today = todayISO()) => item.schedule.find((p) => p.until >= today);

interface DebtorTotals {
    due: number;
    current: number;
    opening: number;
    debit: number;
    credit: number;
    closing: number;
    /** Договоры без графика оплаты в 1С: для них «к оплате» = весь остаток. */
    withoutSchedule: number;
}

const sumDebtors = (list: Debtor[]): DebtorTotals =>
    list.reduce(
        (acc, item) => ({
            due: acc.due + debtorDue(item),
            current: acc.current + item.current,
            opening: acc.opening + item.opening,
            debit: acc.debit + item.debit,
            credit: acc.credit + item.credit,
            closing: acc.closing + item.closing,
            withoutSchedule: acc.withoutSchedule + (item.hasSchedule ? 0 : 1),
        }),
        { due: 0, current: 0, opening: 0, debit: 0, credit: 0, closing: 0, withoutSchedule: 0 },
    );

/**
 * Операции по одному договору (начисления и оплаты с датами и документами).
 * Грузятся при раскрытии строки, чтобы не замедлять загрузку всего перечня.
 */
const useDebtorOperations = (contractRef: string) => {
    const [operations, setOperations] = useState<DebtorOperation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        debtorClient
            .debtorOperations({ contractRef })
            .then((response) => {
                if (!cancelled) setOperations(response.operations);
            })
            .catch((err: unknown) => {
                console.error("Ошибка при получении операций по договору:", err);
                // Точный текст ошибки 1С — чтобы по скриншоту было видно причину.
                const detail = ConnectError.from(err).rawMessage;
                if (!cancelled) setError(detail ? `${debtorErrorMessage(err)} Подробности: ${detail}` : debtorErrorMessage(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [contractRef]);

    return { operations, loading, error };
};

/**
 * Data is never cached on the server: every fetch reads 1C's totals for the
 * period, so the page loads fresh data on open, on a period change and on
 * each «Обновить».
 */
const useDebtorAdmin = () => {
    const state = useFetchState<Debtor>();
    const [fetchedAt, setFetchedAt] = useState<Timestamp>();
    const [source, setSource] = useState("");
    const [period, setPeriod] = useState({ from: "", to: "" });
    const [kindByInn, setKindByInn] = useState(false);
    // Графики и квитанции читаются отдельно: если 1С их не отдала, обороты
    // всё равно приходят, а страница предупреждает, чего не хватает.
    const [warnings, setWarnings] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState("");
    // A 1C read takes seconds; a reply to an older period must not overwrite a newer one.
    const lastRequest = useRef(0);

    const fetch = async ({ from, to }: DebtorPeriod) => {
        const id = ++lastRequest.current;
        state.setLoading(true);
        state.setError(false);

        try {
            const response = await debtorClient.debtorFetch({ dateFrom: from ?? "", dateTo: to ?? "" });
            if (id !== lastRequest.current) return;
            state.setList(response.debtors);
            setFetchedAt(response.fetchedAt);
            setSource(response.source);
            setPeriod({ from: response.periodFrom, to: response.periodTo });
            setKindByInn(response.kindByInn);
            setWarnings(
                [
                    response.scheduleError &&
                        `Графики оплаты не получены: ${response.scheduleError}. Сумма «К оплате сейчас» показана равной полному остатку.`,
                    response.receiptError && `Квитанции не получены: ${response.receiptError}.`,
                ].filter((w): w is string => Boolean(w)),
            );
        } catch (error) {
            if (id !== lastRequest.current) return;
            console.error("Ошибка при получении задолженности из 1С:", error);
            setErrorMessage(debtorErrorMessage(error));
            state.setError(true);
        } finally {
            if (id === lastRequest.current) state.setLoading(false);
        }
    };

    return { fetch, debtors: state, fetchedAt, source, period, kindByInn, warnings, errorMessage };
};

export {
    useDebtorAdmin,
    sumDebtors,
    useDebtorOperations,
    debtorDue,
    nextPayment,
    todayISO,
    formatDebtorDate,
    formatDebtorAmount,
    defaultDebtorPeriod,
    DEBTOR_KIND_LABEL,
    DEBTOR_KIND_HINT,
    DEBTOR_KIND_OF,
};
export type { DebtorKindFilter, DebtorPeriod, DebtorTotals };
