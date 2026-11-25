package models

import "time"

// RefreshToken — выданный refresh-токен fesmu. Сам токен клиенту уходит
// только в HttpOnly-cookie, в БД — sha256 от него. FamilyID — цепочка
// ротаций одного входа: предъявили уже отозванный токен → его украли,
// отзывается вся семья.
type RefreshToken struct {
	ID         string     `gorm:"column:id;primaryKey;type:uuid"`
	UserID     string     `gorm:"column:user_id;type:uuid;not null;index"` // mdm uuid
	FamilyID   string     `gorm:"column:family_id;type:uuid;not null;index"`
	TokenHash  []byte     `gorm:"column:token_hash;not null;uniqueIndex"`
	ExpiresAt  time.Time  `gorm:"column:expires_at;not null"`
	RevokedAt  *time.Time `gorm:"column:revoked_at"`
	DeviceInfo string     `gorm:"column:device_info"`
	CreatedAt  time.Time
	LastUsedAt *time.Time `gorm:"column:last_used_at"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }
