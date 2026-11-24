package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	mrand "math/rand/v2"
	"time"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type TestSessionStore interface {
	TestSessionFetch(ctx context.Context, testID int64) ([]*models.TestSession, error)
	TestSessionByID(ctx context.Context, id int64) (*models.TestSession, error)
	TestSessionByToken(ctx context.Context, token string) (*models.TestSession, error)
	TestSessionCreate(ctx context.Context, session *models.TestSession) (int64, error)
	TestSessionOpenUpdate(ctx context.Context, id int64, open bool) error
	TestSessionDelete(ctx context.Context, id int64) error

	TestAttemptCreate(ctx context.Context, attempt *models.TestAttempt) (int64, error)
	TestAttemptFetch(ctx context.Context, sessionID int64) ([]*models.TestAttempt, error)
	TestAttemptUpdate(ctx context.Context, token string, change func(*models.TestAttempt, *models.TestSession) error) (*models.TestAttempt, *models.TestSession, error)
	TestAttemptFinalize(ctx context.Context, attempt *models.TestAttempt) error
	TestAttemptDelete(ctx context.Context, id int64) error
}

// TestSessionService hands tests out to students as sessions and grades
// their attempts. The deadline is kept here, on the server: the page's
// countdown is only a display.
type TestSessionService struct {
	log       *slog.Logger
	store     TestSessionStore
	tests     TestProvider
	now       func() time.Time
	exam      bool
	directory ExamDirectory
}

func NewTestSessionService(log *slog.Logger, store TestSessionStore, tests TestProvider) *TestSessionService {
	return &TestSessionService{log: log, store: store, tests: tests, now: time.Now}
}

// TestAttemptView is an attempt with the questions it was asked, in order.
type TestAttemptView struct {
	Attempt   *models.TestAttempt
	Session   *models.TestSession
	Questions []models.TestSnapshotQuestion
}

func (s *TestSessionService) TestSessionCreate(ctx context.Context, testID int64, params models.TestSessionParams) (*models.TestSession, error) {
	const op = "TestSession.TestSessionCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("test_id", testID))

	test, err := s.tests.TestByID(ctx, testID)
	if err != nil {
		if !errors.Is(err, models.ErrTestNotFound) {
			log.Error(utils.MSGDBFetchByIDError("test", testID, err))
		}
		return nil, err
	}

	if s.exam && !test.ExamSettings.Enabled {
		params.ShowResult = false
	}
	session, err := models.NewTestSession(test, params, rand.Text(), s.now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("test session", err))
		return nil, err
	}
	if s.exam {
		if err := models.ValidateExamQuestions(session.Questions); err != nil {
			return nil, err
		}
		recipients, err := s.examRecipients(ctx, params.Audience)
		if err != nil {
			return nil, err
		}
		session.Assignments = recipients
		session.AssignedCount = len(recipients)
	} else if params.Audience.Kind != "" {
		return nil, models.ErrExamAudience
	}
	if _, err := s.store.TestSessionCreate(ctx, session); err != nil {
		log.Error(utils.MSGCreateError("test session", err))
		return nil, err
	}

	log.Info(utils.MSGCreateSuccess("test session", session.ID))
	return session, nil
}

func (s *TestSessionService) TestSessionFetch(ctx context.Context, testID int64) ([]*models.TestSession, error) {
	const op = "TestSession.TestSessionFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.store.TestSessionFetch(ctx, testID)
	if err != nil {
		log.Error(utils.MSGFetchError("test session", err))
		return nil, err
	}
	return list, nil
}

func (s *TestSessionService) TestSessionOpenUpdate(ctx context.Context, id int64, open bool) error {
	const op = "TestSession.TestSessionOpenUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("session_id", id), slog.Bool("is_open", open))

	if err := s.store.TestSessionOpenUpdate(ctx, id, open); err != nil {
		if !errors.Is(err, models.ErrTestSessionNotFound) {
			log.Error(utils.MSGDBUpdateError("test session", id, err))
		}
		return err
	}
	log.Info(utils.MSGUpdateSuccess("test session", id))
	return nil
}

