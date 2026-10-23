package storage

import (
	"context"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type ComputerClassStorage struct {
	db *gorm.DB
}

func ComputerClassStorageNew(db *gorm.DB) *ComputerClassStorage {
	return &ComputerClassStorage{db: db}
}

func (s *ComputerClassStorage) ComputerClassSessionFetch(ctx context.Context, filter models.ComputerClassSessionFilter) ([]*models.ComputerClassSession, error) {
	q := s.db.WithContext(ctx).Model(&models.ComputerClassSession{})
	if filter.Room != "" {
		q = q.Where("room = ?", filter.Room)
	}
	// Dates are stored as ISO strings, so they compare correctly as text.
	if filter.DateFrom != "" {
		q = q.Where("date >= ?", filter.DateFrom)
	}
	if filter.DateTo != "" {
		q = q.Where("date <= ?", filter.DateTo)
	}
	if filter.Kind != 0 {
		q = q.Where("kind = ?", filter.Kind)
	}

	var records []*models.ComputerClassSession
	if err := q.Order("date, time_start, room").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// ComputerClassSessionCreate saves a session. Overlaps with other sessions of
// the room are allowed: the timetable shows them for staff to resolve.
func (s *ComputerClassStorage) ComputerClassSessionCreate(ctx context.Context, session *models.ComputerClassSession) (int64, error) {
	if err := s.db.WithContext(ctx).Create(session).Error; err != nil {
		return 0, err
	}
	return session.ID, nil
}

func (s *ComputerClassStorage) ComputerClassSessionUpdate(ctx context.Context, session *models.ComputerClassSession) error {
	res := s.db.WithContext(ctx).Model(&models.ComputerClassSession{}).Where("id = ?", session.ID).
		Select("date", "time_start", "time_end", "room", "kind", "title", "groups", "note", "updated_at").
		Updates(session)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrComputerClassSessionNotFound
	}
	return nil
}

func (s *ComputerClassStorage) ComputerClassSessionDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.ComputerClassSession{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrComputerClassSessionNotFound
	}
	return nil
}
