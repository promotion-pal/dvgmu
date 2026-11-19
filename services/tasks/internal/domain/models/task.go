package models

import "time"

type Task struct {
	ID        int64     `gorm:"primaryKey;autoIncrement"`
	UUID      string    `gorm:"type:uuid;not null;default:gen_random_uuid();uniqueIndex:tasks_uuid_key"`
	Number    string    `gorm:"type:text;not null;uniqueIndex:tasks_number_key"`
	Title     string    `gorm:"type:varchar(150);not null"`
	Version   int64     `gorm:"not null;default:1"`
	CreatedAt time.Time `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
}
