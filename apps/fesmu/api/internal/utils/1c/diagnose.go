package onec

// Диагностика: что и где лежит в базе, чтобы найти график оплаты договоров,
// доходы будущих периодов (401.40) и реквизиты контрагентов/договоров без
// угадывания номеров таблиц. Только чтение. Каждая проверка независима:
// ошибка одной попадает в её раздел и не мешает остальным.

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

// DiagSection — одна таблица результата.
type DiagSection struct {
	Title   string
	Columns []string
	Rows    [][]string
	Err     string
}

// Ключевые слова в именах объектов 1С, где может лежать график оплаты,
// стоимость обучения и сведения об обучающихся.
var reDiagKeywords = regexp.MustCompile(`(?i)график|оплат|договор|обуча|студент|контингент|стоимост|рассрочк|платн|доходыбудущ|начислен`)

var reATTable = regexp.MustCompile(`^_AccRgAT\d+$`)

// Пределы времени: зависшая проверка не должна держать отчёт бесконечно.
// Быстрые SQL-проверки идут первыми, разбор метаданных — последним.
const (
	diagProbeTimeout    = 2 * time.Minute
	diagMetadataTimeout = 8 * time.Minute
)

// Diagnose выполняет все проверки. Каждая ограничена по времени; при
// превышении в её разделе будет ошибка, остальные разделы заполнятся.
// withMetadata — читать ли карту метаданных (долго, нужна только для поиска
// новых объектов).
func (a *Accounting) Diagnose(ctx context.Context, withMetadata bool) []DiagSection {
	timings := DiagSection{Title: "Время выполнения проверок", Columns: []string{"Проверка", "Время", "Итог"}}
	probe := func(name string, limit time.Duration, f func(ctx context.Context) error) {
		pctx, cancel := context.WithTimeout(ctx, limit)
		defer cancel()
		start := time.Now()
		result := "ок"
		if err := f(pctx); err != nil {
			result = diagErrText(err, limit)
		}
		timings.Rows = append(timings.Rows, []string{name, time.Since(start).Round(time.Second).String(), result})
	}

	var (
		rows      map[string]string
		rowsErr   error
		accounts  []DiagSection
		monthly   DiagSection
		debtCheck DiagSection
		schedule  []DiagSection
		recorders []DiagSection
		md        *Metadata
		mdErr     error
	)
	probe("Число строк таблиц", diagProbeTimeout, func(ctx context.Context) error {
		rows, rowsErr = a.tableRows(ctx)
		return rowsErr
	})
	probe("Счета в таблицах итогов", diagProbeTimeout, func(ctx context.Context) error {
		accounts = a.diagAccountTables(ctx)
		return sectionsErr(accounts...)
	})
	probe("Обороты 205.31 по месяцам", diagProbeTimeout, func(ctx context.Context) error {
		monthly = a.diagMonthly(ctx)
		return sectionsErr(monthly)
	})
	probe("Проверка расчёта", diagProbeTimeout, func(ctx context.Context) error {
		debtCheck = a.diagDebtCheck(ctx)
		return sectionsErr(debtCheck)
	})
	probe("График оплаты", diagProbeTimeout, func(ctx context.Context) error {
		schedule = a.diagSchedule(ctx)
		return sectionsErr(schedule...)
	})
	if withMetadata {
		probe("Метаданные 1С", diagMetadataTimeout, func(ctx context.Context) error {
			md, mdErr = a.c.ReadMetadata(ctx, reDiagKeywords.String(), a.diagRefs())
			if mdErr != nil {
				mdErr = errors.New(diagErrText(mdErr, diagMetadataTimeout))
			}
			return mdErr
		})
	}

	// После метаданных: из них берутся имена документов.
	probe("Документы-регистраторы договоров", diagProbeTimeout, func(ctx context.Context) error {
		recorders = a.diagRecorders(ctx, md)
		return sectionsErr(recorders...)
	})

	// Регистраторы и график — первыми: на них держится расчёт «к оплате».
	out := append([]DiagSection{}, recorders...)
	out = append(out, schedule...)
	if withMetadata {
		out = append(out,
			diagMetadataStats(md, mdErr),
			a.diagKeywordObjects(md, mdErr, rows, rowsErr),
			a.diagPageCatalogs(md, mdErr),
		)
	}
	out = append(out, accounts...)
	out = append(out, monthly, debtCheck, timings)
	return out
}

// diagErrText — текст ошибки проверки; превышение времени — по-русски.
func diagErrText(err error, limit time.Duration) string {
	if errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), context.DeadlineExceeded.Error()) {
		return fmt.Sprintf("превышено время ожидания (%s)", limit)
	}
	return err.Error()
}

