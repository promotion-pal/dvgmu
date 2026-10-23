package storage

import (
	"context"
	"errors"

	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type InventoryStorage struct {
	db *gorm.DB
}

func InventoryStorageNew(db *gorm.DB) *InventoryStorage {
	return &InventoryStorage{db: db}
}

func (s *InventoryStorage) InventoryFetch(ctx context.Context) ([]*models.Inventory, error) {
	var records []*models.Inventory

	if err := s.db.WithContext(ctx).Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

func (s *InventoryStorage) InventoryByID(ctx context.Context, id int64) (*models.Inventory, error) {
	var record models.Inventory

	err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrInventoryNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *InventoryStorage) InventoryCreate(ctx context.Context, inventory *models.Inventory) (int64, error) {
	if err := s.db.WithContext(ctx).Create(inventory).Error; err != nil {
		return 0, err
	}
	return inventory.ID, nil
}

func (s *InventoryStorage) InventoryUpdate(ctx context.Context, inventory *models.Inventory) error {
	res := s.db.WithContext(ctx).Model(&models.Inventory{}).Where("id = ?", inventory.ID).Updates(inventory)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrInventoryNotFound
	}
	return nil
}

func (s *InventoryStorage) InventoryDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.Inventory{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrInventoryNotFound
	}
	return nil
}