func (s *TestSessionService) TestSessionDelete(ctx context.Context, id int64) error {
	const op = "TestSession.TestSessionDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("session_id", id))

	if err := s.store.TestSessionDelete(ctx, id); err != nil {
		if !errors.Is(err, models.ErrTestSessionNotFound) {
			log.Error(utils.MSGDBDeleteError("test session", id, err))
		}
		return err
	}
	log.Info(utils.MSGDeleteSuccess("test session", id))
	return nil
}

// TestAttemptFetch returns the session and every attempt at it. Attempts
// whose time ran out while the student was away are graded on the way.
func (s *TestSessionService) TestAttemptFetch(ctx context.Context, sessionID int64) (*models.TestSession, []TestAttemptView, error) {
	const op = "TestSession.TestAttemptFetch"
	log := s.log.With(slog.String("op", op), slog.Int64("session_id", sessionID))

	session, err := s.store.TestSessionByID(ctx, sessionID)
	if err != nil {
		if !errors.Is(err, models.ErrTestSessionNotFound) {
			log.Error(utils.MSGDBFetchByIDError("test session", sessionID, err))
		}
		return nil, nil, err
	}
	if s.exam {
		if err := s.examSessionRecipients(ctx, session); err != nil {
			return nil, nil, err
		}
	}
	attempts, err := s.store.TestAttemptFetch(ctx, sessionID)
	if err != nil {
		log.Error(utils.MSGFetchError("test attempt", err))
		return nil, nil, err
	}
	session.AttemptCount = len(attempts)

	now := s.now()
	views := make([]TestAttemptView, 0, len(attempts))
	for _, a := range attempts {
		questions := session.AttemptQuestions(a.Seed)
		if a.Expired(now) {
			a.Finish(questions, now)
			if err := s.store.TestAttemptFinalize(ctx, a); err != nil {
				log.Error("failed to grade an expired attempt", slog.Int64("attempt_id", a.ID), slog.String("error", err.Error()))
			}
		}
		views = append(views, TestAttemptView{Attempt: a, Session: session, Questions: questions})
	}
	return session, views, nil
}

func (s *TestSessionService) TestAttemptDelete(ctx context.Context, id int64) error {
	const op = "TestSession.TestAttemptDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("attempt_id", id))

	if err := s.store.TestAttemptDelete(ctx, id); err != nil {
		if !errors.Is(err, models.ErrTestAttemptNotFound) {
			log.Error(utils.MSGDBDeleteError("test attempt", id, err))
		}
		return err
	}
	log.Info(utils.MSGDeleteSuccess("test attempt", id))
	return nil
}

// TestTakeInfo: the session as a student sees it before starting.
func (s *TestSessionService) TestTakeInfo(ctx context.Context, token string) (*models.TestSession, bool, error) {
	session, err := s.sessionByToken(ctx, token)
	if err != nil {
		return nil, false, err
	}
	return session, session.Open(s.now()), nil
}

func (s *TestSessionService) TestTakeStart(ctx context.Context, token string, params models.TestAttemptParams) (*TestAttemptView, error) {
	const op = "TestSession.TestTakeStart"
	log := s.log.With(slog.String("op", op))

	session, err := s.sessionByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if s.exam {
		if err := models.ValidateExamQuestions(session.Questions); err != nil {
			return nil, err
		}
		if err := s.examCheck(ctx, session, &params); err != nil {
			return nil, err
		}
	}
	attempt, err := models.NewTestAttempt(session, params, rand.Text(), mrand.Int64(), s.now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("test attempt", err), slog.Int64("session_id", session.ID))
		return nil, err
	}
	if s.exam {
		store, ok := s.store.(ExamOnceStore)
		if !ok {
			return nil, models.ErrExamDirectory
		}
		stored, owner, err := store.ExamStartOnce(ctx, session, attempt, s.now())
		if err != nil {
			return nil, err
		}
		return &TestAttemptView{Attempt: stored, Session: owner, Questions: owner.AttemptQuestions(stored.Seed)}, nil
	}
	if _, err := s.store.TestAttemptCreate(ctx, attempt); err != nil {
		log.Error(utils.MSGCreateError("test attempt", err))
		return nil, err
	}

	log.Info(utils.MSGCreateSuccess("test attempt", attempt.ID), slog.Int64("session_id", session.ID))
	return &TestAttemptView{Attempt: attempt, Session: session, Questions: session.AttemptQuestions(attempt.Seed)}, nil
}

