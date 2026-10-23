package models

import "time"

type MentorApplication struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	CourseID   int64
	CreatedAt  time.Time
	UpdatedAt  time.Time
	IsDone     bool
}

func (MentorApplication) TableName() string {
	return "mentor_applications"
}

type MentorCourse struct {
	ID        int64 `gorm:"primaryKey;autoIncrement"`
	StartDate *time.Time
	EndDate   *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (MentorCourse) TableName() string {
	return "mentor_courses"
}

type MentorQuestion struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	Question   string
	CreatedAt  time.Time
	UpdatedAt  time.Time
	IsDone     bool
}

func (MentorQuestion) TableName() string {
	return "mentor_questions"
}

type MentorTechnicalQuestion struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	CourseID   int64
	Question   string
	CreatedAt  time.Time
	UpdatedAt  time.Time
	IsDone     bool
}

func (MentorTechnicalQuestion) TableName() string {
	return "mentor_technical_questions"
}
