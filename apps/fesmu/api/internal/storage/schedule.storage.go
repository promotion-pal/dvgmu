package storage

import (
	"context"
	"errors"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type ScheduleStorage struct {
	db *gorm.DB
}

func ScheduleStorageNew(db *gorm.DB) *ScheduleStorage {
	return &ScheduleStorage{db: db}
}

func (s *ScheduleStorage) ScheduleFetch(ctx context.Context, filter models.ScheduleFilter) ([]*models.Schedule, error) {
	q := s.db.WithContext(ctx).Model(&models.Schedule{})
	if filter.ProgramID != "" {
		q = q.Where("program_id = ?", filter.ProgramID)
	}
	if filter.Course > 0 {
		q = q.Where("course = ?", filter.Course)
	}

	var records []*models.Schedule
	if err := q.Order("program_id, course, semester_start DESC, title").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

func (s *ScheduleStorage) ScheduleByID(ctx context.Context, id string) (*models.Schedule, error) {
	var record models.Schedule

	err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrScheduleNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *ScheduleStorage) ScheduleCreate(ctx context.Context, schedule *models.Schedule) (string, error) {
	if err := s.db.WithContext(ctx).Create(schedule).Error; err != nil {
		return "", err
	}
	return schedule.ID, nil
}

// ScheduleUpdate replaces everything but the creation time.
func (s *ScheduleStorage) ScheduleUpdate(ctx context.Context, schedule *models.Schedule) error {
	res := s.db.WithContext(ctx).Model(&models.Schedule{}).Where("id = ?", schedule.ID).
		Select("program_id", "course", "title", "semester_start", "body", "updated_at").
		Updates(schedule)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrScheduleNotFound
	}
	return nil
}

func (s *ScheduleStorage) ScheduleDelete(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&models.Schedule{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrScheduleNotFound
	}
	return nil
}
