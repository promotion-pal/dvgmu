package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StatusStorage struct {
	db *gorm.DB
}

func NewStatusStorage(db *gorm.DB) *StatusStorage {
	return &StatusStorage{db: db}
}

func (s *StatusStorage) Create(ctx context.Context, status *models.Status) error {
	return s.db.WithContext(ctx).Create(status).Error
}

func (s *StatusStorage) Get(ctx context.Context, id int64) (models.Status, error) {
	var status models.Status
	err := s.db.WithContext(ctx).First(&status, id).Error
	return status, err
}

func (s *StatusStorage) List(ctx context.Context, after *models.StatusCursor, active *bool, limit int) ([]models.Status, error) {
	var statuses []models.Status
	query := s.db.WithContext(ctx)
	if after != nil {
		query = query.Where("(sort_order, id) > (?, ?)", after.SortOrder, after.ID)
	}
	if active != nil {
		query = query.Where("active = ?", *active)
	}
	err := query.Order("sort_order ASC, id ASC").Limit(limit).Find(&statuses).Error
	return statuses, err
}

func (s *StatusStorage) Update(ctx context.Context, id int64, changes map[string]any) (models.Status, error) {
	var status models.Status
	result := s.db.WithContext(ctx).Model(&status).Clauses(clause.Returning{}).
		Where("id = ?", id).Updates(changes)
	if result.Error != nil {
		return status, result.Error
	}
	if result.RowsAffected == 0 {
		return status, gorm.ErrRecordNotFound
	}
	return status, nil
}

func (s *StatusStorage) Delete(ctx context.Context, id int64) (models.Status, error) {
	var status models.Status
	result := s.db.WithContext(ctx).Clauses(clause.Returning{}).Delete(&status, id)
	if result.Error != nil {
		return status, result.Error
	}
	if result.RowsAffected == 0 {
		return status, gorm.ErrRecordNotFound
	}
	return status, nil
}
