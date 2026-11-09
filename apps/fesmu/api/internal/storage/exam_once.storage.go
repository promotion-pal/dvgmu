package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

// The unique participation row serializes simultaneous starts, including starts
// through different sessions of the same subject. An active attempt is resumed.
func (s *TestSessionStorage) ExamStartOnce(ctx context.Context, requested *models.TestSession, proposed *models.TestAttempt, now time.Time) (*models.TestAttempt, *models.TestSession, error) {
	var attempt *models.TestAttempt
	var owner *models.TestSession
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current models.TestSession
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).First(&current, requested.ID).Error; err != nil {
			return err
		}
		if !current.Open(now) {
			return models.ErrTestSessionClosed
		}
		if current.ExamSubjectKey == "" || proposed.MDMUserUUID == "" {
			return models.ErrExamNotAssigned
		}
		var assigned int64
		if err := tx.Model(&models.ExamAssignment{}).Where("session_id=? AND mdm_user_uuid=?", current.ID, proposed.MDMUserUUID).Count(&assigned).Error; err != nil {
			return err
		}
		if assigned == 0 {
			return models.ErrExamNotAssigned
		}
		claim := models.ExamParticipation{MDMUserUUID: proposed.MDMUserUUID, SubjectKey: current.ExamSubjectKey, CreatedAt: now}
		inserted := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "mdm_user_uuid"}, {Name: "subject_key"}}, DoNothing: true}).Omit("Attempt").Create(&claim)
		if inserted.Error != nil {
			return inserted.Error
		}
		if inserted.RowsAffected == 1 {
			if err := tx.Create(proposed).Error; err != nil {
				return err
			}
			if err := tx.Model(&claim).Update("attempt_id", proposed.ID).Error; err != nil {
				return err
			}
			attempt = proposed
			owner = &current
			return nil
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("mdm_user_uuid=? AND subject_key=?", proposed.MDMUserUUID, current.ExamSubjectKey).First(&claim).Error; err != nil {
			return err
		}
		if claim.AttemptID == nil {
			return models.ErrExamAlreadyTaken
		}
		var previous models.TestAttempt
		if err := tx.First(&previous, *claim.AttemptID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return models.ErrExamAlreadyTaken
			}
			return err
		}
		if !previous.InProgress() || !now.Before(previous.Deadline) {
			return models.ErrExamAlreadyTaken
		}
		var previousSession models.TestSession
		if err := tx.First(&previousSession, previous.SessionID).Error; err != nil {
			return err
		}
		if err := models.ValidateExamQuestions(previousSession.Questions); err != nil {
			return err
		}
		attempt = &previous
		owner = &previousSession
		return nil
	})
	return attempt, owner, err
}
