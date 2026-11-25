package storage

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"gorm.io/gorm"

	"dvgmu/analytics/internal/domain/models"
)

type DormitoryRegistrationStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func DormitoryRegistrationStorageNew(db *gorm.DB, log *slog.Logger) *DormitoryRegistrationStorage {
	return &DormitoryRegistrationStorage{
		db:  db,
		log: log,
	}
}

func (s *DormitoryRegistrationStorage) Create(ctx context.Context, registration *models.DormitoryRegistration) (int64, error) {
	if err := s.db.WithContext(ctx).Create(registration).Error; err != nil {
		if mapped := mapUniqueViolation(err); mapped != err {
			return 0, mapped
		}
		s.log.Error("failed to create dormitory registration", "error", err.Error())
		return 0, err
	}
	return registration.ID, nil
}

// ExistsUserMonth — есть ли у студента студенческая запись в месяце dutyDate.
func (s *DormitoryRegistrationStorage) ExistsUserMonth(
	ctx context.Context, userID int64, dutyDate time.Time,
) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&models.DormitoryRegistration{}).
		Where("user_id = ? AND NOT by_admin", userID).
		Where("date_trunc('month', duty_date::timestamp) = date_trunc('month', ?::timestamp)", dutyDate).
		Count(&count).Error
	if err != nil {
		s.log.Error("failed to check user month registration", "error", err.Error())
		return false, err
	}
	return count > 0, nil
}

// UpdateDate переносит запись на новую дату (пересчитывая floor от той же комнаты).
func (s *DormitoryRegistrationStorage) UpdateDate(
	ctx context.Context, id int64, data, dutyDate time.Time, floor int32,
) error {
	err := s.db.WithContext(ctx).
		Model(&models.DormitoryRegistration{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"data":       data,
			"duty_date":  dutyDate,
			"floor":      floor,
			"updated_at": time.Now(),
		}).Error
	if err != nil {
		if mapped := mapUniqueViolation(err); mapped != err {
			return mapped
		}
		s.log.Error("failed to update dormitory registration date", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *DormitoryRegistrationStorage) ByID(ctx context.Context, id int64) (*models.DormitoryRegistration, error) {
	var registration models.DormitoryRegistration
	if err := s.db.WithContext(ctx).First(&registration, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch dormitory registration by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &registration, nil
}

func (s *DormitoryRegistrationStorage) Fetch(
	ctx context.Context,
	userID *int64,
	room *int32,
	recordBook *string,
	startDate, endDate *time.Time,
) ([]models.DormitoryRegistration, error) {
	query := s.db.WithContext(ctx).Order("id")

	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if room != nil {
		query = query.Where("room = ?", *room)
	}
	if recordBook != nil && *recordBook != "" {
		query = query.Where("record_book ILIKE ?", "%"+*recordBook+"%")
	}
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	var registrations []models.DormitoryRegistration
	if err := query.Find(&registrations).Error; err != nil {
		s.log.Error("failed to fetch dormitory registrations", "error", err.Error())
		return nil, err
	}
	return registrations, nil
}
