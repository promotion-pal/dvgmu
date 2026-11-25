package service

import (
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
)

func TestTaskFingerprint(t *testing.T) {
	fingerprint := func(version int64, data map[string]any) string {
		t.Helper()
		fields, err := structpb.NewStruct(data)
		if err != nil {
			t.Fatal(err)
		}
		digest, err := taskFingerprint(1, version, "Projector", "", fields)
		if err != nil {
			t.Fatal(err)
		}
		return digest
	}

	original := fingerprint(1, map[string]any{"room": "A-12", "count": 1})
	if got := fingerprint(1, map[string]any{"count": 1, "room": "A-12"}); got != original {
		t.Fatal("object key order changed the fingerprint")
	}
	if got := fingerprint(1, map[string]any{"room": "A-12", "count": "1"}); got == original {
		t.Fatal("different value types must have different fingerprints")
	}
	if got := fingerprint(2, map[string]any{"room": "A-12", "count": 1}); got == original {
		t.Fatal("the form version must be part of the fingerprint")
	}
}
