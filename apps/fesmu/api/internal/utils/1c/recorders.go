package onec

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// Известные документы-регистраторы (номер таблицы _DocumentNNN → имя) — из
// отчёта карты метаданных; при чтении метаданных имена берутся оттуда.
var knownDocuments = map[int]string{
	657: "КвитанцияНаОплатуГосуслуг",
	681: "НачислениеДоходов",
	683: "НачислениеДоходовБудущихПериодовОбразование",
	684: "НачислениеЗаУслугиОбразования",
	693: "НачислениеСтудентамЗаПрочиеУслуги",
	726: "ПереносОплатыОбразование",
	791: "РаспределениеОплатыОбразование",
}

// diagRecorders — какими документами по 205.31 и другим счетам двигались
// три случайных договора с долгом: тип документа, сторона, счёт, число
// движений, сумма, период. Показывает, где на самом деле начисляется плата
// за обучение (а значит, где искать её график).
func (a *Accounting) diagRecorders(ctx context.Context, md *Metadata) []DiagSection {
	cols := DiagSection{Title: "Колонки таблиц движений регистра бухгалтерии", Columns: []string{"Таблица", "Колонки"}}
	moves := DiagSection{
		Title:   "Документы, делавшие проводки по 3 случайным договорам с долгом",
		Columns: []string{"Договор", "Документ", "Сторона", "Счёт", "Движений", "Сумма", "Первый месяц", "Последний месяц"},
	}

	tc, err := a.tableColumns(ctx, a.s.AccMoves, a.s.AccMovesExt)
	if err != nil {
		cols.Err = err.Error()
	} else {
		for _, t := range []string{a.s.AccMoves, a.s.AccMovesExt} {
			cols.Rows = append(cols.Rows, []string{t, strings.Join(tc[t], ", ")})
		}
	}

	res, err := a.c.queryRows(ctx, recordersSQL(a.s), 8)
	if err != nil {
		moves.Err = err.Error()
		return []DiagSection{moves, cols}
	}
	names := documentNames(md)
	for _, r := range res {
		side := "Дт"
		if strings.TrimSpace(r[2]) == "1" {
			side = "Кт"
		}
		moves.Rows = append(moves.Rows, []string{r[0], documentTitle(r[1], names), side, r[3], r[4], r[5], r[6], r[7]})
	}
	return []DiagSection{moves, cols}
}

// documentNames — номер таблицы документа → имя из карты метаданных, если
// она прочитана, иначе — известные заранее.
func documentNames(md *Metadata) map[int]string {
	names := map[int]string{}
	for n, name := range knownDocuments {
		names[n] = name
	}
	if md != nil {
		for _, o := range md.Objects {
			if o.Kind == "Document" {
				names[o.Num] = o.Name
			}
		}
	}
	return names
}

// documentTitle: RTRef «0x000002AC» → «Документ.НачислениеЗаУслугиОбразования (_Document684)».
func documentTitle(rtref string, names map[int]string) string {
	n, err := strconv.ParseInt(strings.TrimPrefix(strings.TrimSpace(rtref), "0x"), 16, 32)
	if err != nil {
		return rtref
	}
	if name, ok := names[int(n)]; ok {
		return fmt.Sprintf("Документ.%s (_Document%d)", name, n)
	}
	return fmt.Sprintf("_Document%d", n)
}

func recordersSQL(sc Schema) string {
	t := sc.AccTotals
	return strings.NewReplacer("{AT}", t.Table, "{ACC}", sc.Accounts, "{BAL}", t.Balance, "{CUR}", t.CurrentTotal,
		"{MAIN}", sc.AccMoves, "{ED}", sc.AccMovesExt, "{D}", sc.Contracts).Replace(`
WITH c AS (
  SELECT TOP 3 x._Value2_RRRef AS d
  FROM {AT} x JOIN {ACC} a ON a._IDRRef = x._AccountRRef AND a._Code = '205.31'
  WHERE x._Period = '{CUR}'
  GROUP BY x._Value2_RRRef
  HAVING SUM(x.{BAL}) > 0
  ORDER BY NEWID()
)
SELECT dd._Description, CONVERT(varchar(10), e._RecorderTRef, 1), e._Correspond, acc._Code,
  COUNT(*), SUM(m.{BAL}), CONVERT(varchar(7), MIN(e._Period), 120), CONVERT(varchar(7), MAX(e._Period), 120)
FROM {ED} e
JOIN c ON e._Value_RRRef = c.d
JOIN {MAIN} m ON m._RecorderTRef = e._RecorderTRef AND m._RecorderRRef = e._RecorderRRef
  AND m._LineNo = e._LineNo AND m._Period = e._Period
JOIN {ACC} acc ON acc._IDRRef = CASE WHEN e._Correspond = 0 THEN m._AccountDtRRef ELSE m._AccountCtRRef END
LEFT JOIN {D} dd ON dd._IDRRef = c.d
GROUP BY dd._Description, e._RecorderTRef, e._Correspond, acc._Code
ORDER BY 1, 5 DESC`)
}
