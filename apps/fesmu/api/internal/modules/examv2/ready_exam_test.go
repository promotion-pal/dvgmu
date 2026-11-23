package examv2

import (
	pb "fesmu/contract/fesmu/exam/service/v2"
	"fmt"
	"testing"
)

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
	if generatedTitle(b, 0) != b.Sections[0].Name {
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

func TestReadyFilesPublishSeparatelyWithoutCombiningQuestions(t *testing.T) {
	b := validBank()
	b.VariantCount = 4
	b.Sections = nil
	for _, suffix := range []string{"01", "06"} {
		name := "26/27 Профессиональная гигиена полости рта " + suffix
		b.Sections = append(b.Sections, &pb.BankSection{Name: name, ReadyVariant: true, Topics: []*pb.BankTopic{topic(suffix, 30)}})
	}
	plans, err := publicationPlans(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(plans) != 2 {
		t.Fatalf("want two independent tests, got %d", len(plans))
	}
	for i, plan := range plans {
		if plan.Title != b.Sections[i].Name || len(plan.Sections) != 1 {
			t.Fatal("ready file lost its identity")
		}
		p := params(b, plan.Sections)
		if len(p.Questions) != 30 {
			t.Fatal("ready files were combined or sampled")
		}
		for j, q := range p.Questions {
			if q.Text != SectionQuestions(b.Sections[i])[j].Text {
				t.Fatal("questions from another file or changed order")
			}
		}
	}
}
func TestMixedBankKeepsReadyFileOutOfRandomAssembly(t *testing.T) {
	b := nursingBank()
	b.Sections = append(b.Sections, &pb.BankSection{Name: "Готовый 06", ReadyVariant: true, Topics: []*pb.BankTopic{topic("готовый", 30)}})
	plans, err := publicationPlans(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(plans) != 3 {
		t.Fatal("want one ready test and two random exams")
	}
	if plans[0].Title != "Готовый 06" || len(plans[0].Sections) != 1 {
		t.Fatal("ready test merged")
	}
	for _, plan := range plans[1:] {
		if len(plan.Sections) != 2 || len(params(b, plan.Sections).Questions) != 30 {
			t.Fatal("random quotas changed")
		}
		for _, s := range plan.Sections {
			if s.ReadyVariant {
				t.Fatal("ready file leaked into random assembly")
			}
		}
	}
}
func TestIndependentReadyFilesDoNotShareFiveHundredQuestionLimit(t *testing.T) {
	b := validBank()
	b.Sections = nil
	for i := 0; i < 20; i++ {
		b.Sections = append(b.Sections, &pb.BankSection{Name: fmt.Sprint(i), ReadyVariant: true, Topics: []*pb.BankTopic{topic(fmt.Sprint(i), 30)}})
	}
	plans, err := publicationPlans(b)
	if err != nil || len(plans) != 20 {
		t.Fatalf("independent 30-question files rejected: %v", err)
	}
}
