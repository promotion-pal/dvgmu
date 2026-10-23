package onec

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ContractTurnover — оборотно-сальдовая строка по договору за период.
type ContractTurnover struct {
	Kontragent string // студент/плательщик
	Dogovor    string // договор
	INN        string // пусто, если колонка ИНН не задана в Schema
	Kind       KontragentKind
	Opening    float64 // остаток на начало периода
	Debit      float64 // начислено за период
	Credit     float64 // оплачено за период
	Closing    float64 // остаток на конец периода
	// Current — текущий остаток по договору (текущие итоги 1С): всё, что
	// осталось оплатить за весь срок, независимо от выбранного периода.
	Current float64
	// ContractRef — ссылка на договор (_IDRRef, «0x…»): ключ для графика оплаты
	// и квитанций.
	ContractRef string
}

// MonthStart — первое число месяца t. Итоги 1С хранятся помесячно, поэтому
// период всегда расширяется до целых месяцев.
func MonthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// sqlMonth — дата для сравнения с _Period: 1С сдвигает годы на +2000.
func sqlMonth(t time.Time) string {
	return MonthStart(t).AddDate(2000, 0, 0).Format("2006-01-02")
}

// ContractTurnover — обороты по счёту в разрезе контрагент/договор за месяцы
// from…to включительно. Строки без остатков и оборотов не возвращаются.
//
// Остаток на конец считается от текущих итогов назад: текущий остаток минус
// чистые обороты всех месяцев после to (включая будущие начисления, которые
// 1С уже учла в текущих итогах). Остаток на начало = конец − дебет + кредит.
func (a *Accounting) ContractTurnover(ctx context.Context, account string, from, to time.Time) ([]ContractTurnover, error) {
	if !reAccountCode.MatchString(account) {
		return nil, fmt.Errorf("некорректный код счёта: %q", account)
	}
	if MonthStart(to).Before(MonthStart(from)) {
		return nil, fmt.Errorf("начало периода позже конца")
	}

	rows, err := a.c.queryRows(ctx, a.turnoverSQL(account, from, to), 8)
	if err != nil {
		return nil, err
	}

	out := make([]ContractTurnover, 0, len(rows))
	for _, row := range rows {
		ct := ContractTurnover{
			Kontragent:  row[0],
			Dogovor:     row[1],
			INN:         strings.TrimSpace(row[2]),
			Closing:     parseFloat(row[3]),
			Debit:       parseFloat(row[4]),
			Credit:      parseFloat(row[5]),
			Current:     parseFloat(row[6]),
			ContractRef: row[7],
		}
		ct.Opening = ct.Closing - ct.Debit + ct.Credit
		ct.Kind = classify(ct.INN, ct.Kontragent, ct.Dogovor)
		out = append(out, ct)
	}
	return out, nil
}

// TuitionTurnover — обороты по плате за обучение (205.31), и студенты, и организации.
func (a *Accounting) TuitionTurnover(ctx context.Context, from, to time.Time) ([]ContractTurnover, error) {
	return a.ContractTurnover(ctx, AccountTuition, from, to)
}

// KindByINN — тип контрагента определяется по ИНН, а не по названию.
func (a *Accounting) KindByINN() bool { return a.s.KontragentINN != "" }

// turnoverSQL — запрос оборотов; account уже провалидирован.
func (a *Accounting) turnoverSQL(account string, from, to time.Time) string {
	t := a.s.AccTotals
	inn := "''"
	if a.s.KontragentINN != "" {
		inn = "k." + a.s.KontragentINN
	}
	r := strings.NewReplacer(
		"{BAL}", t.Balance, "{DT}", t.TurnoverDt, "{CT}", t.TurnoverCt,
		"{AT}", t.Table, "{ACC}", a.s.Accounts, "{CODE}", account,
		"{K}", a.s.Kontragents, "{D}", a.s.Contracts, "{INN}", inn,
		"{CUR}", t.CurrentTotal, "{FROM}", sqlMonth(from), "{TO}", sqlMonth(to),
	)
	return r.Replace(`
WITH x AS (
  SELECT t._Value1_RRRef AS kref, t._Value2_RRRef AS dref,
    SUM(CASE WHEN t._Period = '{CUR}' THEN t.{BAL} ELSE 0 END) AS cur_bal,
    SUM(CASE WHEN t._Period <> '{CUR}' AND t._Period > '{TO}' THEN t.{DT} - t.{CT} ELSE 0 END) AS later_net,
    SUM(CASE WHEN t._Period >= '{FROM}' AND t._Period <= '{TO}' THEN t.{DT} ELSE 0 END) AS dt,
    SUM(CASE WHEN t._Period >= '{FROM}' AND t._Period <= '{TO}' THEN t.{CT} ELSE 0 END) AS ct
  FROM {AT} t
  JOIN {ACC} acc ON acc._IDRRef = t._AccountRRef AND acc._Code = '{CODE}'
  GROUP BY t._Value1_RRRef, t._Value2_RRRef
)
SELECT k._Description, d._Description, {INN}, x.cur_bal - x.later_net, x.dt, x.ct, x.cur_bal, x.dref
FROM x
LEFT JOIN {K} k ON k._IDRRef = x.kref
LEFT JOIN {D} d ON d._IDRRef = x.dref
WHERE x.cur_bal - x.later_net <> 0 OR x.dt <> 0 OR x.ct <> 0
ORDER BY x.cur_bal - x.later_net DESC`)

}
