package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"time"
)

type ExamPublicStore interface {
	ExamPublicFetch(context.Context, time.Time, string) ([]models.ExamPublicTest, error)
}

func (s *TestSessionService) ExamPublicFetch(ctx context.Context, recordBook string) (*models.ExamPublicCatalogue, error) {
	student, err := s.examStudent(ctx, recordBook)
	if err != nil {
		return nil, err
	}
	store, ok := s.store.(ExamPublicStore)
	if !ok {
		return nil, models.ErrExamDirectory
	}
	exams, err := store.ExamPublicFetch(ctx, s.now(), student.Uuid)
	if err != nil {
		return nil, err
	}
	profile := student.Students[0]
	return &models.ExamPublicCatalogue{Student: models.ExamPublicStudent{FullName: student.FullName, StudentGroup: profile.Group, Faculty: profile.FacultyName, Course: int(profile.Course)}, Exams: exams}, nil
}
