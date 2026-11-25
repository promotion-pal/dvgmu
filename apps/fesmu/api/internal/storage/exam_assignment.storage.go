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

func (s *TestSessionStorage) ExamAssignments(ctx context.Context, sessionID int64) ([]models.ExamAssignment, error) {
	var list []models.ExamAssignment
	err := s.db.WithContext(ctx).Where("session_id=?", sessionID).Order("id").Find(&list).Error
	return list, err
}
