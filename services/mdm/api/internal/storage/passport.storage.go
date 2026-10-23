package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type PassportStorage struct {
	db *gorm.DB
}

func PassportStorageNew(db *gorm.DB) *PassportStorage {
	return &PassportStorage{db: db}
}

func (s *PassportStorage) PassportCreate(ctx context.Context, passport *models.Passport) (int64, error) {
	if err := s.db.WithContext(ctx).Create(passport).Error; err != nil {
		return 0, err
	}
	return passport.ID, nil
}
