package onec

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// scheduleCols — реальные имена колонок SQL графика оплаты.
type scheduleCols struct {
	LinesParent, LineID, Student, Kontragent, Contract, Sum           string
	PayParent, PayLineID, PayUntil, PayAmount, PeriodStart, PeriodEnd string
}

// resolveSchedule находит имена колонок по sys.columns: реквизит-ссылка
// хранится как _FldNNNRRef, составной тип — как _FldNNN_RRRef, остальные —
// как _FldNNN. missing — реквизиты, колонку которых найти не удалось.
func (a *Accounting) resolveSchedule(ctx context.Context) (c scheduleCols, missing []string, err error) {
	sc := a.s.Schedule
	cols, err := a.tableColumns(ctx, sc.Lines, sc.Pay)
	if err != nil {
		return c, nil, err
	}
	// Суффиксы колонок составного типа: _RRRef — ссылка, _N — число, _T — дата.
	ref, num, date := []string{"RRef", "_RRRef"}, []string{"_N"}, []string{"_T"}
	pick := func(table, fld, what string, prefer []string) string {
		if col := resolveColumn(cols[table], fld, prefer...); col != "" {
			return col
		}
		missing = append(missing, what+" ("+table+"."+fld+")")
		return ""
	}
	parent := sc.Doc + "_IDRRef"
	c = scheduleCols{
		LinesParent: pick(sc.Lines, parent, "ссылка на документ", nil),
		LineID:      pick(sc.Lines, sc.LineID, "ИдентификаторСтроки", nil),
		Student:     pick(sc.Lines, sc.Student, "Студент", ref),
		Kontragent:  pick(sc.Lines, sc.Kontragent, "Контрагент", ref),
		Contract:    pick(sc.Lines, sc.Contract, "Договор", ref),
		Sum:         pick(sc.Lines, sc.Sum, "Сумма", num),
		PayParent:   pick(sc.Pay, parent, "ссылка на документ", nil),
		PayLineID:   pick(sc.Pay, sc.PayLineID, "ИдентификаторСтроки", nil),
		PayUntil:    pick(sc.Pay, sc.PayUntil, "ОплатитьДо", date),
		PayAmount:   pick(sc.Pay, sc.PayAmount, "СуммаПроцент", num),
		PeriodStart: pick(sc.Pay, sc.PeriodStart, "НачалоПериода", date),
		PeriodEnd:   pick(sc.Pay, sc.PeriodEnd, "КонецПериода", date),
	}
	return c, missing, nil
}

// tableColumns — колонки таблиц по sys.columns.
func (a *Accounting) tableColumns(ctx context.Context, tables ...string) (map[string][]string, error) {
	quoted := make([]string, len(tables))
	for i, t := range tables {
		quoted[i] = "'" + t + "'"
	}
	rows, err := a.c.queryRows(ctx, `
SELECT t.name, c.name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN (`+strings.Join(quoted, ", ")+`)`, 2)
	if err != nil {
		return nil, err
	}
	cols := map[string][]string{}
	for _, r := range rows {
		cols[r[0]] = append(cols[r[0]], r[1])
	}
	return cols, nil
}

// scheduleColumns — имена колонок графика, определённые один раз.
func (a *Accounting) scheduleColumns(ctx context.Context) (scheduleCols, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.schedCols != nil {
		return *a.schedCols, nil
	}
	c, missing, err := a.resolveSchedule(ctx)
	if err != nil {
		return c, err
	}
	if len(missing) > 0 {
		return c, fmt.Errorf("график оплаты: не найдены колонки: %s", strings.Join(missing, ", "))
	}
	a.schedCols = &c
	return c, nil
}

// Payment — платёж по графику оплаты договора.
type Payment struct {
	Until  time.Time // оплатить до
	Amount float64   // рубли
}