// sectionsErr — первая ошибка среди разделов (для таблицы времени).
func sectionsErr(sections ...DiagSection) error {
	for _, s := range sections {
		if s.Err != "" {
			return errors.New(s.Err)
		}
	}
	return nil
}

func diagMetadataStats(md *Metadata, err error) DiagSection {
	s := DiagSection{Title: "Метаданные 1С: сводка", Columns: []string{"Показатель", "Значение"}}
	if err != nil {
		s.Err = err.Error()
		return s
	}
	s.Rows = [][]string{
		{"Записей в DBNames", strconv.Itoa(md.DBNames)},
		{"Описаний объектов прочитано", strconv.Itoa(md.Files)},
		{"Описаний не распаковано", strconv.Itoa(md.Broken)},
		{"Объектов с именем", strconv.Itoa(len(md.Objects))},
		{"Объектов без реквизитов из-за предела строк", strconv.Itoa(md.Truncated)},
	}
	return s
}

// diagKeywordObjects — объекты, чьё имя похоже на график, оплату, договор,
// обучающихся; со всеми реквизитами и числом строк в таблице.
func (a *Accounting) diagKeywordObjects(md *Metadata, mdErr error, rows map[string]string, rowsErr error) DiagSection {
	s := DiagSection{
		Title:   "Объекты 1С по ключевым словам (график, оплата, договор, обучающийся…)",
		Columns: []string{"Объект 1С", "Таблица", "Строк", "Реквизиты и табличные части"},
	}
	if mdErr != nil {
		s.Err = mdErr.Error()
		return s
	}
	if rowsErr != nil {
		s.Err = "число строк: " + rowsErr.Error()
	}
	// Только объекты с данными: пустые документы и регистры типовой
	// конфигурации раздувают отчёт и ничего не говорят. Регистры — первыми,
	// график оплаты вероятнее всего там.
	var hits []*MetaObject
	empty := 0
	for _, o := range md.Objects {
		if !reDiagKeywords.MatchString(o.Name) {
			continue
		}
		if rows != nil && !hasData(o, rows) {
			empty++
			continue
		}
		hits = append(hits, o)
	}
	slices.SortStableFunc(hits, func(x, y *MetaObject) int { return kindOrder(x.Kind) - kindOrder(y.Kind) })
	for _, o := range hits {
		s.Rows = append(s.Rows, []string{o.Title(), o.Table(), rows[o.Table()], attrList(o, rows)})
	}
	if empty > 0 {
		s.Rows = append(s.Rows, []string{fmt.Sprintf("…ещё %d объектов без данных не показаны", empty), "", "", ""})
	}
	return s
}

// hasData — в таблице объекта или в одной из его табличных частей есть строки.
func hasData(o *MetaObject, rows map[string]string) bool {
	if n := rows[o.Table()]; n != "" && n != "0" {
		return true
	}
	for _, at := range o.Attrs {
		if at.Kind == "VT" {
			if n := rows[at.Column(o)]; n != "" && n != "0" {
				return true
			}
		}
	}
	return false
}

func kindOrder(kind string) int {
	switch kind {
	case "InfoRg", "AccumRg", "AccRg":
		return 0
	case "Reference":
		return 1
	case "Document":
		return 2
	}
	return 3
}

// unknown40140Subconto — справочник первого субконто счёта 401.40
// (RTRef 0x000000FE в отчёте диагностики); его имя пока неизвестно.
const unknown40140Subconto = 254

// diagRefs — номера справочников, чьи реквизиты нужны целиком: контрагенты,
// договоры и первое субконто 401.40.
func (a *Accounting) diagRefs() []int {
	var refs []int
	for _, t := range []string{a.s.Kontragents, a.s.Contracts} {
		if n, err := strconv.Atoi(strings.TrimPrefix(t, "_Reference")); err == nil {
			refs = append(refs, n)
		}
	}
	return append(refs, unknown40140Subconto)
}

// diagPageCatalogs — все реквизиты справочников, которые уже выводятся на
// странице: контрагенты (ищем ИНН, вид лица) и договоры (даты, сумма, срок,
// обучающийся, табличная часть с графиком).
func (a *Accounting) diagPageCatalogs(md *Metadata, mdErr error) DiagSection {
	s := DiagSection{
		Title:   "Реквизиты справочников контрагентов, договоров и первого субконто 401.40 (_Reference254)",
		Columns: []string{"Объект 1С", "Реквизит", "Колонка / таблица"},
	}
	if mdErr != nil {
		s.Err = mdErr.Error()
		return s
	}
	for _, o := range md.Objects {
		if o.Kind != "Reference" || !slices.Contains(a.diagRefs(), o.Num) {
			continue
		}
		for _, at := range o.Attrs {
			s.Rows = append(s.Rows, []string{o.Title(), at.Name, at.Column(o)})
		}
	}
	return s
}

