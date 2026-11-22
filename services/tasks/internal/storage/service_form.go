package storage

import (
	"context"
	"errors"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrServiceFormVersionConflict = errors.New("service form version changed")

type ServiceFormStorage struct {
	db *gorm.DB
}

func NewServiceFormStorage(db *gorm.DB) *ServiceFormStorage {
	return &ServiceFormStorage{db: db}
}

func (s *ServiceFormStorage) Get(ctx context.Context, serviceID int64) (models.ServiceFormVersion, error) {
	var form models.ServiceFormVersion
	err := s.db.WithContext(ctx).Table("services").
		Select("services.id AS service_id, COALESCE(forms.version, 0) AS version, COALESCE(forms.schema, '{}'::jsonb) AS schema").
		Joins("LEFT JOIN LATERAL (SELECT version, schema FROM service_form_versions WHERE service_id = services.id ORDER BY version DESC LIMIT 1) AS forms ON true").
		Where("services.id = ?", serviceID).Take(&form).Error
	return form, err
}

func (s *ServiceFormStorage) Replace(ctx context.Context, serviceID, expectedVersion int64, schema string) (int64, error) {
	nextVersion := expectedVersion + 1
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var service models.Service
		if err := tx.Select("id").Clauses(clause.Locking{Strength: "UPDATE"}).Take(&service, serviceID).Error; err != nil {
			return err
		}
		var current int64
		if err := tx.Model(&models.ServiceFormVersion{}).
			Select("COALESCE(MAX(version), 0)").Where("service_id = ?", serviceID).Scan(&current).Error; err != nil {
			return err
		}
		if current != expectedVersion {
			return ErrServiceFormVersionConflict
		}
		return tx.Create(&models.ServiceFormVersion{ServiceID: serviceID, Version: nextVersion, Schema: schema}).Error
	})
	return nextVersion, err
}