// TuitionSchedules — графики оплаты по договорам из проведённых документов
// начисления, по ссылке на договор («0x…»), платежи по возрастанию срока.
//
// «СуммаПроцент» бывает и суммой, и долей: если платежи строки начисления в
// сумме дают 100, это проценты от суммы строки, иначе — рубли.
func (a *Accounting) TuitionSchedules(ctx context.Context) (map[string][]Payment, error) {
	c, err := a.scheduleColumns(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := a.c.queryRows(ctx, scheduleRowsSQL(a.s, c), 6)
	if err != nil {
		return nil, err
	}
	return buildSchedules(rows), nil
}

// buildSchedules собирает графики из строк «договор, документ, строка,
// сумма строки, оплатить до, сумма/процент».
func buildSchedules(rows [][]string) map[string][]Payment {
	type line struct {
		contract string
		sum      float64
		until    []time.Time
		raw      []float64
	}
	lines := map[string]*line{}
	var order []string
	for _, r := range rows {
		until, ok := parse1CDate(r[4])
		if !ok {
			continue
		}
		// Группа — договор внутри документа: LineID у строк начисления в 1С часто
		// пустой, и группировка только по нему склеивала все договоры документа.
		key := r[0] + "|" + r[1] + "|" + r[2]
		l, found := lines[key]
		if !found {
			l = &line{contract: r[0], sum: parseFloat(r[3])}
			lines[key] = l
			order = append(order, key)
		}
		l.until = append(l.until, until)
		l.raw = append(l.raw, parseFloat(r[5]))
	}

	out := map[string][]Payment{}
	for _, key := range order {
		l := lines[key]
		total := 0.0
		for _, v := range l.raw {
			total += v
		}
		percent := l.sum > 100 && math.Abs(total-100) < 0.5
		for i, v := range l.raw {
			amount := v
			if percent {
				amount = math.Round(l.sum*v) / 100
			}
			out[l.contract] = append(out[l.contract], Payment{Until: l.until[i], Amount: amount})
		}
	}
	for k := range out {
		sort.SliceStable(out[k], func(i, j int) bool { return out[k][i].Until.Before(out[k][j].Until) })
	}
	return out
}

// parse1CDate разбирает дату из ответа SQL («2006-01-02 15:04:05») со
// сдвигом 1С на +2000 лет. Пустая дата 1С (0001-01-01 → 2001 в SQL) — false.
func parse1CDate(s string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02 15:04:05", strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, false
	}
	t = t.AddDate(-2000, 0, 0)
	return t, t.Year() > 1900
}

func scheduleRowsSQL(sc Schema, c scheduleCols) string {
	return scheduleReplacer(sc, c).Replace(`
SELECT n.{CONTRACT}, n.{LP}, n.{LID}, n.{SUM}, p.{UNTIL}, p.{AMOUNT}
FROM {LINES} n
JOIN {DOC} h ON h._IDRRef = n.{LP} AND h._Posted = 0x01 AND h._Marked = 0x00
JOIN {PAY} p ON p.{PP} = n.{LP} AND p.{PID} = n.{LID}`)
}

// resolveColumn ищет колонку поля fld: точное имя, затем fld с суффиксами
// prefer по порядку (для составного типа — нужная часть: _N, _T, _RRRef);
// иначе первую колонку с этим префиксом, за которым не идёт цифра (_Fld1083
// не должен совпасть с _Fld10834).
func resolveColumn(cols []string, fld string, prefer ...string) string {
	for _, want := range append([]string{""}, prefer...) {
		want = fld + want
		for _, c := range cols {
			if c == want {
				return c
			}
		}
	}
	for _, c := range cols {
		if rest, ok := strings.CutPrefix(c, fld); ok && rest != "" && (rest[0] < '0' || rest[0] > '9') {
			return c
		}
	}
	return ""
}

// diagSchedule — три раздела отчёта о графике оплаты: найденные колонки,
// охват (у скольких договоров с долгом есть график) и пример по 5 договорам.
func (a *Accounting) diagSchedule(ctx context.Context) []DiagSection {
	title := "График оплаты (Документ.НачислениеДоходовБудущихПериодовОбразование)"
	cols := DiagSection{Title: title + ": колонки", Columns: []string{"Реквизит", "Колонка SQL"}}
	cover := DiagSection{Title: title + ": охват договоров", Columns: []string{"Показатель", "Значение"}}
	sample := DiagSection{
		Title: title + ": пример по 5 договорам с долгом",
		Columns: []string{"Контрагент", "Договор", "Сумма строки начисления", "Оплатить до", "СуммаПроцент",
			"Начало периода", "Конец периода", "Остаток 205.31"},
	}

	c, missing, err := a.resolveSchedule(ctx)
	if err != nil {
		cols.Err, cover.Err, sample.Err = err.Error(), err.Error(), err.Error()
		return []DiagSection{cols, cover, sample}
	}
	for _, kv := range [][2]string{
		{"Начисления → документ", c.LinesParent}, {"ИдентификаторСтроки", c.LineID}, {"Студент", c.Student},
		{"Контрагент", c.Kontragent}, {"Договор", c.Contract}, {"Сумма", c.Sum},
		{"ПорядокОплаты → документ", c.PayParent}, {"ИдентификаторСтроки", c.PayLineID}, {"ОплатитьДо", c.PayUntil},
		{"СуммаПроцент", c.PayAmount}, {"НачалоПериода", c.PeriodStart}, {"КонецПериода", c.PeriodEnd},
	} {
		v := kv[1]
		if v == "" {
			v = "не найдена"
		}
		cols.Rows = append(cols.Rows, []string{kv[0], v})
	}
	if len(missing) > 0 {
		msg := "не найдены колонки: " + strings.Join(missing, ", ")
		cols.Err, cover.Err, sample.Err = msg, msg, msg
		return []DiagSection{cols, cover, sample}
	}

	if res, err := a.c.queryRows(ctx, scheduleCoverSQL(a.s, c), 4); err != nil {
		cover.Err = err.Error()
	} else if len(res) == 1 {
		r := res[0]
		cover.Rows = [][]string{
			{"Проведённых документов начисления", r[0]},
			{"Договоров в графиках оплаты", r[1]},
			{"Договоров с долгом по 205.31", r[2]},
			{"Из них с графиком оплаты", r[3]},
		}
	}
	if res, err := a.c.queryRows(ctx, scheduleSampleSQL(a.s, c), 8); err != nil {
		sample.Err = err.Error()
	} else {
		sample.Rows = res
	}
	return []DiagSection{cols, cover, sample}
}

