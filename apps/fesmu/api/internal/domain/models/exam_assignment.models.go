package models

import (
	"errors"
	entity "fesmu/contract/fesmu/entity/v1"
	"time"
)

var ErrExamNotAssigned = errors.New("этот экзамен вам не назначен")
var ErrExamStudent = errors.New("номер зачётной книжки не найден или не позволяет однозначно определить студента")
var ErrExamAudience = errors.New("выберите курс, группу или студентов для назначения экзамена")
var ErrExamDirectory = errors.New("справочник студентов MDM временно недоступен")

// A session targets a snapshot of MDM users, never database IDs from another service.
type ExamAssignment struct {
	ID           int64     `gorm:"primaryKey;autoIncrement"`
	SessionID    int64     `gorm:"not null;uniqueIndex:idx_exam_assignment_student"`
	MDMUserUUID  string    `gorm:"type:uuid;not null;uniqueIndex:idx_exam_assignment_student;index"`
	FullName     string    `gorm:"size:255;not null;default:''"`
	StudentGroup string    `gorm:"size:64;not null;default:''"`
	CreatedAt    time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

type ExamAudience struct {
	Kind         string   `json:"kind"`
	FacultyCode  int32    `json:"faculty_code"`
	Course       int32    `json:"course"`
	StudentGroup string   `json:"student_group"`
	StudentUUIDs []string `json:"student_uuids,omitempty"`
}

func (a ExamAudience) ToProto() *entity.ExamAudience {
	if a.Kind == "" {
		return nil
	}
	return &entity.ExamAudience{Kind: a.Kind, FacultyCode: a.FacultyCode, Course: a.Course, StudentGroup: a.StudentGroup, StudentUuids: a.StudentUUIDs}
}
func ExamAudienceFromProto(a *entity.ExamAudience) ExamAudience {
	if a == nil {
		return ExamAudience{}
	}
	return ExamAudience{Kind: a.Kind, FacultyCode: a.FacultyCode, Course: a.Course, StudentGroup: a.StudentGroup, StudentUUIDs: a.StudentUuids}
}
