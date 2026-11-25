package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"errors"
	enum "fesmu/contract/fesmu/enum/v1"
	"io"
	"log/slog"
	"testing"
	"time"
)

type finishPolicyStore struct {
	TestSessionStore
	a *models.TestAttempt
	s *models.TestSession
}

func (f *finishPolicyStore) TestAttemptUpdate(_ context.Context, _ string, change func(*models.TestAttempt, *models.TestSession) error) (*models.TestAttempt, *models.TestSession, error) {
	if err := change(f.a, f.s); err != nil {
		return nil, nil, err
	}
	return f.a, f.s, nil
}
func TestExamFinishRequiresAnswersButDeadlineStillEndsAttempt(t *testing.T) {
	for _, tc := range []struct {
		name              string
		answered, expired bool
	}{{"unanswered", false, false}, {"answered", true, false}, {"deadline", false, true}} {
		t.Run(tc.name, func(t *testing.T) {
			_, session := assignmentTestData(t)
			now := time.Now()
			deadline := now.Add(time.Minute)
			if tc.expired {
				deadline = now.Add(-time.Minute)
			}
			a := &models.TestAttempt{Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS, Seed: 1, Deadline: deadline}
			if tc.answered {
				for _, q := range session.AttemptQuestions(a.Seed) {
					a.Answers = append(a.Answers, models.TestAttemptAnswer{QuestionID: q.ID, AnswerIDs: []int64{q.Answers[0].ID}})
				}
			}
			store := &finishPolicyStore{a: a, s: session}
			svc := NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), store, nil)
			svc.exam = true
			svc.now = func() time.Time { return now }
			_, err := svc.TestTakeFinish(context.Background(), "attempt")
			if !tc.answered && !tc.expired {
				if !errors.Is(err, models.ErrTestInvalid) || !a.InProgress() {
					t.Fatal("unfinished exam accepted", err)
				}
				return
			}
			if err != nil || a.InProgress() {
				t.Fatal("complete or expired exam rejected", err)
			}
		})
	}
}