func scheduleReplacer(sc Schema, c scheduleCols) *strings.Replacer {
	t := sc.AccTotals
	return strings.NewReplacer(
		"{DOC}", sc.Schedule.Doc, "{LINES}", sc.Schedule.Lines, "{PAY}", sc.Schedule.Pay,
		"{LP}", c.LinesParent, "{LID}", c.LineID, "{KONTR}", c.Kontragent, "{CONTRACT}", c.Contract, "{SUM}", c.Sum,
		"{PP}", c.PayParent, "{PID}", c.PayLineID, "{UNTIL}", c.PayUntil, "{AMOUNT}", c.PayAmount,
		"{PSTART}", c.PeriodStart, "{PEND}", c.PeriodEnd,
		"{AT}", t.Table, "{ACC}", sc.Accounts, "{BAL}", t.Balance, "{CUR}", t.CurrentTotal,
		"{K}", sc.Kontragents, "{D}", sc.Contracts,
	)
}

// scheduleCoverSQL — сколько договоров с долгом по 205.31 имеют график в
// проведённых документах начисления.
func scheduleCoverSQL(sc Schema, c scheduleCols) string {
	return scheduleReplacer(sc, c).Replace(`
WITH g AS (
  SELECT DISTINCT n.{CONTRACT} AS d
  FROM {LINES} n JOIN {DOC} h ON h._IDRRef = n.{LP}
  WHERE h._Posted = 0x01 AND h._Marked = 0x00
), debt AS (
  SELECT x._Value2_RRRef AS d
  FROM {AT} x JOIN {ACC} a ON a._IDRRef = x._AccountRRef AND a._Code = '205.31'
  WHERE x._Period = '{CUR}'
  GROUP BY x._Value2_RRRef
  HAVING SUM(x.{BAL}) > 0
)
SELECT
  (SELECT COUNT(*) FROM {DOC} WHERE _Posted = 0x01 AND _Marked = 0x00),
  (SELECT COUNT(*) FROM g),
  (SELECT COUNT(*) FROM debt),
  (SELECT COUNT(*) FROM debt WHERE d IN (SELECT d FROM g))`)
}

// scheduleSampleSQL — график оплаты пяти случайных договоров с долгом.
func scheduleSampleSQL(sc Schema, c scheduleCols) string {
	return scheduleReplacer(sc, c).Replace(`
WITH debt AS (
  SELECT x._Value2_RRRef AS d, SUM(x.{BAL}) AS bal
  FROM {AT} x JOIN {ACC} a ON a._IDRRef = x._AccountRRef AND a._Code = '205.31'
  WHERE x._Period = '{CUR}'
  GROUP BY x._Value2_RRRef
  HAVING SUM(x.{BAL}) > 0
), pick AS (
  SELECT TOP 5 debt.d, debt.bal
  FROM debt
  WHERE debt.d IN (SELECT n.{CONTRACT} FROM {LINES} n JOIN {DOC} h ON h._IDRRef = n.{LP} WHERE h._Posted = 0x01 AND h._Marked = 0x00)
  ORDER BY NEWID()
)
SELECT kk._Description, dd._Description, n.{SUM}, p.{UNTIL}, p.{AMOUNT}, p.{PSTART}, p.{PEND}, pick.bal
FROM pick
JOIN {LINES} n ON n.{CONTRACT} = pick.d
JOIN {DOC} h ON h._IDRRef = n.{LP} AND h._Posted = 0x01 AND h._Marked = 0x00
JOIN {PAY} p ON p.{PP} = n.{LP} AND p.{PID} = n.{LID}
LEFT JOIN {K} kk ON kk._IDRRef = n.{KONTR}
LEFT JOIN {D} dd ON dd._IDRRef = pick.d
ORDER BY dd._Description, p.{UNTIL}`)
}

// DueNow — сколько по договору нужно оплатить на дату today: текущий остаток
// за вычетом платежей графика, срок которых ещё не наступил. Остаток уже
// учитывает все оплаты, поэтому история платежей не нужна. Меньше нуля не
// бывает: оплата вперёд даёт 0.
func DueNow(current float64, schedule []Payment, today time.Time) float64 {
	future := 0.0
	for _, p := range schedule {
		if p.Until.After(today) {
			future += p.Amount
		}
	}
	return math.Max(0, math.Round((current-future)*100)/100)
}
