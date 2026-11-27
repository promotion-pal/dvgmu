package storage

import (
	"context"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type ScheduleCollectStorage struct {
	db *gorm.DB
}

func ScheduleCollectStorageNew(db *gorm.DB) *ScheduleCollectStorage {
	return &ScheduleCollectStorage{db: db}
}

func (s *ScheduleCollectStorage) ScheduleCollectCreate(ctx context.Context, entry *models.ScheduleCollect) (string, error) {
	if err := s.db.WithContext(ctx).Create(entry).Error; err != nil {
		return "", err
	}
	return entry.ID, nil
}

func (s *ScheduleCollectStorage) ScheduleCollectFetch(ctx context.Context, offset, limit int) ([]models.ScheduleCollect, error) {
	var entries []models.ScheduleCollect
	err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Offset(offset).Limit(limit).Find(&entries).Error
	return entries, err
}
