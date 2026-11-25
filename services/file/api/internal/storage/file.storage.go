package storage

import (
	"context"
	"errors"
	"log/slog"

	"gorm.io/gorm"

	"dvgmu/file/internal/domain/models"
)

type FileStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func FileStorageNew(db *gorm.DB, log *slog.Logger) *FileStorage {
	return &FileStorage{
		db:  db,
		log: log,
	}
}

func (s *FileStorage) FileCreate(ctx context.Context, file *models.File) (int64, error) {
	if err := s.db.WithContext(ctx).Create(file).Error; err != nil {
		s.log.Error("failed to create file", "error", err.Error())
		return 0, err
	}
	return file.ID, nil
}

func (s *FileStorage) FileFetchByID(ctx context.Context, id int64) (*models.File, error) {
	var file models.File
	if err := s.db.WithContext(ctx).First(&file, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch file by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &file, nil
}
