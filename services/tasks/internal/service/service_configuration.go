package service

import (
	"context"
	"fmt"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
	entity "fesmu/contract/tasks/entity"
	"google.golang.org/protobuf/encoding/protojson"
)

func (s *CatalogService) GetConfiguration(ctx context.Context, id int64) (storage.ServiceConfiguration, *entity.ServiceFormSchema, error) {
	if id <= 0 {
		return storage.ServiceConfiguration{}, nil, ErrInvalidService
	}
	config, err := s.storage.GetConfiguration(ctx, id)
	if err != nil {
		return config, nil, err
	}
	var schema entity.ServiceFormSchema
	if err := protojson.Unmarshal([]byte(config.Form.Schema), &schema); err != nil {
		return config, nil, fmt.Errorf("decode stored form schema: %w", err)
	}
	return config, &schema, nil
}

func (s *CatalogService) SaveConfiguration(ctx context.Context, entry models.Service, expectedVersion string,
	form *entity.ServiceFormSchema, settings *models.ServiceSettings, routes []models.ServiceRouteRule,
) (int64, error) {
	entry.Code = strings.TrimSpace(entry.Code)
	entry.Name = strings.TrimSpace(entry.Name)
	entry.Description = strings.TrimSpace(entry.Description)
	if !validService(entry) || entry.ID < 0 || (entry.ID == 0) != (expectedVersion == "") {
		return 0, ErrInvalidService
	}
	if form == nil {
		return 0, ErrInvalidServiceForm
	}
	_, schema, err := normalizeServiceForm(form)
	if err != nil {
		return 0, err
	}
	rules, err := normalizeServiceRoutes(routes)
	if err != nil {
		return 0, err
	}
	var defaults models.ServiceSettings
	if settings != nil {
		if settings.InitialStatusID <= 0 || settings.DefaultPriorityID <= 0 {
			return 0, ErrInvalidServiceSettings
		}
		defaults = *settings
	}
	return s.storage.SaveConfiguration(ctx, entry, expectedVersion, schema, defaults, rules)
}
