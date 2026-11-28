package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type QueueStorage struct {
	db *gorm.DB
}

func NewQueueStorage(db *gorm.DB) *QueueStorage {
	return &QueueStorage{db: db}
}

func (s *QueueStorage) Create(ctx context.Context, queue *models.Queue) error {
	return s.db.WithContext(ctx).Create(queue).Error
}

func (s *QueueStorage) Get(ctx context.Context, code string) (models.Queue, error) {
	var queue models.Queue
	err := s.db.WithContext(ctx).Take(&queue, "code = ?", code).Error
	return queue, err
}

func (s *QueueStorage) List(ctx context.Context, afterCode string, active *bool, limit int) ([]models.Queue, error) {
	var queues []models.Queue
	query := s.db.WithContext(ctx).Where("code > ?", afterCode)
	if active != nil {
		query = query.Where("active = ?", *active)
	}
	err := query.Order("code ASC").Limit(limit).Find(&queues).Error
	return queues, err
}

func (s *QueueStorage) Update(ctx context.Context, code string, changes map[string]any) (models.Queue, error) {
	var queue models.Queue
	result := s.db.WithContext(ctx).Model(&queue).Clauses(clause.Returning{}).
		Where("code = ?", code).Updates(changes)
	if result.Error != nil {
		return queue, result.Error
	}
	if result.RowsAffected == 0 {
		return queue, gorm.ErrRecordNotFound
	}
	return queue, nil
}
