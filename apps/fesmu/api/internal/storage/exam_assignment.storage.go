package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
)

func (s *TestSessionStorage) ExamAssigned(ctx context.Context, sessionID int64, userUUID string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.ExamAssignment{}).Where("session_id=? AND mdm_user_uuid=?", sessionID, userUUID).Count(&count).Error
	return count > 0, err
}
