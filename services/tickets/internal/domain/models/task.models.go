package models

import (
	"errors"
	"time"
)

var ErrTitleRequired = errors.New("title is required")

type Task struct {
	ID        int64     `gorm:"primaryKey;autoIncrement"`
	Title     string    `gorm:"not null"`
	CreatedAt time.Time `gorm:"not null"`
}

func (Task) TableName() string {
	return "tasks"
}
