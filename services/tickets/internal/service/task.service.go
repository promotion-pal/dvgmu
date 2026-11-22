package service

import (
	"context"
	"strings"

	"dvgmu/tickets/internal/domain/models"
	"dvgmu/tickets/internal/storage"
	enum "fesmu/contract/mdm/enum"
)

type PermissionChecker interface {
	CheckPermission(context.Context, int64, enum.UserPermission) error
}

type TaskService struct {
	storage     *storage.TaskStorage
	permissions PermissionChecker
}

func NewTaskService(storage *storage.TaskStorage, permissions PermissionChecker) *TaskService {
	return &TaskService{storage: storage, permissions: permissions}
}

func (s *TaskService) Create(ctx context.Context, userID int64, title string) (*models.Task, error) {
	if err := s.permissions.CheckPermission(ctx, userID, enum.UserPermission_USER_TASK_CREATE); err != nil {
		return nil, err
	}
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

func (s *TaskService) Fetch(ctx context.Context, userID int64) ([]models.Task, error) {
	if err := s.permissions.CheckPermission(ctx, userID, enum.UserPermission_USER_TASK_READ); err != nil {
		return nil, err
	}
	return s.storage.Fetch(ctx)
}
