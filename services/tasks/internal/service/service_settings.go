package service

import (
	"context"
	"errors"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidServiceSettings = errors.New("provide positive service, status and priority IDs")

type ServiceSettingsService struct {
	storage *storage.ServiceSettingsStorage
}

func NewServiceSettingsService(storage *storage.ServiceSettingsStorage) *ServiceSettingsService {
	return &ServiceSettingsService{storage: storage}
}

func (s *ServiceSettingsService) Get(ctx context.Context, serviceID int64) (models.ServiceSettings, error) {
	if serviceID <= 0 {
		return models.ServiceSettings{}, ErrInvalidServiceSettings
	}
	return s.storage.Get(ctx, serviceID)
}

func (s *ServiceSettingsService) Update(ctx context.Context, settings models.ServiceSettings) error {
	if settings.ServiceID <= 0 || settings.InitialStatusID <= 0 || settings.DefaultPriorityID <= 0 {
		return ErrInvalidServiceSettings
	}
	return s.storage.Update(ctx, settings)
}
