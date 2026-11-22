package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ServiceStorage struct {
	db *gorm.DB
}

func NewServiceStorage(db *gorm.DB) *ServiceStorage {
	return &ServiceStorage{db: db}
}

func (s *ServiceStorage) Create(ctx context.Context, service *models.Service) error {
	return s.db.WithContext(ctx).Create(service).Error
}

func (s *ServiceStorage) Get(ctx context.Context, id int64) (models.Service, error) {
	var service models.Service
	err := s.db.WithContext(ctx).First(&service, id).Error
	return service, err
}

func (s *ServiceStorage) List(ctx context.Context, directionID *int64, afterID int64, limit int) ([]models.Service, error) {
	var services []models.Service
	query := s.db.WithContext(ctx).Where("id > ?", afterID)
	if directionID != nil {
		query = query.Where("direction_id = ?", *directionID)
	}
	err := query.
		Order("id ASC").Limit(limit).Find(&services).Error
	return services, err
}

func (s *ServiceStorage) Update(ctx context.Context, id int64, changes map[string]any) (models.Service, error) {
	var service models.Service
	result := s.db.WithContext(ctx).Model(&service).Clauses(clause.Returning{}).
		Where("id = ?", id).Updates(changes)
	if result.Error != nil {
		return service, result.Error
	}
	if result.RowsAffected == 0 {
		return service, gorm.ErrRecordNotFound
	}
	return service, nil
}

func (s *ServiceStorage) Delete(ctx context.Context, id int64) (models.Service, error) {
	var service models.Service
	result := s.db.WithContext(ctx).Clauses(clause.Returning{}).Delete(&service, id)
	if result.Error != nil {
		return service, result.Error
	}
	if result.RowsAffected == 0 {
		return service, gorm.ErrRecordNotFound
	}
	return service, nil
}
