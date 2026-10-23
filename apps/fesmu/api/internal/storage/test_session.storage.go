package storage

import (
	"context"
	"errors"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v1"
	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TestSessionStorage keeps sessions and attempts in the test database, next to the tests.
type TestSessionStorage struct {
	db *gorm.DB
}

func TestSessionStorageNew(db *gorm.DB) *TestSessionStorage {
	return &TestSessionStorage{db: db}
}

// The list leaves the frozen questions out: they can run to hundreds per session.
const testSessionListColumns = `test_sessions.id, test_sessions.test_id, test_sessions.token, test_sessions.topic,
	test_sessions.department, test_sessions.description, test_sessions.note, test_sessions.duration_minutes,
	test_sessions.question_count, test_sessions.option_count, test_sessions.pick_version, test_sessions.version, test_sessions.distinct_questions, test_sessions.shuffle, test_sessions.show_result, test_sessions.is_open,
	test_sessions.opens_at, test_sessions.closes_at, test_sessions.created_at, test_sessions.updated_at,
	CASE WHEN test_sessions.pick_version >= 1 THEN test_sessions.distinct_questions
		ELSE jsonb_array_length(test_sessions.questions) END AS total_questions,
	(SELECT count(*) FROM test_attempts WHERE test_attempts.session_id = test_sessions.id) AS attempt_count`

func (s *TestSessionStorage) TestSessionFetch(ctx context.Context, testID int64) ([]*models.TestSession, error) {
	q := s.db.WithContext(ctx).Model(&models.TestSession{}).Select(testSessionListColumns)
	if testID != 0 {
		q = q.Where("test_sessions.test_id = ?", testID)
	}

	var records []*models.TestSession
	if err := q.Order("test_sessions.created_at DESC, test_sessions.id DESC").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (s *TestSessionStorage) TestSessionByID(ctx context.Context, id int64) (*models.TestSession, error) {
	return s.sessionBy(ctx, "id = ?", id)
}

func (s *TestSessionStorage) TestSessionByToken(ctx context.Context, token string) (*models.TestSession, error) {
	return s.sessionBy(ctx, "token = ?", token)
}

func (s *TestSessionStorage) sessionBy(ctx context.Context, where string, arg any) (*models.TestSession, error) {
	var record models.TestSession
	err := s.db.WithContext(ctx).First(&record, where, arg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrTestSessionNotFound
	}
	if err != nil {
		return nil, err
	}
	record.TotalQuestions = record.QuestionTotal()
	return &record, nil
}

func (s *TestSessionStorage) TestSessionCreate(ctx context.Context, session *models.TestSession) (int64, error) {
	if err := s.db.WithContext(ctx).Omit("Test", "Attempts").Create(session).Error; err != nil {
		return 0, err
	}
	return session.ID, nil
}

func (s *TestSessionStorage) TestSessionOpenUpdate(ctx context.Context, id int64, open bool) error {
	res := s.db.WithContext(ctx).Model(&models.TestSession{}).Where("id = ?", id).
		Updates(map[string]any{"is_open": open, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrTestSessionNotFound
	}
	return nil
}

func (s *TestSessionStorage) TestSessionDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.TestSession{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrTestSessionNotFound
	}
	return nil
}

func (s *TestSessionStorage) TestAttemptCreate(ctx context.Context, attempt *models.TestAttempt) (int64, error) {
	if err := s.db.WithContext(ctx).Create(attempt).Error; err != nil {
		return 0, err
	}
	return attempt.ID, nil
}

func (s *TestSessionStorage) TestAttemptFetch(ctx context.Context, sessionID int64) ([]*models.TestAttempt, error) {
	var records []*models.TestAttempt
	err := s.db.WithContext(ctx).Where("session_id = ?", sessionID).Order("started_at, id").Find(&records).Error
	if err != nil {
		return nil, err
	}
	return records, nil
}

// TestAttemptUpdate runs change on the attempt behind token, with its
// session, under a row lock — answers saved from two tabs at once don't
// overwrite each other — and stores the result.
func (s *TestSessionStorage) TestAttemptUpdate(
	ctx context.Context,
	token string,
	change func(attempt *models.TestAttempt, session *models.TestSession) error,
) (*models.TestAttempt, *models.TestSession, error) {
	var attempt models.TestAttempt
	var session models.TestSession
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&attempt, "token = ?", token).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.ErrTestAttemptNotFound
		}
		if err != nil {
			return err
		}
		if err := tx.First(&session, "id = ?", attempt.SessionID).Error; err != nil {
			return err
		}
		session.TotalQuestions = session.QuestionTotal()

		if err := change(&attempt, &session); err != nil {
			return err
		}
		return tx.Model(&attempt).Select("status", "answers", "score", "total", "finished_at").Updates(&attempt).Error
	})
	if err != nil {
		return nil, nil, err
	}
	return &attempt, &session, nil
}

// TestAttemptFinalize stores the grade of an attempt whose time ran out,
// unless it was finished meanwhile.
func (s *TestSessionStorage) TestAttemptFinalize(ctx context.Context, attempt *models.TestAttempt) error {
	return s.db.WithContext(ctx).Model(&models.TestAttempt{}).
		Where("id = ? AND status = ?", attempt.ID, enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS).
		Updates(map[string]any{
			"status":      attempt.Status,
			"score":       attempt.Score,
			"total":       attempt.Total,
			"finished_at": attempt.FinishedAt,
		}).Error
}

func (s *TestSessionStorage) TestAttemptDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.TestAttempt{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrTestAttemptNotFound
	}
	return nil
}
