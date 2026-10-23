package storage

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"gorm.io/gorm"

	"dvgmu/analytics/internal/domain/models"
)

type AnalyticStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func AnalyticStorageNew(db *gorm.DB, log *slog.Logger) *AnalyticStorage {
	return &AnalyticStorage{
		db:  db,
		log: log,
	}
}

func (s *AnalyticStorage) AnalyticCreate(ctx context.Context, analytic *models.Analytic) (int64, error) {
	if err := s.db.WithContext(ctx).Create(analytic).Error; err != nil {
		s.log.Error("failed to create analytic", "error", err.Error())
		return 0, err
	}
	return analytic.ID, nil
}

func (s *AnalyticStorage) AnalyticByID(ctx context.Context, id int64) (*models.Analytic, error) {
	var analytic models.Analytic
	if err := s.db.WithContext(ctx).Preload("Ratings").First(&analytic, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch analytic by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &analytic, nil
}

func (s *AnalyticStorage) AnalyticFetch(
	ctx context.Context,
	name *string,
	analyticType *int32,
	startDate, endDate *time.Time,
	qr *int64,
) ([]models.Analytic, error) {
	query := s.db.WithContext(ctx).Preload("Ratings").Order("qr").Order("id")

	if name != nil && *name != "" {
		query = query.Where("name ILIKE ?", "%"+*name+"%")
	}
	if analyticType != nil {
		query = query.Where("type = ?", *analyticType)
	}
	if qr != nil {
		query = query.Where("qr = ?", *qr)
	}
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	var analytics []models.Analytic
	if err := query.Find(&analytics).Error; err != nil {
		s.log.Error("failed to fetch analytics", "error", err.Error())
		return nil, err
	}
	return analytics, nil
}

func (s *AnalyticStorage) AnalyticRatingCreate(ctx context.Context, rating *models.AnalyticRating) (int64, error) {
	if err := s.db.WithContext(ctx).Create(rating).Error; err != nil {
		s.log.Error("failed to create analytic rating", "error", err.Error())
		return 0, err
	}
	return rating.ID, nil
}

// AnalyticUpdate меняет переданные поля в одной транзакции с проверкой, что
// новый номер QR не занят другим объектом. nil, nil — объекта нет.
func (s *AnalyticStorage) AnalyticUpdate(ctx context.Context, id int64, patch models.AnalyticPatch) (*models.Analytic, error) {
	var out *models.Analytic
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var analytic models.Analytic
		if err := tx.First(&analytic, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		updates := map[string]any{}
		if patch.Name != nil {
			updates["name"] = *patch.Name
		}
		if patch.Transcript != nil {
			updates["transcript"] = *patch.Transcript
		}
		if patch.Type != nil {
			updates["type"] = *patch.Type
		}
		if patch.QR != nil && *patch.QR != analytic.QR {
			var taken int64
			if err := tx.Model(&models.Analytic{}).Where("qr = ? AND id <> ?", *patch.QR, id).Count(&taken).Error; err != nil {
				return err
			}
			if taken > 0 {
				return models.ErrQRTaken
			}
			updates["qr"] = *patch.QR
		}
		if len(updates) > 0 {
			if err := tx.Model(&analytic).Updates(updates).Error; err != nil {
				return err
			}
		}
		out = &analytic
		return nil
	})
	if err != nil && !errors.Is(err, models.ErrQRTaken) {
		s.log.Error("failed to update analytic", "id", id, "error", err.Error())
	}
	return out, err
}
