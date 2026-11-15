package storage

import (
	"context"
	"fmt"

	"dvgmu/tickets/internal/domain/models"
	"gorm.io/gorm"
)

type TaskStorage struct {
	db *gorm.DB
}

func NewTaskStorage(db *gorm.DB) *TaskStorage {
	return &TaskStorage{db: db}
}

func (s *TaskStorage) Create(ctx context.Context, task *models.Task) error {
	if err := s.db.WithContext(ctx).Create(task).Error; err != nil {
		return fmt.Errorf("create task: %w", err)
	}
	return nil
}

func (s *TaskStorage) Fetch(ctx context.Context) ([]models.Task, error) {
	var tasks []models.Task
	if err := s.db.WithContext(ctx).Order("id DESC").Find(&tasks).Error; err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	return tasks, nil
}
