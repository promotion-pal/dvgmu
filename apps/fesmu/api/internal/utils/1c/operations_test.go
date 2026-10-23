package onec

import (
	"context"
	"strings"
	"testing"
)

func TestOperationsSQL(t *testing.T) {
	q := operationsSQL(SchemaBGU2, "_Fld41355", AccountTuition, "0x"+strings.Repeat("A1", 16))
	if err := assertReadOnly(q); err != nil {
		t.Fatalf("%v\n%s", err, q)
	}
	if !strings.Contains(q, "e._RecorderTRef = 0x000002AC AND d684._IDRRef") {
		t.Fatalf("document 684 join missing:\n%s", q)
	}
}

func TestContractOperationsRejectsBadRef(t *testing.T) {
	a := &Accounting{s: SchemaBGU2}
	for _, ref := range []string{"", "0x12", "0x" + strings.Repeat("A", 31) + "'", "1; DROP TABLE x"} {
		if _, err := a.TuitionOperations(context.Background(), ref); err == nil {
			t.Errorf("%q must be rejected before any query", ref)
		}
	}
}
