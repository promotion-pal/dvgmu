package onec

import (
	"strings"
	"testing"
	"time"
)

func TestSQLMonthShiftsYearAndTruncates(t *testing.T) {
	got := sqlMonth(time.Date(2026, 3, 17, 0, 0, 0, 0, time.UTC))
	if got != "4026-03-01" {
		t.Fatalf("got %s", got)
	}
}

func TestClassify(t *testing.T) {
	cases := []struct {
		inn, name, contract string
		want                KontragentKind
	}{
		{"", "Иванов Иван Иванович", "Договор № 12 от 01.09.2024", KindPerson},
		{"", `ООО "Ромашка"`, "Договор № 5", KindOrganization},
		{"", "КГБУЗ Краевая клиническая больница", "Договор", KindOrganization},
		{"", "Министерство здравоохранения Хабаровского края", "", KindOrganization},
		{"", "Петров П.П.", "Соглашение о целевом обучении", KindOrganization},
		{"", "Центров Алексей Петрович", "Договор", KindPerson},
		{"", "Банкова А.В.", "Договор", KindPerson},
		{"", "Римского-Корсакова Анна", "Договор", KindPerson},
		{"", "Краевой центр медицинской профилактики", "Договор", KindOrganization},
		{"2721000000", "Кто угодно", "", KindOrganization},
		{"272100000000", `ИП Сидоров "Сид"`, "", KindPerson},
	}
	for _, c := range cases {
		if got := classify(c.inn, c.name, c.contract); got != c.want {
			t.Errorf("classify(%q, %q, %q) = %v, want %v", c.inn, c.name, c.contract, got, c.want)
		}
	}
}

func TestContractTurnoverQueryIsReadOnly(t *testing.T) {
	withINN := SchemaBGU2
	withINN.KontragentINN = "_Fld1234"
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)
	for _, s := range []Schema{SchemaBGU2, withINN} {
		q := (&Accounting{s: s}).turnoverSQL(AccountTuition, from, to)
		if err := assertReadOnly(q); err != nil {
			t.Fatalf("guard rejected turnover query: %v\n%s", err, q)
		}
		for _, want := range []string{"'4026-01-01'", "'4026-09-01'", "'205.31'", s.AccTotals.Table} {
			if !strings.Contains(q, want) {
				t.Errorf("query lacks %s", want)
			}
		}
	}
}
