package models

type Direction struct {
	ID        int64  `gorm:"primaryKey;autoIncrement"`
	Code      string `gorm:"type:varchar(64);not null;uniqueIndex:directions_code_key"`
	Name      string `gorm:"type:varchar(150);not null"`
	SortOrder int32  `gorm:"not null;default:0"`
	Active    bool   `gorm:"not null;default:true"`
}
