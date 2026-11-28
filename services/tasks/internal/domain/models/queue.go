package models

type Queue struct {
	Code   string `gorm:"type:varchar(64);primaryKey"`
	Name   string `gorm:"type:varchar(150);not null"`
	Active bool   `gorm:"not null;default:true"`
}
