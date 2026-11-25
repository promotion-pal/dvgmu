package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
)

var ErrInvalidServiceRoutes = errors.New("invalid service routes")

type ServiceRoutesService struct {
	storage *storage.ServiceRoutesStorage
}

func NewServiceRoutesService(storage *storage.ServiceRoutesStorage) *ServiceRoutesService {
	return &ServiceRoutesService{storage: storage}
}

func (s *ServiceRoutesService) Get(ctx context.Context, serviceID int64) (models.ServiceRoutes, error) {
	if serviceID <= 0 {
		return models.ServiceRoutes{}, fmt.Errorf("%w: service_id must be positive", ErrInvalidServiceRoutes)
	}
	return s.storage.Get(ctx, serviceID)
}

func (s *ServiceRoutesService) Update(ctx context.Context, serviceID, expectedVersion int64, rules []models.ServiceRouteRule) (models.ServiceRoutes, error) {
	if serviceID <= 0 || expectedVersion < 0 || expectedVersion == math.MaxInt64 {
		return models.ServiceRoutes{}, fmt.Errorf("%w: provide a positive service_id and valid expected_version", ErrInvalidServiceRoutes)
	}
	normalized, err := normalizeServiceRoutes(rules)
	if err != nil {
		return models.ServiceRoutes{}, err
	}
	routes := models.ServiceRoutes{
		ServiceID: serviceID,
		Version:   expectedVersion + 1,
		Rules:     normalized,
	}
	return routes, s.storage.Replace(ctx, routes, expectedVersion)
}

func normalizeServiceRoutes(rules []models.ServiceRouteRule) ([]models.ServiceRouteRule, error) {
	normalized := make([]models.ServiceRouteRule, 0, len(rules))
	type routeKey struct {
		departmentID string
		queueID      string
	}
	seen := make(map[routeKey]struct{}, len(rules))
	for i, rule := range rules {
		rule.ApplicantDepartmentID = strings.TrimSpace(rule.ApplicantDepartmentID)
		rule.QueueID = strings.TrimSpace(rule.QueueID)
		if rule.QueueID == "" || strings.ContainsRune(rule.QueueID, 0) || strings.ContainsRune(rule.ApplicantDepartmentID, 0) {
			return nil, fmt.Errorf("%w: rule %d needs a valid queue ID", ErrInvalidServiceRoutes, i+1)
		}
		key := routeKey{departmentID: rule.ApplicantDepartmentID, queueID: rule.QueueID}
		if _, duplicate := seen[key]; duplicate {
			return nil, fmt.Errorf("%w: duplicate rule at position %d", ErrInvalidServiceRoutes, i+1)
		}
		seen[key] = struct{}{}
		normalized = append(normalized, rule)
	}
	return normalized, nil
}
