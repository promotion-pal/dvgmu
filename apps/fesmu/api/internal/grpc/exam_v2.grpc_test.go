package grpc

import (
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	enum "fesmu/contract/fesmu/enum/v1"
	"testing"
)

func TestV2ResultVisibilityIsFrozenPerSession(t *testing.T) {
	h := TestSessionNewController(service.NewTestSessionService(nil, nil, nil).WithExamDirectory(nil))
	view := &service.TestAttemptView{Attempt: &models.TestAttempt{Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED, Score: 7, Total: 10}, Session: &models.TestSession{ShowResult: true}}
	if got := h.takeState(view); got.Score != 0 || got.ShowResult {
		t.Fatal("V1 result leaked")
	}
	view.Session.ExamSettings.Enabled = true
	if got := h.takeState(view); got.Score != 7 || !got.ShowResult {
		t.Fatal("V2 configured result hidden")
	}
	view.Session.ShowResult = false
	if got := h.takeState(view); got.Score != 0 || got.Total != 0 || got.ShowResult {
		t.Fatal("V2 hidden score leaked")
	}
}
