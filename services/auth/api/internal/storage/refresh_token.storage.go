package storage

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

type RefreshTokenStorage struct {
	db *gorm.DB
}

func RefreshTokenStorageNew(db *gorm.DB) *RefreshTokenStorage {
	return &RefreshTokenStorage{db: db}
}

func (s *RefreshTokenStorage) Migrate() error {
	return s.db.AutoMigrate(&models.RefreshToken{})
}

func (s *RefreshTokenStorage) RefreshTokenCreate(ctx context.Context, t *models.RefreshToken) error {
	return s.db.WithContext(ctx).Create(t).Error
}

func (s *RefreshTokenStorage) RefreshTokenByHash(ctx context.Context, hash []byte) (*models.RefreshToken, error) {
	var t models.RefreshToken
	if err := s.db.WithContext(ctx).First(&t, "token_hash = ?", hash).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrInvalidToken
		}
		return nil, err
	}
	return &t, nil
}

// RefreshTokenRotate атомарно отзывает старый токен и сохраняет новый той же
// семьи. Старый уже отозван (гонка двух вкладок / повтор) — ErrInvalidToken.
func (s *RefreshTokenStorage) RefreshTokenRotate(ctx context.Context, oldID string, next *models.RefreshToken) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		res := tx.Model(&models.RefreshToken{}).
			Where("id = ? AND revoked_at IS NULL", oldID).
			Updates(map[string]any{"revoked_at": now, "last_used_at": now})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return utils.ErrInvalidToken
		}
		return tx.Create(next).Error
	})
}

func (s *RefreshTokenStorage) RefreshTokenRevokeFamily(ctx context.Context, familyID string) error {
	return s.db.WithContext(ctx).Model(&models.RefreshToken{}).
		Where("family_id = ? AND revoked_at IS NULL", familyID).
		Update("revoked_at", time.Now()).Error
}
