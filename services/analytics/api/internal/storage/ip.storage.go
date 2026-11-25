package storage

import (
	"context"
	"errors"
	"log/slog"

	"gorm.io/gorm"

	"dvgmu/analytics/internal/domain/models"
)

type IPStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func IPStorageNew(db *gorm.DB, log *slog.Logger) *IPStorage {
	return &IPStorage{db: db, log: log}
}

// Last возвращает последнюю оценку с указанного IP по анкете.
// Если записей нет — (nil, nil).
func (s *IPStorage) Last(ctx context.Context, analyticID int64, ip string) (*models.AnalyticIP, error) {
	var rec models.AnalyticIP
	err := s.db.WithContext(ctx).
		Where("analytic_id = ? AND ip = ?", analyticID, ip).
		Order("created_at DESC").
		First(&rec).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		s.log.Error("failed to fetch last analytic ip", "analytic_id", analyticID, "error", err.Error())
		return nil, err
	}
	return &rec, nil
}

func (s *IPStorage) Create(ctx context.Context, rec *models.AnalyticIP) (int64, error) {
	if err := s.db.WithContext(ctx).Create(rec).Error; err != nil {
		s.log.Error("failed to create analytic ip", "error", err.Error())
		return 0, err
	}
	return rec.ID, nil
}
