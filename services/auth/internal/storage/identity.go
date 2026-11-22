package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ErrIdentityNotFound = errors.New("test identity not found")

type TestIdentity struct {
	ID           int64     `gorm:"primaryKey;autoIncrement"`
	MDMUserID    int64     `gorm:"not null;uniqueIndex"`
	Subject      string    `gorm:"size:128;not null;uniqueIndex"`
	Email        string    `gorm:"size:320;not null;uniqueIndex"`
	PasswordHash string    `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
	UpdatedAt    time.Time `gorm:"not null"`
}

func (TestIdentity) TableName() string { return "auth_test_identities" }

type IdentityStore struct {
	db *gorm.DB
}

func NewIdentityStore(db *gorm.DB) *IdentityStore { return &IdentityStore{db: db} }

func (s *IdentityStore) ByEmail(ctx context.Context, email string) (*TestIdentity, error) {
	var identity TestIdentity
	err := s.db.WithContext(ctx).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).First(&identity).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrIdentityNotFound
	}
	return &identity, err
}

func (s *IdentityStore) BySubject(ctx context.Context, subject string) (*TestIdentity, error) {
	var identity TestIdentity
	err := s.db.WithContext(ctx).Where("subject = ?", subject).First(&identity).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrIdentityNotFound
	}
	return &identity, err
}

func (s *IdentityStore) Upsert(ctx context.Context, identity *TestIdentity) error {
	var current TestIdentity
	err := s.db.WithContext(ctx).Where("mdm_user_id = ?", identity.MDMUserID).First(&current).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.db.WithContext(ctx).Create(identity).Error
	}
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(&current).Updates(map[string]any{
		"subject":       identity.Subject,
		"email":         identity.Email,
		"password_hash": identity.PasswordHash,
	}).Error
}
