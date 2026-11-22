package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidDirection = errors.New("invalid direction")

var catalogCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

type DirectionService struct {
	storage *storage.DirectionStorage
}

type DirectionUpdate struct {
	Code      *string
	Name      *string
	SortOrder *int32
	Active    *bool
}

func NewDirectionService(storage *storage.DirectionStorage) *DirectionService {
	return &DirectionService{storage: storage}
}

func (s *DirectionService) Create(ctx context.Context, code, name string, sortOrder int32) (models.Direction, error) {
	direction := models.Direction{Code: strings.TrimSpace(code), Name: strings.TrimSpace(name), SortOrder: sortOrder, Active: true}
	if !catalogCodePattern.MatchString(direction.Code) || !validCatalogName(direction.Name) {
		return models.Direction{}, ErrInvalidDirection
	}
	err := s.storage.Create(ctx, &direction)
	return direction, err
}

func (s *DirectionService) Get(ctx context.Context, id int64) (models.Direction, error) {
	if id <= 0 {
		return models.Direction{}, ErrInvalidDirection
	}
	return s.storage.Get(ctx, id)
}

func (s *DirectionService) List(ctx context.Context, afterID int64, pageSize int32) ([]models.Direction, int64, error) {
	if afterID < 0 || pageSize < 0 || pageSize > 100 {
		return nil, 0, ErrInvalidDirection
	}
	if pageSize == 0 {
		pageSize = 50
	}
	directions, err := s.storage.List(ctx, afterID, int(pageSize)+1)
	if err != nil {
		return nil, 0, err
	}
	if len(directions) > int(pageSize) {
		return directions[:pageSize], directions[pageSize-1].ID, nil
	}
	return directions, 0, nil
}

func (s *DirectionService) Update(ctx context.Context, id int64, update DirectionUpdate) (models.Direction, error) {
	if id <= 0 {
		return models.Direction{}, ErrInvalidDirection
	}
	changes := make(map[string]any)
	if update.Code != nil {
		code := strings.TrimSpace(*update.Code)
		if !catalogCodePattern.MatchString(code) {
			return models.Direction{}, ErrInvalidDirection
		}
		changes["code"] = code
	}
	if update.Name != nil {
		name := strings.TrimSpace(*update.Name)
		if !validCatalogName(name) {
			return models.Direction{}, ErrInvalidDirection
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
		return models.Direction{}, ErrInvalidDirection
	}
	return s.storage.Update(ctx, id, changes)
}

func (s *DirectionService) Delete(ctx context.Context, id int64) (models.Direction, error) {
	if id <= 0 {
		return models.Direction{}, ErrInvalidDirection
	}
	return s.storage.Delete(ctx, id)
}

func validCatalogName(name string) bool {
	return name != "" && !strings.ContainsRune(name, 0) && utf8.RuneCountInString(name) <= 150
}
