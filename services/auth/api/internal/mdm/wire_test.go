package mdm

import (
	"encoding/json"
	"testing"
)

func TestWireUserID(t *testing.T) {
	for _, raw := range []string{`{"id":"42"}`, `{"id":42}`} {
		var u wireUser
		if err := json.Unmarshal([]byte(raw), &u); err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
		if got := u.toUser().ID; got != 42 {
			t.Fatalf("%s: id = %d, want 42", raw, got)
		}
	}
	var u wireUser
	if err := json.Unmarshal([]byte(`{"uuid":"x"}`), &u); err != nil || u.toUser().ID != 0 {
		t.Fatalf("missing id: %v %d", err, u.toUser().ID)
	}
}

func TestWireUserPermissions(t *testing.T) {
	var u wireUser
	if err := json.Unmarshal([]byte(`{"permissions":["a.b"],"effectivePermissions":["a.b","c.d"]}`), &u); err != nil {
		t.Fatal(err)
	}
	if got := u.toUser().Permissions; len(got) != 2 {
		t.Fatalf("effective not used: %v", got)
	}
	u = wireUser{}
	if err := json.Unmarshal([]byte(`{"permissions":["a.b"]}`), &u); err != nil {
		t.Fatal(err)
	}
	if got := u.toUser().Permissions; len(got) != 1 {
		t.Fatalf("fallback to own permissions: %v", got)
	}
}
