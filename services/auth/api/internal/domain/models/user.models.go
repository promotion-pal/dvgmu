package models

import "time"

// User — DTO пользователя для AuthService: реальный источник — AD/AD FS,
// локально не хранится и не персистится (id/created_at/updated_at заполняются
// только когда есть откуда их взять, иначе остаются нулевыми).
type User struct {
	ID        int64
	Email     string
	FirstName string
	LastName  string
	CreatedAt time.Time
	UpdatedAt time.Time

	ExternalID string
	MDMID      int64
	// UPN — нормализованный логин (с суффиксом домена), которым auth ходил в
	// AD FS; тот же логин, которым пользователя провизионит SCIM-синхронизация
	// в Yandex 360 (services/sync/yandex-scim).
	UPN string
}
