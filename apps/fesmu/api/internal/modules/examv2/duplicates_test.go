package examv2

import (
	"strings"
	"testing"

	svc "fesmu/contract/fesmu/service/v1"
	"google.golang.org/protobuf/proto"
)

func duplicateFixture() *svc.TestQuestionInput {
	return &svc.TestQuestionInput{Text: "Выберите вещество", Answers: []*svc.TestAnswerInput{{Text: "Натрий", IsCorrect: true}, {Text: "Калий"}}}
}
func TestFullQuestionIdentityAllowsDifferentTasksWithSameStem(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*svc.TestQuestionInput)
	}{
		{"different answers", func(q *svc.TestQuestionInput) { q.Answers[1].Text = "Кальций" }},
		{"different image", func(q *svc.TestQuestionInput) { q.Image = strings.Repeat("a", 64) }},
		{"significant punctuation", func(q *svc.TestQuestionInput) { q.Text = "Выберите вещество+" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := validBank()
			a := duplicateFixture()
			other := proto.Clone(a).(*svc.TestQuestionInput)
			tc.change(other)
			b.Sections[0].Questions = []*svc.TestQuestionInput{a, other}
			b.Sections[0].Quota = 2
			if err := Validate(b); err != nil {
				t.Fatal("different full tasks were rejected", err)
			}
			selected, err := VariantSections(b)
			if err != nil || len(selected[0].Questions) != 2 {
				t.Fatal("distinct questions lost during generation", err)
			}
		})
	}
	a := duplicateFixture()
	a.Text = "Заряд Na+"
	b := proto.Clone(a).(*svc.TestQuestionInput)
	b.Text = "Заряд Na-"
	if questionIdentity(a) == questionIdentity(b) {
		t.Fatal("charge symbols must not disappear")
	}
	a.Text = "Доза 0,1 мг"
	b.Text = "Доза 01 мг"
	if questionIdentity(a) == questionIdentity(b) {
		t.Fatal("decimal punctuation must not disappear")
	}
}
func TestDuplicateErrorIdentifiesBothLocationsAndAnswerConflicts(t *testing.T) {
	a := duplicateFixture()
	b := proto.Clone(a).(*svc.TestQuestionInput)
	b.Text = "  ВЫБЕРИТЕ   вещество "
	b.Answers[0], b.Answers[1] = b.Answers[1], b.Answers[0]
	seen := map[string]questionOccurrence{}
	first := "раздел «Кардиология», тема «Первый файл», вопрос №3"
	second := "раздел «Готовый вариант», тема «Второй файл», вопрос №7"
	if err := registerQuestion(seen, a, first); err != nil {
		t.Fatal(err)
	}
	err := registerQuestion(seen, b, second)
	if err == nil || !strings.Contains(err.Error(), first) || !strings.Contains(err.Error(), second) {
		t.Fatalf("duplicate location missing: %v", err)
	}
	b.Answers[0].IsCorrect = !b.Answers[0].IsCorrect
	b.Answers[1].IsCorrect = !b.Answers[1].IsCorrect
	if err := registerQuestion(seen, b, second); err == nil || !strings.Contains(err.Error(), "Разметка правильного ответа отличается") {
		t.Fatalf("answer-key conflict hidden: %v", err)
	}
}
