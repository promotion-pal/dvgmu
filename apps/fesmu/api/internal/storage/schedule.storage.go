package storage

import (
	"context"
	"errors"
	"time"

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

func (s *ScheduleStorage) ScheduleUpdate(ctx context.Context, schedule *models.Schedule, expectedUpdatedAt time.Time) error {
	query := s.db.WithContext(ctx).Model(&models.Schedule{}).Where("id = ?", schedule.ID)
	res := query.Session(&gorm.Session{}).Where("updated_at = ?", expectedUpdatedAt).
		Updates(map[string]any{
			"program_id": schedule.ProgramID, "course": schedule.Course, "title": schedule.Title,
			"semester_start": schedule.SemesterStart, "body": schedule.Body,
			"updated_at": gorm.Expr("GREATEST(?, updated_at + INTERVAL '1 microsecond')", schedule.UpdatedAt),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		var count int64
		if err := query.Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return models.ErrScheduleNotFound
		}
		return models.ErrScheduleStale
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