// TestTakeState: the attempt as it stands; one whose time ran out is graded now.
func (s *TestSessionService) TestTakeState(ctx context.Context, attemptToken string) (*TestAttemptView, error) {
	return s.updateAttempt(ctx, "TestSession.TestTakeState", attemptToken, func(a *models.TestAttempt, questions []models.TestSnapshotQuestion, now time.Time) error {
		if a.Expired(now) {
			a.Finish(questions, now)
		}
		return nil
	})
}

func (s *TestSessionService) TestTakeAnswer(ctx context.Context, attemptToken string, questionID int64, answerIDs []int64) error {
	_, err := s.updateAttempt(ctx, "TestSession.TestTakeAnswer", attemptToken, func(a *models.TestAttempt, questions []models.TestSnapshotQuestion, now time.Time) error {
		if s.exam && len(answerIDs) > 1 {
			return models.ErrTestInvalid
		}
		return a.SetAnswer(questions, questionID, answerIDs, now)
	})
	return err
}

func (s *TestSessionService) TestTakeFinish(ctx context.Context, attemptToken string) (*TestAttemptView, error) {
	view, err := s.updateAttempt(ctx, "TestSession.TestTakeFinish", attemptToken, func(a *models.TestAttempt, questions []models.TestSnapshotQuestion, now time.Time) error {
		if s.exam && a.InProgress() && now.Before(a.Deadline) {
			for _, question := range questions {
				if len(a.Picked(question.ID)) == 0 {
					return fmt.Errorf("%w: ответьте на все вопросы перед завершением", models.ErrTestInvalid)
				}
			}
		}
		a.Finish(questions, now)
		return nil
	})
	if err == nil {
		s.log.Info("test attempt finished", slog.Int64("attempt_id", view.Attempt.ID),
			slog.Int("score", view.Attempt.Score), slog.Int("total", view.Attempt.Total))
	}
	return view, err
}

func (s *TestSessionService) updateAttempt(
	ctx context.Context,
	op, attemptToken string,
	change func(a *models.TestAttempt, questions []models.TestSnapshotQuestion, now time.Time) error,
) (*TestAttemptView, error) {
	if attemptToken == "" {
		return nil, models.ErrTestAttemptNotFound
	}
	var questions []models.TestSnapshotQuestion
	attempt, session, err := s.store.TestAttemptUpdate(ctx, attemptToken, func(a *models.TestAttempt, session *models.TestSession) error {
		questions = session.AttemptQuestions(a.Seed)
		if s.exam && a.InProgress() && op != "TestSession.TestTakeFinish" {
			if err := models.ValidateExamQuestions(questions); err != nil {
				return err
			}
		}
		return change(a, questions, s.now())
	})
	if err != nil {
		if !errors.Is(err, models.ErrTestAttemptNotFound) && !errors.Is(err, models.ErrTestAttemptOver) && !errors.Is(err, models.ErrTestInvalid) {
			s.log.Error("test attempt update failed", slog.String("op", op), slog.String("error", err.Error()))
		}
		return nil, err
	}
	return &TestAttemptView{Attempt: attempt, Session: session, Questions: questions}, nil
}

func (s *TestSessionService) sessionByToken(ctx context.Context, token string) (*models.TestSession, error) {
	if token == "" {
		return nil, models.ErrTestSessionNotFound
	}
	session, err := s.store.TestSessionByToken(ctx, token)
	if err != nil && !errors.Is(err, models.ErrTestSessionNotFound) {
		s.log.Error("test session lookup failed", slog.String("error", err.Error()))
	}
	return session, err
}

// Now is the service's clock; the handler sends it to the page so the
// countdown runs on the server's time.
func (s *TestSessionService) Now() time.Time {
	return s.now()
}

func (s *TestSessionService) IsExam() bool { return s.exam }
