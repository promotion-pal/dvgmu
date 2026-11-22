package service

import (
	"context"
	"errors"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidService = errors.New("invalid service")

type CatalogService struct {
	storage *storage.ServiceStorage
}

type ServiceUpdate struct {
	DirectionID *int64
	Description *string
	Code        *string
	Name        *string
	SortOrder   *int32
	Active      *bool
}

func NewCatalogService(storage *storage.ServiceStorage) *CatalogService {
	return &CatalogService{storage: storage}
}

func (s *CatalogService) Create(ctx context.Context, directionID int64, code, name, description string, sortOrder int32) (models.Service, error) {
	entry := models.Service{
		DirectionID: directionID,
		Code:        strings.TrimSpace(code),
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
		SortOrder:   sortOrder,
		Active:      true,
	}
	if directionID <= 0 || !catalogCodePattern.MatchString(entry.Code) || !validCatalogName(entry.Name) || strings.ContainsRune(entry.Description, 0) {
		return models.Service{}, ErrInvalidService
	}
	err := s.storage.Create(ctx, &entry)
	return entry, err
}

func (s *CatalogService) Get(ctx context.Context, id int64) (models.Service, error) {
	if id <= 0 {
		return models.Service{}, ErrInvalidService
	}
	return s.storage.Get(ctx, id)
}

func (s *CatalogService) List(ctx context.Context, directionID *int64, afterID int64, pageSize int32) ([]models.Service, int64, error) {
	if (directionID != nil && *directionID <= 0) || afterID < 0 || pageSize < 0 || pageSize > 100 {
		return nil, 0, ErrInvalidService
	}
	if pageSize == 0 {
		pageSize = 50
	}
	entries, err := s.storage.List(ctx, directionID, afterID, int(pageSize)+1)
	if err != nil {
		return nil, 0, err
	}
	if len(entries) > int(pageSize) {
		return entries[:pageSize], entries[pageSize-1].ID, nil
	}
	return entries, 0, nil
}

func (s *CatalogService) Update(ctx context.Context, id int64, update ServiceUpdate) (models.Service, error) {
	if id <= 0 {
		return models.Service{}, ErrInvalidService
	}
	changes := make(map[string]any)
	if update.DirectionID != nil {
		if *update.DirectionID <= 0 {
			return models.Service{}, ErrInvalidService
		}
		changes["direction_id"] = *update.DirectionID
	}
	if update.Description != nil {
		description := strings.TrimSpace(*update.Description)
		if strings.ContainsRune(description, 0) {
			return models.Service{}, ErrInvalidService
		}
		changes["description"] = description
	}
	if update.Code != nil {
		code := strings.TrimSpace(*update.Code)
		if !catalogCodePattern.MatchString(code) {
			return models.Service{}, ErrInvalidService
		}
		changes["code"] = code
	}
	if update.Name != nil {
		name := strings.TrimSpace(*update.Name)
		if !validCatalogName(name) {
			return models.Service{}, ErrInvalidService
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
		return models.Service{}, ErrInvalidService
	}
	return s.storage.Update(ctx, id, changes)
}

func (s *CatalogService) Delete(ctx context.Context, id int64) (models.Service, error) {
	if id <= 0 {
		return models.Service{}, ErrInvalidService
	}
	return s.storage.Delete(ctx, id)
}
