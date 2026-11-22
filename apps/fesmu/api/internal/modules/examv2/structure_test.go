package examv2

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"dvgmu/api/internal/domain/models"
	pb "fesmu/contract/fesmu/exam/service/v2"
	svc "fesmu/contract/fesmu/service/v1"
	"google.golang.org/protobuf/proto"
)

func topic(name string, count int) *pb.BankTopic {
	out := &pb.BankTopic{Name: name}
	for i := 0; i < count; i++ {
		out.Questions = append(out.Questions, &svc.TestQuestionInput{Text: fmt.Sprintf("%s вопрос %d", name, i+1), Answers: []*svc.TestAnswerInput{{Text: "Верно", IsCorrect: true}, {Text: "Неверно"}}})
	}
	return out
}
func nursingBank() *pb.Bank {
	b := validBank()
	b.Specialty = "Сестринское дело"
	b.Discipline = "Экзамен"
	b.Sections = []*pb.BankSection{
		{Name: "Кардиология", Quota: 5, Topics: []*pb.BankTopic{topic("Нарушения ритма", 10), topic("Сердечная недостаточность", 10)}},
		{Name: "Эндокринология", Quota: 25, Topics: []*pb.BankTopic{topic("Диабет", 20), topic("Щитовидная железа", 20)}},
	}
	return b
}
func TestSectionQuotasDrawThirtyQuestionsFromCombinedTopicPools(t *testing.T) {
	b := nursingBank()
	before := proto.Clone(b)
	for n := 0; n < 20; n++ {
		selected, err := VariantSections(b)
		if err != nil {
			t.Fatal(err)
		}
		seen := map[string]bool{}
		for i, s := range selected {
			if len(s.Questions) != int(b.Sections[i].Quota) {
				t.Fatalf("quota changed in section %s: %d", s.Name, len(s.Questions))
			}
			pool := map[string]bool{}
			for _, q := range SectionQuestions(b.Sections[i]) {
				pool[q.Text] = true
			}
			for _, q := range s.Questions {
				if !pool[q.Text] || seen[q.Text] {
					t.Fatal("question outside section or repeated", q.Text)
				}
				seen[q.Text] = true
			}
		}
		if len(seen) != 30 || len(params(b, selected).Questions) != 30 {
			t.Fatal("5 + 25 must yield exactly 30 questions")
		}
	}
	if !proto.Equal(before, b) {
		t.Fatal("sampling changed the question bank")
	}
}
func TestTopicStructureRejectsInvalidQuotasNamesAndDuplicates(t *testing.T) {
	cases := []struct {
		name   string
		change func(*pb.Bank)
	}{
		{"not enough in combined pool", func(b *pb.Bank) { b.Sections[1].Quota = 41 }},
		{"negative quota", func(b *pb.Bank) { b.Sections[0].Quota = -1 }},
		{"empty topic name", func(b *pb.Bank) { b.Sections[0].Topics[0].Name = " " }},
		{"duplicate topic name", func(b *pb.Bank) { b.Sections[0].Topics[1].Name = " нарушения РИТМА " }},
		{"duplicate question across topics", func(b *pb.Bank) { b.Sections[1].Topics[0].Questions[0] = b.Sections[0].Topics[0].Questions[0] }},
		{"multiple correct", func(b *pb.Bank) { b.Sections[0].Topics[0].Questions[0].Answers[1].IsCorrect = true }},
		{"nil topic", func(b *pb.Bank) { b.Sections[0].Topics[0] = nil }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b := nursingBank()
			tc.change(b)
			if _, err := VariantSections(b); err == nil {
				t.Fatal("invalid structure accepted")
			}
		})
	}
}
func TestLegacyBankDecodesToTopicWithoutChangingStoredPayload(t *testing.T) {
	raw := json.RawMessage(`{"specialty":"Педиатрия","sections":[{"name":"Старый раздел","quota":1,"questions":[{"text":"Старый вопрос","answers":[{"text":"Да","isCorrect":true},{"text":"Нет"}]}]}]}`)
	before := string(raw)
	b, err := Decode(BankRecord{ID: 7, Revision: 3, Payload: raw})
	if err != nil {
		t.Fatal(err)
	}
	section := b.Sections[0]
	if b.Id != 7 || b.Revision != 3 || len(section.Questions) != 0 || len(section.Topics) != 1 || section.Topics[0].Questions[0].Text != "Старый вопрос" {
		t.Fatalf("legacy bank was not preserved: %v", b)
	}
	NormalizeStructure(b)
	if len(section.Topics) != 1 || string(raw) != before {
		t.Fatal("normalization must be idempotent and leave stored JSON untouched")
	}
	// Old clients can still submit a flat bank; validation converts it too.
	if err := Validate(validBank()); err != nil {
		t.Fatal(err)
	}
}
func TestGeneratedSessionCannotLoseSectionQuotasByTakingSubset(t *testing.T) {
	b := nursingBank()
	selected, err := VariantSections(b)
	if err != nil {
		t.Fatal(err)
	}
	test, err := models.NewTest(params(b, selected), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	test.ExamSettings = Settings(b)
	input := models.TestSessionParams{DurationMinutes: 20, QuestionCount: 20}
	if _, err := models.NewTestSession(test, input, "token", time.Now()); err == nil {
		t.Fatal("session reduced the 30-question blueprint")
	}
	for _, count := range []int{0, 30} {
		input.QuestionCount = count
		s, err := models.NewTestSession(test, input, "token", time.Now())
		if err != nil || s.AskedCount() != 30 {
			t.Fatalf("full blueprint not preserved: %v %v", s, err)
		}
	}
	// Ordinary tests retain their configurable subset behavior.
	test.ExamSettings.Enabled = false
	input.QuestionCount = 20
	if s, err := models.NewTestSession(test, input, "token", time.Now()); err != nil || s.AskedCount() != 20 {
		t.Fatal("legacy subset behavior changed", err)
	}
}
