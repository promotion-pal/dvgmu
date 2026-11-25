package onec

import (
	"testing"
	"time"
)

func d(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }

func TestBuildSchedulesAmountsAndPercents(t *testing.T) {
	rows := [][]string{
		// договор A: строка с рублями
		{"0xA", "0xDOC1", "line1", "2280000", "4026-09-01 00:00:00", "380000"},
		{"0xA", "0xDOC1", "line1", "2280000", "4027-09-01 00:00:00", "380000"},
		// договор B: строка с процентами (50 + 50 = 100) от 1 000 000
		{"0xB", "0xDOC1", "line2", "1000000", "4027-02-01 00:00:00", "50"},
		{"0xB", "0xDOC1", "line2", "1000000", "4026-09-01 00:00:00", "50"},
		// пустая дата 1С пропускается
		{"0xC", "0xDOC1", "line3", "100", "2001-01-01 00:00:00", "100"},
	}
	got := buildSchedules(rows)
	if a := got["0xA"]; len(a) != 2 || a[0].Amount != 380000 || !a[0].Until.Equal(d(2026, 9, 1)) {
		t.Fatalf("A: %+v", a)
	}
	b := got["0xB"]
	if len(b) != 2 || b[0].Amount != 500000 || !b[0].Until.Equal(d(2026, 9, 1)) {
		t.Fatalf("B must be 50%% of 1 000 000, sorted by date: %+v", b)
	}
	if _, ok := got["0xC"]; ok {
		t.Fatal("empty 1C date must be skipped")
	}
}

func TestDueNow(t *testing.T) {
	schedule := []Payment{
		{Until: d(2026, 9, 1), Amount: 380000},
		{Until: d(2027, 9, 1), Amount: 380000},
		{Until: d(2028, 9, 1), Amount: 380000},
	}
	today := d(2026, 10, 5)
	// Ничего не оплачено: остаток — весь договор, к оплате — сентябрьский платёж.
	if got := DueNow(1140000, schedule, today); got != 380000 {
		t.Fatalf("unpaid: %v", got)
	}
	// Сентябрьский платёж внесён: к оплате 0.
	if got := DueNow(760000, schedule, today); got != 0 {
		t.Fatalf("paid on time: %v", got)
	}
	// Оплачено вперёд: не меньше нуля.
	if got := DueNow(380000, schedule, today); got != 0 {
		t.Fatalf("paid ahead: %v", got)
	}
}

func TestScheduleAndReceiptQueriesAreReadOnly(t *testing.T) {
	rc := receiptCols{Contract: "_Fld9447RRef", Amount: "_Fld9444", ValidUntil: "_Fld9442", UIN: "_Fld9446",
		Purpose: "_Fld9425", Cancel: "_Fld9455"}
	for name, q := range map[string]string{
		"schedule": scheduleRowsSQL(SchemaBGU2, testScheduleCols),
		"receipts": receiptsSQL(SchemaBGU2.Receipt.Doc, rc),
	} {
		if err := assertReadOnly(q); err != nil {
			t.Errorf("%s: %v\n%s", name, err, q)
		}
	}
}

// Строки начисления без LineID: все договоры одного документа должны получить
// свой график, а не только тот, что стоит первым в выборке.
func TestBuildSchedulesKeepsEveryContractOfADocument(t *testing.T) {
	doc := "0xDOC"
	zero := "0x00000000000000000000000000000000"
	var rows [][]string
	for _, ref := range []string{"0xA", "0xB", "0xC"} {
		for i := 0; i < 3; i++ {
			rows = append(rows, []string{ref, doc, zero, "100.00", "4026-09-30 00:00:00", "33.33"})
		}
	}
	got := buildSchedules(rows)
	for _, ref := range []string{"0xA", "0xB", "0xC"} {
		if len(got[ref]) != 3 {
			t.Fatalf("%s: want 3 payments, got %d", ref, len(got[ref]))
		}
	}
}
