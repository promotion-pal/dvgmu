package service

import (
	"context"
	"strings"

	"dvgmu/tickets/internal/domain/models"
	"dvgmu/tickets/internal/storage"
)

type TaskService struct {
	storage *storage.TaskStorage
}

func NewTaskService(storage *storage.TaskStorage) *TaskService {
	return &TaskService{storage: storage}
}

func (s *TaskService) Create(ctx context.Context, title string) (*models.Task, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, models.ErrTitleRequired
	}
	task := &models.Task{Title: title}
	if err := s.storage.Create(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

func (s *TaskService) Fetch(ctx context.Context) ([]models.Task, error) {
	return s.storage.Fetch(ctx)
}
