package grpc

import (
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	enum "fesmu/contract/fesmu/enum/v1"
	"testing"
)

func TestExamStudentNeverReceivesScoreEvenForLegacySession(t *testing.T) {
	view := &service.TestAttemptView{Session: &models.TestSession{ShowResult: true}, Attempt: &models.TestAttempt{Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED, Score: 7, Total: 10}}
	normal := TestSessionNewController(service.NewTestSessionService(nil, nil, nil))
	if got := normal.takeState(view); !got.ShowResult || got.Score != 7 || got.Total != 10 {
		t.Fatalf("normal tests changed: %v", got)
	}
	exam := TestSessionNewController(service.NewTestSessionService(nil, nil, nil).WithExamDirectory(nil))
	got := exam.takeState(view)
	if got.ShowResult || got.Score != 0 || got.Total != 0 || len(got.Questions) != 0 {
		t.Fatalf("exam result leaked: %v", got)
	}
	if view.Attempt.Score != 7 || view.Attempt.Total != 10 {
		t.Fatal("teacher's result was lost")
	}
}

func TestExamQuestionsUseSingleSelection(t *testing.T) {
	view := &service.TestAttemptView{Session: &models.TestSession{}, Attempt: &models.TestAttempt{Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS}, Questions: []models.TestSnapshotQuestion{{ID: 1, Multiple: true, Answers: []models.TestSnapshotAnswer{{ID: 1, Text: "Yes", IsCorrect: true}, {ID: 2, Text: "No"}}}}}
	exam := TestSessionNewController(service.NewTestSessionService(nil, nil, nil).WithExamDirectory(nil))
	got := exam.takeState(view)
	if len(got.Questions) != 1 || got.Questions[0].Multiple {
		t.Fatalf("exam question allows multiple picks: %v", got)
	}
	normal := TestSessionNewController(service.NewTestSessionService(nil, nil, nil))
	if !normal.takeState(view).Questions[0].Multiple {
		t.Fatal("ordinary test selection changed")
	}
}
