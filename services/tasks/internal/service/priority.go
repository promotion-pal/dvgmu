package service

import (
	"context"
	"errors"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidPriority = errors.New("invalid priority")

type PriorityService struct {
	storage *storage.PriorityStorage
}

type PriorityUpdate struct {
	Code      *string
	Name      *string
	SortOrder *int32
	Active    *bool
}

func NewPriorityService(storage *storage.PriorityStorage) *PriorityService {
	return &PriorityService{storage: storage}
}

func (s *PriorityService) Create(ctx context.Context, code, name string, sortOrder int32) (models.Priority, error) {
	priority := models.Priority{Code: strings.TrimSpace(code), Name: strings.TrimSpace(name), SortOrder: sortOrder, Active: true}
	if !catalogCodePattern.MatchString(priority.Code) || !validCatalogName(priority.Name) {
		return models.Priority{}, ErrInvalidPriority
	}
	err := s.storage.Create(ctx, &priority)
	return priority, err
}

func (s *PriorityService) Get(ctx context.Context, id int64) (models.Priority, error) {
	if id <= 0 {
		return models.Priority{}, ErrInvalidPriority
	}
	return s.storage.Get(ctx, id)
}

func (s *PriorityService) List(ctx context.Context, after *models.PriorityCursor, active *bool, pageSize int32) ([]models.Priority, *models.PriorityCursor, error) {
	if (after != nil && after.ID <= 0) || pageSize < 0 || pageSize > 100 {
		return nil, nil, ErrInvalidPriority
	}
	if pageSize == 0 {
		pageSize = 50
	}
	priorities, err := s.storage.List(ctx, after, active, int(pageSize)+1)
	if err != nil {
		return nil, nil, err
	}
	if len(priorities) > int(pageSize) {
		last := priorities[pageSize-1]
		return priorities[:pageSize], &models.PriorityCursor{SortOrder: last.SortOrder, ID: last.ID}, nil
	}
	return priorities, nil, nil
}

func (s *PriorityService) Update(ctx context.Context, id int64, update PriorityUpdate) (models.Priority, error) {
	if id <= 0 {
		return models.Priority{}, ErrInvalidPriority
	}
	changes := make(map[string]any)
	if update.Code != nil {
		code := strings.TrimSpace(*update.Code)
		if !catalogCodePattern.MatchString(code) {
			return models.Priority{}, ErrInvalidPriority
		}
		changes["code"] = code
	}
	if update.Name != nil {
		name := strings.TrimSpace(*update.Name)
		if !validCatalogName(name) {
			return models.Priority{}, ErrInvalidPriority
		}
		changes["name"] = name
	}
	if update.SortOrder != nil {
		changes["sort_order"] = *update.SortOrder
	}
	if update.Active != nil {
		changes["active"] = *update.Active
	}
	if len(changes) == 0 {
		return models.Priority{}, ErrInvalidPriority
	}
	return s.storage.Update(ctx, id, changes)
}

func (s *PriorityService) Delete(ctx context.Context, id int64) (models.Priority, error) {
	if id <= 0 {
		return models.Priority{}, ErrInvalidPriority
	}
	return s.storage.Delete(ctx, id)
}
