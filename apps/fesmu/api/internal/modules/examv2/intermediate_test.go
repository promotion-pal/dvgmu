package examv2

import "testing"

func TestIntermediateKindPersistsInGeneratedTestSettings(t *testing.T) {
	b := validBank()
	b.AssessmentKind = "intermediate"
	if err := Validate(b); err != nil {
		t.Fatal(err)
	}
	if Settings(b).AssessmentKind != "intermediate" {
		t.Fatal("generated test lost intermediate kind")
	}
	b.AssessmentKind = "unknown"
	if Validate(b) == nil {
		t.Fatal("unknown kind accepted")
	}
	b = validBank()
	if Settings(b).AssessmentKind != "" {
		t.Fatal("existing exam changed kind")
	}
}
