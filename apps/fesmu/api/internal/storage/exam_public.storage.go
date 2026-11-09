package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"time"
)

// ExamPublicFetch lists one currently open session per test. Staff can revoke
// access by closing the session; future, expired and deleted tests stay private.
func (s *TestSessionStorage) ExamPublicFetch(ctx context.Context, now time.Time, userUUID string) ([]models.ExamPublicTest, error) {
	var list []models.ExamPublicTest
	err := s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (t.id) t.id AS test_id, s.token,
			t.department AS faculty, t.semester, t.discipline AS subject,
			s.topic AS title, s.duration_minutes
		FROM tests t JOIN test_sessions s ON s.test_id = t.id
		WHERE s.is_open = TRUE
 AND EXISTS(SELECT 1 FROM exam_assignments a WHERE a.session_id=s.id AND a.mdm_user_uuid=?)
		  AND NOT EXISTS (
    SELECT 1 FROM exam_participations p LEFT JOIN test_attempts used ON used.id=p.attempt_id
    WHERE p.mdm_user_uuid=? AND p.subject_key=s.exam_subject_key
      AND (p.attempt_id IS NULL OR used.id IS NULL OR used.status<>1 OR used.deadline<=?)
  )
  AND (s.opens_at IS NULL OR s.opens_at <= ?)
		  AND (s.closes_at IS NULL OR s.closes_at > ?)
		ORDER BY t.id, s.created_at DESC, s.id DESC`, userUUID, userUUID, now, now, now).Scan(&list).Error
	return list, err
}
