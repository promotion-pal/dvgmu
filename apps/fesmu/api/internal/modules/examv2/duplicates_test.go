package examv2

import (
	pb "fesmu/contract/fesmu/exam/service/v2"
	svc "fesmu/contract/fesmu/service/v1"
	"google.golang.org/protobuf/proto"
	"testing"
)

func TestRepeatedQuestionsAreAcceptedAndPreserved(t *testing.T) {
	q := &svc.TestQuestionInput{Text: "Одинаковый вопрос", Answers: []*svc.TestAnswerInput{{Text: "Да", IsCorrect: true}, {Text: "Нет"}}}
	changed := proto.Clone(q).(*svc.TestQuestionInput)
	changed.Answers[0].IsCorrect = false
	changed.Answers[1].IsCorrect = true
	b := validBank()
	b.Sections = []*pb.BankSection{
		{Name: "Обычный", Quota: 3, Topics: []*pb.BankTopic{
			{Name: "Первая тема", Questions: []*svc.TestQuestionInput{q, proto.Clone(q).(*svc.TestQuestionInput)}},
			{Name: "Вторая тема", Questions: []*svc.TestQuestionInput{proto.Clone(q).(*svc.TestQuestionInput)}},
		}},
		{Name: "Готовый", ReadyVariant: true, Topics: []*pb.BankTopic{{Name: "Файл", Questions: []*svc.TestQuestionInput{proto.Clone(q).(*svc.TestQuestionInput), changed}}}},
	}
	if err := Validate(b); err != nil {
		t.Fatal("repeated content must not block saving", err)
	}
	sections, err := VariantSections(b)
	if err != nil {
		t.Fatal("repeated content must not block generation", err)
	}
	if len(sections[0].Questions) != 3 || len(sections[1].Questions) != 2 || len(params(b, sections).Questions) != 5 {
		t.Fatal("repeated entries were silently removed")
	}
}