func attrList(o *MetaObject, rows map[string]string) string {
	parts := make([]string, 0, len(o.Attrs))
	for _, at := range o.Attrs {
		col := at.Column(o)
		if at.Kind == "VT" {
			col += " [ТЧ, строк: " + rows[col] + "]"
		}
		parts = append(parts, at.Name+"="+col)
	}
	return strings.Join(parts, "; ")
}

const tableRowsSQL = `
SELECT t.name, SUM(p.rows)
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY t.name`

const atColumnsSQL = `
SELECT t.name, c.name
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name LIKE '\_AccRgAT%' ESCAPE '\' AND (c.name = '_AccountRRef' OR c.name LIKE '\_Value_\_RTRef' ESCAPE '\')`

// tableRows — число строк каждой пользовательской таблицы базы.
func (a *Accounting) tableRows(ctx context.Context) (map[string]string, error) {
	res, err := a.c.queryRows(ctx, tableRowsSQL, 2)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(res))
	for _, r := range res {
		m[r[0]] = r[1]
	}
	return m, nil
}

// diagAccountTables — в каких таблицах итогов лежат 205.31, 401.40, 401.10 и
// на какие справочники ссылается их аналитика (RTRef 0x00000081 — договоры,
// 0x000000CB — контрагенты). Нужно для расчёта задолженности за прошедший
// период: остаток 205.31 минус остаток 401.40 по тому же договору.
func (a *Accounting) diagAccountTables(ctx context.Context) []DiagSection {
	where := DiagSection{Title: "Счета 205.31 / 401.40 / 401.10 в таблицах итогов", Columns: []string{"Таблица", "Счёт", "Строк"}}
	slots := DiagSection{
		Title:   "Аналитика счетов (вид субконто по RTRef: 0x00000081 — договоры, 0x000000CB — контрагенты)",
		Columns: []string{"Таблица", "Счёт", "Субконто 1", "Субконто 2", "Субконто 3", "Строк"},
	}

	cols, err := a.c.queryRows(ctx, atColumnsSQL, 2)
	if err != nil {
		where.Err, slots.Err = err.Error(), err.Error()
		return []DiagSection{where, slots}
	}
	rt := map[string][]string{} // таблица → колонки _ValueN_RTRef
	var tables []string
	for _, c := range cols {
		if !reATTable.MatchString(c[0]) {
			continue
		}
		if c[1] == "_AccountRRef" {
			tables = append(tables, c[0])
		} else {
			rt[c[0]] = append(rt[c[0]], c[1])
		}
	}
	if len(tables) == 0 {
		where.Err = "таблицы итогов _AccRgAT… не найдены"
		return []DiagSection{where, slots}
	}

	countSQL, slotSQL := accountTablesSQL(a.s.Accounts, tables, rt)
	if res, err := a.c.queryRows(ctx, countSQL, 3); err != nil {
		where.Err = err.Error()
	} else {
		where.Rows = res
	}
	if res, err := a.c.queryRows(ctx, slotSQL, 6); err != nil {
		slots.Err = err.Error()
	} else {
		slots.Rows = res
	}
	return []DiagSection{where, slots}
}

// accountTablesSQL строит два запроса по всем таблицам итогов: число строк
// по счетам и распределение видов субконто. rt — колонки _ValueN_RTRef
// каждой таблицы (в таблицах с одним-двумя субконто их меньше трёх).
func accountTablesSQL(accounts string, tables []string, rt map[string][]string) (countSQL, slotSQL string) {
	const codes = `('205.31', '401.40', '401.10')`
	var count, slot []string
	for _, t := range tables {
		count = append(count, fmt.Sprintf(
			"SELECT '%[1]s' AS tbl, a._Code AS code, COUNT(*) AS n FROM %[1]s x JOIN %[2]s a ON a._IDRRef = x._AccountRRef WHERE a._Code IN %[3]s GROUP BY a._Code",
			t, accounts, codes))

		v := [3]string{"''", "''", "''"}
		group := []string{"a._Code"}
		for _, c := range rt[t] {
			if i := int(c[6] - '1'); i >= 0 && i < 3 {
				v[i] = "CONVERT(varchar(10), x." + c + ", 1)"
				group = append(group, "x."+c) // константы '' в GROUP BY SQL Server не принимает
			}
		}
		slot = append(slot, fmt.Sprintf(
			"SELECT '%[1]s' AS tbl, a._Code AS code, %[4]s AS v1, %[5]s AS v2, %[6]s AS v3, COUNT(*) AS n FROM %[1]s x JOIN %[2]s a ON a._IDRRef = x._AccountRRef WHERE a._Code IN %[3]s GROUP BY %[7]s",
			t, accounts, codes, v[0], v[1], v[2], strings.Join(group, ", ")))
	}
	return strings.Join(count, " UNION ALL ") + " ORDER BY 2, 1",
		strings.Join(slot, " UNION ALL ") + " ORDER BY 2, 1, 6 DESC"
}

