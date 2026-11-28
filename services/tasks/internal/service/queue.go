package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidQueue = errors.New("invalid queue")

type QueueService struct {
	storage *storage.QueueStorage
}

func NewQueueService(storage *storage.QueueStorage) *QueueService {
	return &QueueService{storage: storage}
}

func (s *QueueService) Create(ctx context.Context, code, name string) (models.Queue, error) {
	queue := models.Queue{Code: strings.TrimSpace(code), Name: strings.TrimSpace(name), Active: true}
	if !catalogCodePattern.MatchString(queue.Code) || !validCatalogName(queue.Name) {
		return models.Queue{}, fmt.Errorf("%w: provide a valid code and name", ErrInvalidQueue)
	}
	err := s.storage.Create(ctx, &queue)
	return queue, err
}

func (s *QueueService) Get(ctx context.Context, code string) (models.Queue, error) {
	code = strings.TrimSpace(code)
	if !catalogCodePattern.MatchString(code) {
		return models.Queue{}, fmt.Errorf("%w: provide a valid code", ErrInvalidQueue)
	}
	return s.storage.Get(ctx, code)
}

func (s *QueueService) List(ctx context.Context, afterCode string, active *bool, pageSize int32) ([]models.Queue, string, error) {
	if (afterCode != "" && !catalogCodePattern.MatchString(afterCode)) || pageSize < 0 || pageSize > 100 {
		return nil, "", fmt.Errorf("%w: provide a valid after_code and page_size", ErrInvalidQueue)
	}
	if pageSize == 0 {
		pageSize = 50
	}
	queues, err := s.storage.List(ctx, afterCode, active, int(pageSize)+1)
	if err != nil {
		return nil, "", err
	}
	if len(queues) > int(pageSize) {
		return queues[:pageSize], queues[pageSize-1].Code, nil
	}
	return queues, "", nil
}

func (s *QueueService) Update(ctx context.Context, code string, name *string, active *bool) (models.Queue, error) {
	code = strings.TrimSpace(code)
	if !catalogCodePattern.MatchString(code) {
		return models.Queue{}, fmt.Errorf("%w: provide a valid code", ErrInvalidQueue)
	}
	changes := make(map[string]any)
	if name != nil {
		normalizedName := strings.TrimSpace(*name)
		if !validCatalogName(normalizedName) {
			return models.Queue{}, fmt.Errorf("%w: provide a valid name", ErrInvalidQueue)
		}
		changes["name"] = normalizedName
	}
	if active != nil {
		changes["active"] = *active
	}
	if len(changes) == 0 {
		return models.Queue{}, fmt.Errorf("%w: provide a name or active state to update", ErrInvalidQueue)
	}
	return s.storage.Update(ctx, code, changes)
}
