package service

import (
	"context"
	"errors"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidStatus = errors.New("invalid status")

type StatusService struct {
	storage *storage.StatusStorage
}

type StatusUpdate struct {
	Code      *string
	Name      *string
	SortOrder *int32
	Active    *bool
	Terminal  *bool
}

func NewStatusService(storage *storage.StatusStorage) *StatusService {
	return &StatusService{storage: storage}
}

func (s *StatusService) Create(ctx context.Context, code, name string, sortOrder int32, terminal bool) (models.Status, error) {
	status := models.Status{Code: strings.TrimSpace(code), Name: strings.TrimSpace(name), SortOrder: sortOrder, Active: true, Terminal: terminal}
	if !catalogCodePattern.MatchString(status.Code) || !validCatalogName(status.Name) {
		return models.Status{}, ErrInvalidStatus
	}
	err := s.storage.Create(ctx, &status)
	return status, err
}

func (s *StatusService) Get(ctx context.Context, id int64) (models.Status, error) {
	if id <= 0 {
		return models.Status{}, ErrInvalidStatus
	}
	return s.storage.Get(ctx, id)
}

func (s *StatusService) List(ctx context.Context, after *models.StatusCursor, active *bool, pageSize int32) ([]models.Status, *models.StatusCursor, error) {
	if (after != nil && after.ID <= 0) || pageSize < 0 || pageSize > 100 {
		return nil, nil, ErrInvalidStatus
	}
	if pageSize == 0 {
		pageSize = 50
	}
	statuses, err := s.storage.List(ctx, after, active, int(pageSize)+1)
	if err != nil {
		return nil, nil, err
	}
	if len(statuses) > int(pageSize) {
		last := statuses[pageSize-1]
		return statuses[:pageSize], &models.StatusCursor{SortOrder: last.SortOrder, ID: last.ID}, nil
	}
	return statuses, nil, nil
}

func (s *StatusService) Update(ctx context.Context, id int64, update StatusUpdate) (models.Status, error) {
	if id <= 0 {
		return models.Status{}, ErrInvalidStatus
	}
	changes := make(map[string]any)
	if update.Code != nil {
		code := strings.TrimSpace(*update.Code)
		if !catalogCodePattern.MatchString(code) {
			return models.Status{}, ErrInvalidStatus
		}
		changes["code"] = code
	}
	if update.Name != nil {
		name := strings.TrimSpace(*update.Name)
		if !validCatalogName(name) {
			return models.Status{}, ErrInvalidStatus
		}
		changes["name"] = name
	}
	if update.SortOrder != nil {
		changes["sort_order"] = *update.SortOrder
	}
	if update.Active != nil {
		changes["active"] = *update.Active
	}
	if update.Terminal != nil {
		changes["terminal"] = *update.Terminal
	}
	if len(changes) == 0 {
		return models.Status{}, ErrInvalidStatus
	}
	return s.storage.Update(ctx, id, changes)
}

func (s *StatusService) Delete(ctx context.Context, id int64) (models.Status, error) {
	if id <= 0 {
		return models.Status{}, ErrInvalidStatus
	}
	return s.storage.Delete(ctx, id)
}
