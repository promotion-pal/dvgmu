package examv2

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	svc "fesmu/contract/fesmu/service/v1"
)

type questionOccurrence struct {
	location  string
	answerKey string
}

func normalizeQuestionText(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

// A repeated stem alone is not a repeated task. Preserve meaningful punctuation
// (Na+ vs Na-, 0.1 vs 01) and include the image and unordered answer texts.
func questionIdentity(q *svc.TestQuestionInput) string {
	answers := make([]string, 0, len(q.Answers))
	for _, a := range q.Answers {
		answers = append(answers, normalizeQuestionText(a.Text))
	}
	sort.Strings(answers)
	data, _ := json.Marshal([]any{normalizeQuestionText(q.Text), q.Image, answers})
	return string(data)
}
func questionAnswerKey(q *svc.TestQuestionInput) string {
	type option struct {
		Text    string
		Correct bool
	}
	answers := make([]option, 0, len(q.Answers))
	for _, a := range q.Answers {
		answers = append(answers, option{normalizeQuestionText(a.Text), a.IsCorrect})
	}
	sort.Slice(answers, func(i, j int) bool {
		if answers[i].Text != answers[j].Text {
			return answers[i].Text < answers[j].Text
		}
		return !answers[i].Correct && answers[j].Correct
	})
	data, _ := json.Marshal(answers)
	return string(data)
}
func registerQuestion(seen map[string]questionOccurrence, q *svc.TestQuestionInput, location string) error {
	key := questionIdentity(q)
	answerKey := questionAnswerKey(q)
	if previous, ok := seen[key]; ok {
		text := []rune(q.Text)
		if len(text) > 160 {
			text = append(text[:160], []rune("…")...)
		}
		message := fmt.Sprintf("повтор задания «%s»: %s; совпадает с %s", string(text), location, previous.location)
		if previous.answerKey != answerKey {
			message += ". Разметка правильного ответа отличается — проверьте оба задания"
		}
		return bad(message)
	}
	seen[key] = questionOccurrence{location: location, answerKey: answerKey}
	return nil
}