// diagMonthly — как начисляется 205.31: разом на весь срок договора или по
// семестрам/годам.
func (a *Accounting) diagMonthly(ctx context.Context) DiagSection {
	s := DiagSection{
		Title:   "Начисления и оплаты по 205.31 по месяцам (последние 24)",
		Columns: []string{"Месяц (год +2000)", "Начислено", "Оплачено", "Договоров"},
	}
	res, err := a.c.queryRows(ctx, monthlySQL(a.s), 4)
	if err != nil {
		s.Err = err.Error()
		return s
	}
	s.Rows = res
	return s
}

func monthlySQL(sc Schema) string {
	t := sc.AccTotals
	return strings.NewReplacer("{AT}", t.Table, "{ACC}", sc.Accounts, "{DT}", t.TurnoverDt, "{CT}", t.TurnoverCt, "{CUR}", t.CurrentTotal).Replace(`
SELECT TOP 24 CONVERT(varchar(7), x._Period, 120), SUM(x.{DT}), SUM(x.{CT}), COUNT(DISTINCT x._Value2_RRRef)
FROM {AT} x JOIN {ACC} a ON a._IDRRef = x._AccountRRef AND a._Code = '205.31'
WHERE x._Period <> '{CUR}'
GROUP BY CONVERT(varchar(7), x._Period, 120)
ORDER BY 1 DESC`)
}

// diagDebtCheck сверяет модель «актуальная задолженность = остаток 205.31 +
// остаток 401.40 со знаком» на случайных договорах с долгом. 401.40 —
// кредитовый счёт; если 1С хранит остаток как дебет минус кредит, он
// отрицательный, и сумма даёт долг за уже прошедший период обучения.
// Договор ищется в любом из трёх субконто 401.40, пока их порядок не известен.
func (a *Accounting) diagDebtCheck(ctx context.Context) DiagSection {
	s := DiagSection{
		Title: "Проверка расчёта на 15 случайных договорах с долгом",
		Columns: []string{"Контрагент", "Договор", "Остаток 205.31", "Остаток 401.40", "205.31 + 401.40",
			"Начислено 205.31 в 09.2026"},
	}
	res, err := a.c.queryRows(ctx, debtCheckSQL(a.s), 6)
	if err != nil {
		s.Err = err.Error()
		return s
	}
	s.Rows = res
	return s
}

func debtCheckSQL(sc Schema) string {
	t := sc.AccTotals
	return strings.NewReplacer("{AT}", t.Table, "{ACC}", sc.Accounts, "{BAL}", t.Balance, "{DT}", t.TurnoverDt,
		"{CUR}", t.CurrentTotal, "{K}", sc.Kontragents, "{D}", sc.Contracts).Replace(`
WITH b AS (
  SELECT TOP 15 x._Value1_RRRef AS k, x._Value2_RRRef AS d, SUM(x.{BAL}) AS bal
  FROM {AT} x JOIN {ACC} a ON a._IDRRef = x._AccountRRef AND a._Code = '205.31'
  WHERE x._Period = '{CUR}'
  GROUP BY x._Value1_RRRef, x._Value2_RRRef
  HAVING SUM(x.{BAL}) > 0
  ORDER BY NEWID()
), f AS (
  SELECT b.d, SUM(y.{BAL}) AS fb
  FROM b
  JOIN {AT} y ON y._Period = '{CUR}' AND (y._Value1_RRRef = b.d OR y._Value2_RRRef = b.d OR y._Value3_RRRef = b.d)
  JOIN {ACC} a2 ON a2._IDRRef = y._AccountRRef AND a2._Code = '401.40'
  GROUP BY b.d
), sep AS (
  SELECT b.d, SUM(z.{DT}) AS dt
  FROM b
  JOIN {AT} z ON z._Period = '4026-09-01' AND z._Value2_RRRef = b.d
  JOIN {ACC} a3 ON a3._IDRRef = z._AccountRRef AND a3._Code = '205.31'
  GROUP BY b.d
)
SELECT kk._Description, dd._Description, b.bal, ISNULL(f.fb, 0), b.bal + ISNULL(f.fb, 0), ISNULL(sep.dt, 0)
FROM b
LEFT JOIN f ON f.d = b.d
LEFT JOIN sep ON sep.d = b.d
LEFT JOIN {K} kk ON kk._IDRRef = b.k
LEFT JOIN {D} dd ON dd._IDRRef = b.d
ORDER BY b.bal DESC`)
}
