package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PriorityStorage struct {
	db *gorm.DB
}

func NewPriorityStorage(db *gorm.DB) *PriorityStorage {
	return &PriorityStorage{db: db}
}

func (s *PriorityStorage) Create(ctx context.Context, priority *models.Priority) error {
	return s.db.WithContext(ctx).Create(priority).Error
}

func (s *PriorityStorage) Get(ctx context.Context, id int64) (models.Priority, error) {
	var priority models.Priority
	err := s.db.WithContext(ctx).First(&priority, id).Error
	return priority, err
}

func (s *PriorityStorage) List(ctx context.Context, after *models.PriorityCursor, active *bool, limit int) ([]models.Priority, error) {
	var priorities []models.Priority
	query := s.db.WithContext(ctx)
	if after != nil {
		query = query.Where("(sort_order, id) > (?, ?)", after.SortOrder, after.ID)
	}
	if active != nil {
		query = query.Where("active = ?", *active)
	}
	err := query.Order("sort_order ASC, id ASC").Limit(limit).Find(&priorities).Error
	return priorities, err
}

func (s *PriorityStorage) Update(ctx context.Context, id int64, changes map[string]any) (models.Priority, error) {
	var priority models.Priority
	result := s.db.WithContext(ctx).Model(&priority).Clauses(clause.Returning{}).
		Where("id = ?", id).Updates(changes)
	if result.Error != nil {
		return priority, result.Error
	}
	if result.RowsAffected == 0 {
		return priority, gorm.ErrRecordNotFound
	}
	return priority, nil
}

func (s *PriorityStorage) Delete(ctx context.Context, id int64) (models.Priority, error) {
	var priority models.Priority
	result := s.db.WithContext(ctx).Clauses(clause.Returning{}).Delete(&priority, id)
	if result.Error != nil {
		return priority, result.Error
	}
	if result.RowsAffected == 0 {
		return priority, gorm.ErrRecordNotFound
	}
	return priority, nil
}
