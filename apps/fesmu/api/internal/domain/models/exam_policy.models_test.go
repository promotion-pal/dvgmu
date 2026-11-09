package models

import (
	"errors"
	"testing"
)

func TestExamRequiresExactlyOneCorrectAnswer(t *testing.T) {
	for _, count := range []int{0, 1, 2} {
		q := TestSnapshotQuestion{Answers: []TestSnapshotAnswer{{IsCorrect: count > 0}, {IsCorrect: count > 1}}}
		err := ValidateExamQuestions([]TestSnapshotQuestion{q})
		if count == 1 && err != nil {
			t.Fatal(err)
		}
		if count != 1 && !errors.Is(err, ErrTestInvalid) {
			t.Fatalf("accepted %d correct answers", count)
		}
		params := TestParams{Questions: []TestQuestionParams{{Answers: []TestAnswerParams{{IsCorrect: count > 0}, {IsCorrect: count > 1}}}}}
		err = ValidateExamParams(params)
		if (err == nil) != (count == 1) {
			t.Fatalf("editor accepted %d correct answers: %v", count, err)
		}
	}
}
