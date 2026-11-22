package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DirectionStorage struct {
	db *gorm.DB
}

func NewDirectionStorage(db *gorm.DB) *DirectionStorage {
	return &DirectionStorage{db: db}
}

func (s *DirectionStorage) Create(ctx context.Context, direction *models.Direction) error {
	return s.db.WithContext(ctx).Create(direction).Error
}

func (s *DirectionStorage) Get(ctx context.Context, id int64) (models.Direction, error) {
	var direction models.Direction
	err := s.db.WithContext(ctx).First(&direction, id).Error
	return direction, err
}

func (s *DirectionStorage) List(ctx context.Context, afterID int64, limit int) ([]models.Direction, error) {
	var directions []models.Direction
	err := s.db.WithContext(ctx).Where("id > ?", afterID).
		Order("id ASC").Limit(limit).Find(&directions).Error
	return directions, err
}

func (s *DirectionStorage) Update(ctx context.Context, id int64, changes map[string]any) (models.Direction, error) {
	var direction models.Direction
	result := s.db.WithContext(ctx).Model(&direction).Clauses(clause.Returning{}).
		Where("id = ?", id).Updates(changes)
	if result.Error != nil {
		return direction, result.Error
	}
	if result.RowsAffected == 0 {
		return direction, gorm.ErrRecordNotFound
	}
	return direction, nil
}

func (s *DirectionStorage) Delete(ctx context.Context, id int64) (models.Direction, error) {
	var direction models.Direction
	result := s.db.WithContext(ctx).Clauses(clause.Returning{}).Delete(&direction, id)
	if result.Error != nil {
		return direction, result.Error
	}
	if result.RowsAffected == 0 {
		return direction, gorm.ErrRecordNotFound
	}
	return direction, nil
}
