/*
 * Описание колонок таблицы задолженности. Используется и в заголовках таблицы
 * (подсказки), и в справочном блоке, чтобы названия и методика совпадали.
 * Поля 1С должны соответствовать api/internal/utils/1c (schema.go, turnover.go).
 */

type DebtorColumnKey =
    | "index"
    | "kontragent"
    | "contract"
    | "due"
    | "next"
    | "receipt"
    | "current"
    | "opening"
    | "debit"
    | "credit"
    | "closing"
    | "schedule"
    | "operations";

type DebtorColumnOrigin = "1c" | "calc" | "app";

interface DebtorColumn {
    key: DebtorColumnKey;
    /** Заголовок колонки — дословно как в таблице. */
    title: string;
    /** Заголовок на вкладках «Студенты» / «Организации», если отличается. */
    titleByKind?: { person: string; organization: string };
    origin: DebtorColumnOrigin;
    /** Поле 1С, из которого берётся значение; для расчётных колонок пусто. */
    field?: string;
    rule: string;
    numeric?: boolean;
    /** Показывается не в строке таблицы, а в раскрытой по клику строке. */
    detail?: boolean;
}

const DEBTOR_COLUMN_ORIGIN: Record<DebtorColumnOrigin, string> = {
    "1c": "Поле 1С",
    calc: "Расчётный показатель",
    app: "Формируется в приложении",
};

const DEBTOR_COLUMNS: DebtorColumn[] = [
    {
        key: "index",
        title: "№",
        origin: "app",
        rule: "Порядковый номер записи после применения фильтров. Записи упорядочены по сумме «К оплате сейчас», от большей к меньшей.",
    },
    {
        key: "kontragent",
        title: "Контрагент",
        titleByKind: { person: "Студент (плательщик)", organization: "Организация" },
        origin: "1c",
        field: "_Reference203._Description",
        rule: "Наименование контрагента (обучающегося или плательщика) из справочника контрагентов по первому субконто счёта 205.31. На вкладке «Студенты» колонка называется «Студент (плательщик)», на вкладке «Организации» — «Организация».",
    },
    {
        key: "contract",
        title: "Договор",
        origin: "1c",
        field: "_Reference129._Description",
        rule: "Наименование договора из справочника договоров по второму субконто счёта 205.31.",
    },
    {
        key: "due",
        title: "К оплате сейчас",
        origin: "calc",
        rule: "Текущий остаток по договору за вычетом платежей графика оплаты, срок которых («Оплатить до») ещё не наступил. Остаток уже учитывает все поступившие оплаты; при оплате вперёд — 0. Если графика оплаты в 1С нет, показывается весь остаток с отметкой «нет графика».",
        numeric: true,
    },
    {
        key: "next",
        title: "Ближайший платёж",
        origin: "1c",
        field: "_Document683_VT10846 (ОплатитьДо, СуммаПроцент)",
        rule: "Первый платёж графика оплаты со сроком сегодня или позже: дата «Оплатить до» и сумма. График — табличная часть «Порядок оплаты» проведённого документа «Начисление доходов будущих периодов (образование)»; доля в процентах пересчитывается в рубли от суммы начисления.",
    },
    {
        key: "receipt",
        title: "Квитанция",
        origin: "1c",
        field: "_Document657 (КвитанцияНаОплатуГосуслуг)",
        rule: "Последняя неаннулированная квитанция на оплату по договору: номер, сумма и срок действия. УИН и назначение платежа — в раскрытой строке.",
    },
    {
        key: "current",
        title: "Остаток по договору",
        origin: "1c",
        field: "_AccRgAT341390._Fld41355",
        rule: "Всё, что осталось оплатить по договору за весь срок обучения (текущие итоги 1С по счёту 205.31), независимо от выбранного периода.",
        numeric: true,
        detail: true,
    },
    {
        key: "opening",
        title: "На начало периода",
        origin: "calc",
        rule: "«На конец периода» − «Начислено» + «Оплачено».",
        numeric: true,
        detail: true,
    },
    {
        key: "debit",
        title: "Начислено за период",
        origin: "1c",
        field: "_AccRgAT341390._TurnoverDt41370",
        rule: "Сумма оборотов по дебету счёта 205.31 за месяцы выбранного периода.",
        numeric: true,
        detail: true,
    },
    {
        key: "credit",
        title: "Оплачено за период",
        origin: "1c",
        field: "_AccRgAT341390._TurnoverCt41371",
        rule: "Сумма оборотов по кредиту счёта 205.31 за месяцы выбранного периода.",
        numeric: true,
        detail: true,
    },
    {
        key: "closing",
        title: "На конец периода",
        origin: "calc",
        rule: "Текущий остаток за вычетом сальдо оборотов (дебет − кредит) за месяцы, следующие за периодом.",
        numeric: true,
        detail: true,
    },
    {
        key: "schedule",
        title: "График оплаты",
        origin: "1c",
        field: "_Document683_VT10846",
        rule: "Все платежи графика: срок «Оплатить до», сумма и отметка, наступил ли срок.",
        detail: true,
    },
    {
        key: "operations",
        title: "Операции по договору",
        origin: "1c",
        field: "_AccRg41346 + _AccRgED41392",
        rule: "Все проводки по счёту 205.31 для договора с точной датой: начисления (дебет), оплаты и списания (кредит), вид и номер документа-регистратора, нарастающий остаток.",
        detail: true,
    },
];

export { DEBTOR_COLUMNS, DEBTOR_COLUMN_ORIGIN };
export type { DebtorColumn, DebtorColumnKey, DebtorColumnOrigin };
