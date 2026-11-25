package models

import "time"

type DormitoryRegistration struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	UserID     int64
	Room       int32
	RecordBook string
	Data       time.Time
	// Floor и DutyDate — производные от Room/Data, нужны для ограничений
	// уникальности: один дежурный на этаж в день, один студент в месяц.
	Floor     int32
	DutyDate  time.Time `gorm:"type:date"`
	ByAdmin   bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (DormitoryRegistration) TableName() string {
	return "dormitory_registrations"
}
