package storage

import (
	"context"
	"errors"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrInitialStatusUnavailable   = errors.New("initial status must exist and be active")
	ErrDefaultPriorityUnavailable = errors.New("default priority must exist and be active")
)

type ServiceSettingsStorage struct {
	db *gorm.DB
}

func NewServiceSettingsStorage(db *gorm.DB) *ServiceSettingsStorage {
	return &ServiceSettingsStorage{db: db}
}

func (s *ServiceSettingsStorage) Get(ctx context.Context, serviceID int64) (models.ServiceSettings, error) {
	return readServiceSettings(s.db.WithContext(ctx), serviceID)
}

func readServiceSettings(db *gorm.DB, serviceID int64) (models.ServiceSettings, error) {
	var settings models.ServiceSettings
	err := db.Table("services").
		Select("services.id AS service_id, COALESCE(settings.initial_status_id, 0) AS initial_status_id, COALESCE(settings.default_priority_id, 0) AS default_priority_id").
		Joins("LEFT JOIN service_settings AS settings ON settings.service_id = services.id").
		Where("services.id = ?", serviceID).Take(&settings).Error
	return settings, err
}

func (s *ServiceSettingsStorage) Update(ctx context.Context, settings models.ServiceSettings) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var service models.Service
		if err := tx.Select("id").Clauses(clause.Locking{Strength: "NO KEY UPDATE"}).Take(&service, settings.ServiceID).Error; err != nil {
			return err
		}

		return writeServiceSettings(tx, settings)
	})
}

func writeServiceSettings(tx *gorm.DB, settings models.ServiceSettings) error {
	if err := lockActiveTaskDefaults(tx, settings); err != nil {
		return err
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "service_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"initial_status_id", "default_priority_id"}),
	}).Create(&settings).Error
}

// Hold the locks through the write so a selection cannot be deactivated concurrently.
func lockActiveTaskDefaults(tx *gorm.DB, settings models.ServiceSettings) error {
	var status models.Status
	err := tx.Select("id").Clauses(clause.Locking{Strength: "SHARE"}).
		Where("active = ?", true).Take(&status, settings.InitialStatusID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrInitialStatusUnavailable
	}
	if err != nil {
		return err
	}

	var priority models.Priority
	err = tx.Select("id").Clauses(clause.Locking{Strength: "SHARE"}).
		Where("active = ?", true).Take(&priority, settings.DefaultPriorityID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrDefaultPriorityUnavailable
	}
	return err
}
