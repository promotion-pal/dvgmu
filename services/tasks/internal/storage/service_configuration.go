package storage

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"slices"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrServiceConfigurationVersionConflict = errors.New("service configuration version changed")

type ServiceConfiguration struct {
	Entry    models.Service
	Form     models.ServiceFormVersion
	Settings models.ServiceSettings
	Routes   models.ServiceRoutes
}

func (c ServiceConfiguration) Version() string {
	entry := c.Entry
	// The independent form and routing APIs already maintain versions. Include the
	// catalog and defaults values so edits through their APIs are detected as well.
	data := fmt.Sprintf("%d/%d/%q/%q/%q/%d/%t/%d/%d/%d/%d",
		entry.ID, entry.DirectionID, entry.Code, entry.Name, entry.Description, entry.SortOrder, entry.Active,
		c.Form.Version, c.Routes.Version, c.Settings.InitialStatusID, c.Settings.DefaultPriorityID)
	return fmt.Sprintf("%x", sha256.Sum256([]byte(data)))
}

func (s *ServiceStorage) GetConfiguration(ctx context.Context, id int64) (ServiceConfiguration, error) {
	var config ServiceConfiguration
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		config, err = readServiceConfiguration(tx, id, "SHARE")
		return err
	})
	return config, err
}

func readServiceConfiguration(tx *gorm.DB, id int64, lock string) (ServiceConfiguration, error) {
	var config ServiceConfiguration
	if err := tx.Clauses(clause.Locking{Strength: lock}).Take(&config.Entry, id).Error; err != nil {
		return config, err
	}
	var err error
	if config.Form, err = readServiceForm(tx, id); err != nil {
		return config, err
	}
	if config.Settings, err = readServiceSettings(tx, id); err != nil {
		return config, err
	}
	config.Routes, err = readServiceRoutes(tx, id)
	return config, err
}

func (s *ServiceStorage) SaveConfiguration(ctx context.Context, entry models.Service, expectedVersion, schema string,
	settings models.ServiceSettings, rules []models.ServiceRouteRule,
) (int64, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		current := ServiceConfiguration{Form: models.ServiceFormVersion{Schema: "{}"}}
		if entry.ID == 0 {
			// GORM treats false as unset for a field with a true default on insert.
			created := entry
			if err := tx.Create(&created).Error; err != nil {
				return err
			}
			entry.ID = created.ID
			current.Entry = created
		} else {
			var err error
			current, err = readServiceConfiguration(tx, entry.ID, "NO KEY UPDATE")
			if err != nil {
				return err
			}
			if current.Version() != expectedVersion {
				return ErrServiceConfigurationVersionConflict
			}
		}

		if entry != current.Entry {
			if err := tx.Model(&entry).Select("direction_id", "code", "name", "description", "sort_order", "active").
				Updates(&entry).Error; err != nil {
				return err
			}
		}
		if settings.InitialStatusID != 0 &&
			(settings.InitialStatusID != current.Settings.InitialStatusID || settings.DefaultPriorityID != current.Settings.DefaultPriorityID) {
			settings.ServiceID = entry.ID
			if err := writeServiceSettings(tx, settings); err != nil {
				return err
			}
		}
		var sameForm bool
		if err := tx.Raw("SELECT ?::jsonb = ?::jsonb", current.Form.Schema, schema).Scan(&sameForm).Error; err != nil {
			return err
		}
		if !sameForm {
			form := models.ServiceFormVersion{ServiceID: entry.ID, Version: current.Form.Version + 1, Schema: schema}
			if err := tx.Create(&form).Error; err != nil {
				return err
			}
		}
		if !slices.Equal(current.Routes.Rules, rules) {
			routes := models.ServiceRoutes{ServiceID: entry.ID, Version: current.Routes.Version + 1, Rules: rules}
			return writeServiceRoutes(tx, routes)
		}
		return nil
	})
	return entry.ID, err
}
