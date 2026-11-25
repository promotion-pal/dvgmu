package onec

// Бизнес-методы по бухгалтерии (базы БГУ). Транспорт — Client, номера таблиц — Schema.

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
)

// AccountTuition — счёт «Расчёты по доходам от оказания платных услуг» (плата за обучение).
const AccountTuition = "205.31"

// ContractBalance — остаток по договору на счёте.
// Это «сколько осталось заплатить за весь срок», а не просрочка.
type ContractBalance struct {
	Kontragent string // _Reference203._Description — студент/плательщик
	Dogovor    string // _Reference129._Description — договор
	Ostatok    float64
}

// Accounting — репозиторий бухгалтерских данных одной базы.
type Accounting struct {
	c *Client
	s Schema

	// Имена колонок SQL графика оплаты и квитанций: определяются по
	// sys.columns один раз и не меняются, пока не обновят конфигурацию 1С.
	mu          sync.Mutex
	schedCols   *scheduleCols
	receiptCols *receiptCols
	movesBal    string // колонка суммы в таблице движений, если колонки проверены
}

func NewAccounting(c *Client, s Schema) *Accounting {
	return &Accounting{c: c, s: s}
}

var reAccountCode = regexp.MustCompile(`^\d+(\.\d+)*$`)

// ContractBalance — текущие положительные остатки по счёту в разрезе
// контрагент/договор (субконто 1 и 2), по убыванию суммы.
func (a *Accounting) ContractBalance(ctx context.Context, account string) ([]ContractBalance, error) {
	// Транспорт без параметров, поэтому код счёта валидируем перед подстановкой.
	if !reAccountCode.MatchString(account) {
		return nil, fmt.Errorf("некорректный код счёта: %q", account)
	}

	t := a.s.AccTotals
	q := fmt.Sprintf(`
SELECT k._Description, d._Description, SUM(t.%[1]s)
FROM %[2]s t
JOIN %[3]s acc ON acc._IDRRef = t._AccountRRef AND acc._Code = '%[4]s'
LEFT JOIN %[5]s k ON k._IDRRef = t._Value1_RRRef
LEFT JOIN %[6]s d ON d._IDRRef = t._Value2_RRRef
WHERE t._Period = '%[7]s'
GROUP BY k._Description, d._Description
HAVING SUM(t.%[1]s) > 0
ORDER BY SUM(t.%[1]s) DESC`,
		t.Balance, t.Table, a.s.Accounts, account, a.s.Kontragents, a.s.Contracts, t.CurrentTotal)

	rows, err := a.c.queryRows(ctx, q, 3)
	if err != nil {
		return nil, err
	}

	out := make([]ContractBalance, 0, len(rows))
	for _, row := range rows {
		out = append(out, ContractBalance{Kontragent: row[0], Dogovor: row[1], Ostatok: parseFloat(row[2])})
	}
	return out, nil
}

// TuitionBalance — остатки по плате за обучение (205.31) только по студентам:
// соглашения с организациями (министерство и т.п.) исключены.
func (a *Accounting) TuitionBalance(ctx context.Context) ([]ContractBalance, error) {
	all, err := a.ContractBalance(ctx, AccountTuition)
	if err != nil {
		return nil, err
	}
	out := all[:0]
	for _, b := range all {
		if !strings.HasPrefix(b.Dogovor, "Соглашение") {
			out = append(out, b)
		}
	}
	return out, nil
}
