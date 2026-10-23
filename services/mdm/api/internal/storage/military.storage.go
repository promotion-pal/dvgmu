package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type MilitaryStorage struct {
	db *gorm.DB
}

func MilitaryStorageNew(db *gorm.DB) *MilitaryStorage {
	return &MilitaryStorage{db: db}
}

func (s *MilitaryStorage) MilitaryCreate(ctx context.Context, military *models.Military) (int64, error) {
	if err := s.db.WithContext(ctx).Create(military).Error; err != nil {
		return 0, err
	}
	return military.ID, nil
}
