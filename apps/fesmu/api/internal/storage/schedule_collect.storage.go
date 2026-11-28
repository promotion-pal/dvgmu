package storage

import (
	"context"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

func (s *ScheduleCollectStorage) ScheduleCollectBatchCreate(ctx context.Context, batch models.ScheduleCollectBatch, entries []models.ScheduleCollect) ([]models.ScheduleCollect, error) {
	var stored []models.ScheduleCollect
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		insert := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "id"}}, DoNothing: true}).Create(&batch)
		if insert.Error != nil {
			return insert.Error
		}
		if insert.RowsAffected == 1 {
			if err := tx.Create(&entries).Error; err != nil {
				return err
			}
		} else {
			var existing models.ScheduleCollectBatch
			if err := tx.First(&existing, "id = ?", batch.ID).Error; err != nil {
				return err
			}
			if existing.AuthorUUID != batch.AuthorUUID || existing.PayloadHash != batch.PayloadHash {
				return models.ErrScheduleCollectBatchConflict
			}
		}
		return tx.Where("batch_id = ?", batch.ID).Order("batch_row").Find(&stored).Error
	})
	return stored, err
}
func (s *ScheduleCollectStorage) ScheduleCollectFetch(ctx context.Context, offset, limit int) ([]models.ScheduleCollect, error) {
	var entries []models.ScheduleCollect
	err := s.db.WithContext(ctx).Order("created_at DESC, COALESCE(batch_id::text, id) DESC, batch_row ASC").Offset(offset).Limit(limit).Find(&entries).Error
	return entries, err
}
