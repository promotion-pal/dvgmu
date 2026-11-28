package storage

import (
	"context"
	"errors"
	"fmt"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrServiceRoutesVersionConflict = errors.New("service routes version changed")
	ErrServiceRouteQueueUnavailable = errors.New("route queue unavailable")
)

type ServiceRoutesStorage struct {
	db *gorm.DB
}

func NewServiceRoutesStorage(db *gorm.DB) *ServiceRoutesStorage {
	return &ServiceRoutesStorage{db: db}
}

func (s *ServiceRoutesStorage) Get(ctx context.Context, serviceID int64) (models.ServiceRoutes, error) {
	return readServiceRoutes(s.db.WithContext(ctx), serviceID)
}

func readServiceRoutes(db *gorm.DB, serviceID int64) (models.ServiceRoutes, error) {
	var routes models.ServiceRoutes
	err := db.Table("services").
		Select("services.id AS service_id, COALESCE(routes.version, 0) AS version, COALESCE(routes.rules, '[]'::jsonb) AS rules").
		Joins("LEFT JOIN service_routes AS routes ON routes.service_id = services.id").
		Where("services.id = ?", serviceID).Take(&routes).Error
	return routes, err
}

func (s *ServiceRoutesStorage) Replace(ctx context.Context, routes models.ServiceRoutes, expectedVersion int64) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var service models.Service
		if err := tx.Select("id").Clauses(clause.Locking{Strength: "NO KEY UPDATE"}).Take(&service, routes.ServiceID).Error; err != nil {
			return err
		}
		current, err := readServiceRoutes(tx, routes.ServiceID)
		if err != nil {
			return err
		}
		if current.Version != expectedVersion {
			return ErrServiceRoutesVersionConflict
		}
		return writeServiceRoutes(tx, routes)
	})
}

func writeServiceRoutes(tx *gorm.DB, routes models.ServiceRoutes) error {
	codes := make([]string, 0, len(routes.Rules))
	for _, rule := range routes.Rules {
		if rule.Active {
			codes = append(codes, rule.QueueID)
		}
	}
	if len(codes) > 0 {
		active, err := lockRouteQueues(tx, codes)
		if err != nil {
			return err
		}
		for _, code := range codes {
			enabled, exists := active[code]
			if !exists {
				return fmt.Errorf("%w: queue %q does not exist", ErrServiceRouteQueueUnavailable, code)
			}
			if !enabled {
				return fmt.Errorf("%w: queue %q is inactive", ErrServiceRouteQueueUnavailable, code)
			}
		}
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "service_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"version", "rules"}),
	}).Create(&routes).Error
}
