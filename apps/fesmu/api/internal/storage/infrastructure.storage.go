package storage

import (
	"context"
	"errors"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type InfrastructureStorage struct {
	db *gorm.DB
}

func InfrastructureStorageNew(db *gorm.DB) *InfrastructureStorage {
	return &InfrastructureStorage{db: db}
}

func (s *InfrastructureStorage) InfrastructureFetch(ctx context.Context) ([]*models.Infrastructure, error) {
	var records []*models.Infrastructure

	if err := s.db.WithContext(ctx).Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

func (s *InfrastructureStorage) InfrastructureByID(ctx context.Context, id int64) (*models.Infrastructure, error) {
	var record models.Infrastructure

	err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrInfrastructureNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *InfrastructureStorage) InfrastructureCreate(ctx context.Context, infrastructure *models.Infrastructure) (int64, error) {
	if err := s.db.WithContext(ctx).Create(infrastructure).Error; err != nil {
		return 0, err
	}
	return infrastructure.ID, nil
}

func (s *InfrastructureStorage) InfrastructureUpdate(ctx context.Context, infrastructure *models.Infrastructure) error {
	res := s.db.WithContext(ctx).Model(&models.Infrastructure{}).Where("id = ?", infrastructure.ID).Updates(infrastructure)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrInfrastructureNotFound
	}
	return nil
}

func (s *InfrastructureStorage) InfrastructureDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.Infrastructure{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrInfrastructureNotFound
	}
	return nil
}
