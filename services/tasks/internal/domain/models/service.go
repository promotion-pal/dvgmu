package models

type Service struct {
	ID          int64     `gorm:"primaryKey;autoIncrement;index:services_direction_id_idx,priority:2"`
	DirectionID int64     `gorm:"not null;uniqueIndex:services_direction_code_key,priority:1;index:services_direction_id_idx,priority:1"`
	Direction   Direction `gorm:"constraint:fk_services_direction,OnDelete:RESTRICT"`
	Code        string    `gorm:"type:varchar(64);not null;uniqueIndex:services_direction_code_key,priority:2"`
	Name        string    `gorm:"type:varchar(150);not null"`
	Description string    `gorm:"type:text;not null"`
	SortOrder   int32     `gorm:"not null;default:0"`
	Active      bool      `gorm:"not null;default:true"`
}
