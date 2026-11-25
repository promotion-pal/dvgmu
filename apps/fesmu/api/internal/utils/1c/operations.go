package onec

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Operation — одна проводка по счёту договора: начисление (дебет) или
// оплата/списание (кредит), с точной датой и документом-регистратором.
type Operation struct {
	Date     time.Time
	Document string // «Документ.Имя» или «_DocumentNNN»
	Number   string // номер документа, если вид известен
	Debit    float64
	Credit   float64
}

// reRef — ссылка 1С в виде «0x» + 32 hex-символа (binary(16)). Приходит с
// фронта, поэтому проверяется строго перед подстановкой в SQL.
var reRef = regexp.MustCompile(`^0x[0-9A-Fa-f]{32}$`)

// ContractOperations — все проводки по счёту account для договора по
// возрастанию даты, из движений регистра бухгалтерии и их субконто.
func (a *Accounting) ContractOperations(ctx context.Context, account, contractRef string) ([]Operation, error) {
	if !reAccountCode.MatchString(account) {
		return nil, fmt.Errorf("некорректный код счёта: %q", account)
	}
	if !reRef.MatchString(contractRef) {
		return nil, fmt.Errorf("некорректная ссылка на договор: %q", contractRef)
	}
	bal, err := a.movesColumns(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := a.c.queryRows(ctx, operationsSQL(a.s, bal, account, contractRef), 5)
	if err != nil {
		return nil, fmt.Errorf("операции по договору: %w", err)
	}
	names := documentNames(nil)
	out := make([]Operation, 0, len(rows))
	for _, r := range rows {
		date, ok := parse1CDate(r[0])
		if !ok {
			continue
		}
		op := Operation{Date: date, Document: documentTitle(r[1], names), Number: strings.TrimSpace(r[2])}
		if strings.TrimSpace(r[3]) == "1" {
			op.Credit = parseFloat(r[4])
		} else {
			op.Debit = parseFloat(r[4])
		}
		out = append(out, op)
	}
	return out, nil
}

// TuitionOperations — проводки по плате за обучение (205.31) для договора.
func (a *Accounting) TuitionOperations(ctx context.Context, contractRef string) ([]Operation, error) {
	return a.ContractOperations(ctx, AccountTuition, contractRef)
}

// Колонки таблиц движений, на которые опирается запрос операций. Это
// типовые имена 1С 8.3; на конкретной базе они проверяются по sys.columns.
var (
	movesMainCols = []string{"_Period", "_RecorderTRef", "_RecorderRRef", "_LineNo", "_Active", "_AccountDtRRef", "_AccountCtRRef"}
	movesExtCols  = []string{"_Period", "_RecorderTRef", "_RecorderRRef", "_LineNo", "_Correspond", "_Value_RRRef"}
)

// movesColumns проверяет колонки таблиц движений (один раз) и возвращает
// колонку суммы в основной таблице. Если чего-то нет — ошибка с перечнем
// недостающих и имеющихся колонок, чтобы поправить запрос по ней.
func (a *Accounting) movesColumns(ctx context.Context) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.movesBal != "" {
		return a.movesBal, nil
	}
	cols, err := a.tableColumns(ctx, a.s.AccMoves, a.s.AccMovesExt)
	if err != nil {
		return "", fmt.Errorf("колонки таблиц движений: %w", err)
	}
	var problems []string
	check := func(table string, want []string) {
		var missing []string
		for _, w := range want {
			if resolveColumn(cols[table], w) != w {
				missing = append(missing, w)
			}
		}
		if len(cols[table]) == 0 {
			problems = append(problems, "таблица "+table+" не найдена")
		} else if len(missing) > 0 {
			problems = append(problems, fmt.Sprintf("в %s нет %s; есть: %s", table, strings.Join(missing, ", "), strings.Join(cols[table], ", ")))
		}
	}
	check(a.s.AccMoves, movesMainCols)
	check(a.s.AccMovesExt, movesExtCols)
	bal := resolveColumn(cols[a.s.AccMoves], a.s.AccTotals.Balance)
	if bal == "" && len(cols[a.s.AccMoves]) > 0 {
		problems = append(problems, fmt.Sprintf("в %s нет колонки суммы %s; есть: %s", a.s.AccMoves, a.s.AccTotals.Balance, strings.Join(cols[a.s.AccMoves], ", ")))
	}
	if len(problems) > 0 {
		return "", errors.New("операции по договору: " + strings.Join(problems, " | "))
	}
	a.movesBal = bal
	return bal, nil
}

func operationsSQL(sc Schema, bal, account, contractRef string) string {
	// Номер документа — для известных видов регистраторов.
	var joins, numbers []string
	for n := range knownDocuments {
		alias := fmt.Sprintf("d%d", n)
		joins = append(joins, fmt.Sprintf("LEFT JOIN _Document%[1]d %[2]s ON e._RecorderTRef = 0x%08[1]X AND %[2]s._IDRRef = e._RecorderRRef", n, alias))
		numbers = append(numbers, alias+"._Number")
	}
	return strings.NewReplacer("{ACC}", sc.Accounts, "{BAL}", bal, "{MAIN}", sc.AccMoves,
		"{ED}", sc.AccMovesExt, "{CODE}", account, "{REF}", contractRef,
		"{JOINS}", strings.Join(joins, "\n"), "{NUMBERS}", strings.Join(numbers, ", ")).Replace(`
SELECT e._Period, CONVERT(varchar(10), e._RecorderTRef, 1), COALESCE({NUMBERS}, ''), e._Correspond, m.{BAL}
FROM {ED} e
JOIN {MAIN} m ON m._RecorderTRef = e._RecorderTRef AND m._RecorderRRef = e._RecorderRRef
  AND m._LineNo = e._LineNo AND m._Period = e._Period AND m._Active = 0x01
JOIN {ACC} acc ON acc._IDRRef = CASE WHEN e._Correspond = 0 THEN m._AccountDtRRef ELSE m._AccountCtRRef END
  AND acc._Code = '{CODE}'
{JOINS}
WHERE e._Value_RRRef = {REF}
ORDER BY e._Period`)
}
