package storage

import (
	"context"
	"errors"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type HallStorage struct {
	db *gorm.DB
}

func HallStorageNew(db *gorm.DB) *HallStorage {
	return &HallStorage{db: db}
}

func (s *HallStorage) HallFetch(ctx context.Context) ([]*models.Hall, error) {
	var records []*models.Hall

	if err := s.db.WithContext(ctx).Order("id").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

func (s *HallStorage) HallBookingFetch(ctx context.Context, filter models.HallBookingFilter) ([]*models.HallBooking, error) {
	q := s.db.WithContext(ctx).Model(&models.HallBooking{})
	if filter.HallID != 0 {
		q = q.Where("hall_id = ?", filter.HallID)
	}
	// Dates are stored as ISO strings, so they compare correctly as text.
	if filter.DateFrom != "" {
		q = q.Where("date >= ?", filter.DateFrom)
	}
	if filter.DateTo != "" {
		q = q.Where("date <= ?", filter.DateTo)
	}

	var records []*models.HallBooking
	if err := q.Order("date, time_start, hall_id").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

// HallBookingCreate saves a booking unless it overlaps another one of the same
// hall. The hall row is locked for the check-and-insert, so two concurrent
// requests for the same hall are serialized and can't both win the slot.
func (s *HallStorage) HallBookingCreate(ctx context.Context, booking *models.HallBooking) (int64, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var hall models.Hall
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&hall, "id = ?", booking.HallID).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return models.ErrHallNotFound
			}
			return err
		}

		// [start, end) intervals overlap when each starts before the other ends.
		var overlapping int64
		err = tx.Model(&models.HallBooking{}).
			Where("hall_id = ? AND date = ? AND time_start < ? AND time_end > ?",
				booking.HallID, booking.Date, booking.TimeEnd, booking.TimeStart).
			Count(&overlapping).Error
		if err != nil {
			return err
		}
		if overlapping > 0 {
			return models.ErrHallBookingTaken
		}

		return tx.Create(booking).Error
	})
	if err != nil {
		return 0, err
	}
	return booking.ID, nil
}

func (s *HallStorage) HallBookingDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.HallBooking{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrHallBookingNotFound
	}
	return nil
}
