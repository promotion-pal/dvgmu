package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
)

type EducationStorage struct {
	db *gorm.DB
}

func EducationStorageNew(db *gorm.DB) *EducationStorage {
	return &EducationStorage{db: db}
}

func (s *EducationStorage) EducationCreate(ctx context.Context, education *models.Education) (int64, error) {
	if err := s.db.WithContext(ctx).Create(education).Error; err != nil {
		return 0, err
	}
	return education.ID, nil
}
