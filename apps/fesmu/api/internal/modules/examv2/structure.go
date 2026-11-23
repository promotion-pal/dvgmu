package examv2

import (
	"fmt"
	"math/rand/v2"
	"strings"
	"time"

	"dvgmu/api/internal/domain/models"
	pb "fesmu/contract/fesmu/exam/service/v2"
	svc "fesmu/contract/fesmu/service/v1"
)

// NormalizeStructure upgrades legacy JSON in memory. Old rows remain readable;
// the next save writes topics without deleting or reinterpreting any question.
func NormalizeStructure(b *pb.Bank) {
	if b == nil {
		return
	}
	for _, section := range b.Sections {
		if section == nil {
			continue
		}
		if len(section.Questions) > 0 {
			name := "Вопросы раздела"
			used := map[string]bool{}
			for _, topic := range section.Topics {
				if topic != nil {
					used[strings.ToLower(strings.TrimSpace(topic.Name))] = true
				}
			}
			for n := 2; used[strings.ToLower(name)]; n++ {
				name = fmt.Sprintf("Вопросы раздела %d", n)
			}
			section.Topics = append([]*pb.BankTopic{{Name: name, Questions: section.Questions}}, section.Topics...)
			section.Questions = nil
		}
		if section.ReadyVariant {
			section.Quota = int32(len(SectionQuestions(section)))
		}
	}

}

func SectionQuestions(section *pb.BankSection) []*svc.TestQuestionInput {
	if section == nil {
		return nil
	}
	pool := append([]*svc.TestQuestionInput{}, section.Questions...)
	for _, topic := range section.Topics {
		if topic != nil {
			pool = append(pool, topic.Questions...)
		}
	}
	return pool
}

// Every question in a section's combined pool is equally eligible. A quota is
// per section, not per topic. Sampling is without replacement within a variant.
// Ready-made sections instead keep every question in its source order.
func VariantSections(b *pb.Bank) ([]*pb.BankSection, error) {
	if err := Validate(b); err != nil {
		return nil, err
	}
	out := make([]*pb.BankSection, 0, len(b.Sections))
	for _, section := range b.Sections {
		pool := SectionQuestions(section)
		selected := &pb.BankSection{Name: section.Name, Quota: section.Quota, ReadyVariant: section.ReadyVariant}
		if section.ReadyVariant {
			selected.Questions = append(selected.Questions, pool...)
			out = append(out, selected)
			continue
		}
		order := rand.Perm(len(pool))
		for _, index := range order[:int(section.Quota)] {
			selected.Questions = append(selected.Questions, pool[index])
		}
		out = append(out, selected)
	}
	return out, nil
}

func validateTopics(b *pb.Bank, section *pb.BankSection, seen map[string]questionOccurrence) error {
	names := map[string]bool{}
	for _, topic := range section.Topics {
		if topic == nil {
			return bad("в разделе есть пустая тема")
		}
		topic.Name = strings.TrimSpace(topic.Name)
		key := strings.ToLower(topic.Name)
		if key == "" || names[key] {
			return bad("раздел «" + section.Name + "»: задайте непустые и уникальные названия тем")
		}
		names[key] = true
		for questionIndex, q := range topic.Questions {
			if q == nil {
				return bad("тема «" + topic.Name + "»: пустой вопрос")
			}
			for _, answer := range q.Answers {
				if answer == nil {
					return bad("тема «" + topic.Name + "»: пустой ответ")
				}
			}
			location := fmt.Sprintf("раздел «%s», тема «%s», вопрос №%d", section.Name, topic.Name, questionIndex+1)
			if err := registerQuestion(seen, q, location); err != nil {
				return err
			}
		}
		p := params(b, []*pb.BankSection{{Questions: topic.Questions}})
		if len(p.Questions) > 0 {
			// The normal test validator checks each topic's contents; the variant's
			// combined size is checked separately against its section quotas.
			if err := models.ValidateExamParams(p); err != nil {
				return bad(err.Error())
			}
			if err := validateTopicQuestions(p); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateTopicQuestions(p models.TestParams) error {
	if _, err := models.NewTest(p, time.Now()); err != nil {
		return bad(err.Error())
	}
	return nil
}
