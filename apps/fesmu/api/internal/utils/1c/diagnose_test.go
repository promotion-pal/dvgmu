package onec

import (
	"strings"
	"testing"
)

func TestDiagnoseQueriesAreReadOnly(t *testing.T) {
	countSQL, slotSQL := accountTablesSQL("_Acc54",
		[]string{"_AccRgAT341390", "_AccRgAT141390"},
		map[string][]string{"_AccRgAT341390": {"_Value1_RTRef", "_Value2_RTRef", "_Value3_RTRef"}, "_AccRgAT141390": {"_Value1_RTRef"}})
	for name, q := range map[string]string{
		"count":     countSQL,
		"slot":      slotSQL,
		"monthly":   monthlySQL(SchemaBGU2),
		"debt":      debtCheckSQL(SchemaBGU2),
		"recorders": recordersSQL(SchemaBGU2),
		"cover":     scheduleCoverSQL(SchemaBGU2, testScheduleCols),
		"sample":    scheduleSampleSQL(SchemaBGU2, testScheduleCols),
		"rows":      tableRowsSQL,
		"columns":   atColumnsSQL,
	} {
		if err := assertReadOnly(q); err != nil {
			t.Errorf("%s: %v\n%s", name, err, q)
		}
	}
	// Table with one subconto: only real columns in GROUP BY, never a '' constant.
	one := slotSQL[strings.Index(slotSQL, "'_AccRgAT141390'"):]
	if !strings.Contains(one, "GROUP BY a._Code, x._Value1_RTRef ORDER") {
		t.Fatalf("one-subconto GROUP BY wrong:\n%s", one)
	}
	if strings.Contains(slotSQL, "GROUP BY a._Code, ''") || strings.Contains(slotSQL, ", ''") && strings.Contains(slotSQL, "GROUP BY '") {
		t.Fatalf("constant in GROUP BY:\n%s", slotSQL)
	}
}

var testScheduleCols = scheduleCols{
	LinesParent: "_Document683_IDRRef", LineID: "_Fld10831", Student: "_Fld10832RRef", Kontragent: "_Fld10833RRef",
	Contract: "_Fld10834RRef", Sum: "_Fld10838",
	PayParent: "_Document683_IDRRef", PayLineID: "_Fld10848", PayUntil: "_Fld10849", PayAmount: "_Fld10850",
	PeriodStart: "_Fld10851", PeriodEnd: "_Fld10852",
}

func TestResolveColumn(t *testing.T) {
	cols := []string{"_Document683_IDRRef", "_KeyField", "_LineNo10830", "_Fld1083", "_Fld10831", "_Fld10834RRef",
		"_Fld10850_TYPE", "_Fld10850_N", "_Fld10850_RTRef", "_Fld10850_RRRef"}
	ref, num := []string{"RRef", "_RRRef"}, []string{"_N"}
	for _, c := range []struct {
		fld    string
		prefer []string
		want   string
	}{
		{"_Document683_IDRRef", nil, "_Document683_IDRRef"},
		{"_Fld10831", nil, "_Fld10831"},
		{"_Fld10834", ref, "_Fld10834RRef"},
		{"_Fld1083", nil, "_Fld1083"}, // exact wins over _Fld10831
		{"_Fld10850", num, "_Fld10850_N"},
		{"_Fld10850", ref, "_Fld10850_RRRef"},
		{"_Fld99999", ref, ""},
	} {
		if got := resolveColumn(cols, c.fld, c.prefer...); got != c.want {
			t.Errorf("%s %v: got %q, want %q", c.fld, c.prefer, got, c.want)
		}
	}
}

func TestDocumentTitle(t *testing.T) {
	names := documentNames(nil)
	if got := documentTitle("0x000002AC", names); got != "Документ.НачислениеЗаУслугиОбразования (_Document684)" {
		t.Fatalf("got %q", got)
	}
	if got := documentTitle("0x00000001", names); got != "_Document1" {
		t.Fatalf("got %q", got)
	}
}
