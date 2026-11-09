package models

import (
	"errors"
	"testing"
)

func TestExamSubjectIdentity(t *testing.T) {
	a := &Test{ID: 1, Department: " Педиатрический  факультет ", Semester: 2, Discipline: "Анатомия", Topic: "Первый вариант"}
	b := &Test{ID: 2, Department: "педиатрический факультет", Semester: 2, Discipline: " анатомия ", Topic: "Другой вариант"}
	if ExamSubjectKey(a) != ExamSubjectKey(b) {
		t.Fatal("new test title must not reset subject entitlement")
	}
	b.Semester = 3
	if ExamSubjectKey(a) == ExamSubjectKey(b) {
		t.Fatal("different semester must have its own entitlement")
	}
	b.Semester = 2
	b.Department = "Лечебный факультет"
	if ExamSubjectKey(a) == ExamSubjectKey(b) {
		t.Fatal("different faculty must have its own entitlement")
	}
}
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
