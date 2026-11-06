package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"time"
)

// ExamPublicFetch lists one currently open session per test. Staff can revoke
// access by closing the session; future, expired and deleted tests stay private.
func (s *TestSessionStorage) ExamPublicFetch(ctx context.Context, now time.Time) ([]models.ExamPublicTest, error) {
	var list []models.ExamPublicTest
	err := s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (t.id) t.id AS test_id, s.token,
			t.department AS faculty, t.semester, t.discipline AS subject,
			s.topic AS title, s.duration_minutes
		FROM tests t JOIN test_sessions s ON s.test_id = t.id
		WHERE s.is_open = TRUE
		  AND (s.opens_at IS NULL OR s.opens_at <= ?)
		  AND (s.closes_at IS NULL OR s.closes_at > ?)
		ORDER BY t.id, s.created_at DESC, s.id DESC`, now, now).Scan(&list).Error
	return list, err
}
