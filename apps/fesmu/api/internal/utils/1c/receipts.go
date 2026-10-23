package onec

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Receipt — последняя действующая квитанция на оплату по договору.
type Receipt struct {
	Number     string
	Date       time.Time
	Amount     float64
	ValidUntil time.Time // нулевое — срок не указан
	UIN        string    // уникальный идентификатор начисления — для оплаты
	Purpose    string    // назначение платежа
}

type receiptCols struct {
	Contract, Amount, ValidUntil, UIN, Purpose, Cancel string
}

func (a *Accounting) receiptColumns(ctx context.Context) (receiptCols, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.receiptCols != nil {
		return *a.receiptCols, nil
	}
	rs := a.s.Receipt
	cols, err := a.tableColumns(ctx, rs.Doc)
	if err != nil {
		return receiptCols{}, err
	}
	var missing []string
	pick := func(fld, what string, prefer ...string) string {
		col := resolveColumn(cols[rs.Doc], fld, prefer...)
		if col == "" {
			missing = append(missing, what+" ("+rs.Doc+"."+fld+")")
		}
		return col
	}
	c := receiptCols{
		Contract:   pick(rs.Contract, "Договор", "RRef", "_RRRef"),
		Amount:     pick(rs.Amount, "СуммаДокумента", "_N"),
		ValidUntil: pick(rs.ValidUntil, "СрокДействия", "_T"),
		UIN:        pick(rs.UIN, "УникальныйИдентификаторНачисления", "_S"),
		Purpose:    pick(rs.Purpose, "НазначениеПлатежа", "_S"),
		Cancel:     pick(rs.Cancel, "ПричинаАннулирования", "_S"),
	}
	if len(missing) > 0 {
		return c, fmt.Errorf("квитанции: не найдены колонки: %s", strings.Join(missing, ", "))
	}
	a.receiptCols = &c
	return c, nil
}

// TuitionReceipts — последняя неаннулированная, не помеченная на удаление
// квитанция по каждому договору, по ссылке на договор («0x…»).
func (a *Accounting) TuitionReceipts(ctx context.Context) (map[string]Receipt, error) {
	c, err := a.receiptColumns(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := a.c.queryRows(ctx, receiptsSQL(a.s.Receipt.Doc, c), 7)
	if err != nil {
		return nil, err
	}
	out := make(map[string]Receipt, len(rows))
	for _, r := range rows {
		rc := Receipt{
			Number:  strings.TrimSpace(r[1]),
			Amount:  parseFloat(r[3]),
			UIN:     strings.TrimSpace(r[5]),
			Purpose: strings.TrimSpace(r[6]),
		}
		rc.Date, _ = parse1CDate(r[2])
		rc.ValidUntil, _ = parse1CDate(r[4])
		out[r[0]] = rc
	}
	return out, nil
}

func receiptsSQL(doc string, c receiptCols) string {
	return strings.NewReplacer("{DOC}", doc, "{CONTRACT}", c.Contract, "{AMOUNT}", c.Amount,
		"{VALID}", c.ValidUntil, "{UIN}", c.UIN, "{PURPOSE}", c.Purpose, "{CANCEL}", c.Cancel).Replace(`
WITH r AS (
  SELECT h.{CONTRACT} AS d, h._Number AS num, h._Date_Time AS dt, h.{AMOUNT} AS amount, h.{VALID} AS valid,
    h.{UIN} AS uin, h.{PURPOSE} AS purpose,
    ROW_NUMBER() OVER (PARTITION BY h.{CONTRACT} ORDER BY h._Date_Time DESC) AS rn
  FROM {DOC} h
  WHERE h._Marked = 0x00 AND ISNULL(DATALENGTH(h.{CANCEL}), 0) = 0
)
SELECT d, num, dt, amount, valid, uin, purpose FROM r WHERE rn = 1`)
}
