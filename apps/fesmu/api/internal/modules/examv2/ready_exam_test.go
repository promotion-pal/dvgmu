package examv2

import "testing"

func TestReadyExamKeepsOneCompleteTest(t *testing.T) {
	b := validBank()
	b.VariantCount = 4
	b.Sections[0].ReadyVariant = true
	if err := Validate(b); err != nil {
		t.Fatal(err)
	}
	if b.VariantCount != 1 {
		t.Fatal("ready exam created numbered copies")
	}
	if generatedTitle(b, 0) != b.Discipline {
		t.Fatal("ready exam title changed")
	}
	sections, err := VariantSections(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(SectionQuestions(sections[0])) != len(SectionQuestions(b.Sections[0])) {
		t.Fatal("ready exam lost questions")
	}
	if !Settings(b).Enabled {
		t.Fatal("exam must stay V2")
	}
}

func TestRandomExamKeepsRequestedVariants(t *testing.T) {
	b := validBank()
	if err := Validate(b); err != nil {
		t.Fatal(err)
	}
	if b.VariantCount != 2 || generatedTitle(b, 0) == generatedTitle(b, 1) {
		t.Fatal("random variants changed")
	}
}
