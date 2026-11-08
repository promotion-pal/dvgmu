package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"time"
)

type ExamPublicStore interface {
	ExamPublicFetch(context.Context, time.Time, string) ([]models.ExamPublicTest, error)
}

func (s *TestSessionService) ExamPublicFetch(ctx context.Context, recordBook string) ([]models.ExamPublicTest, error) {
	student, err := s.examStudent(ctx, recordBook)
	if err != nil {
		return nil, err
	}
	store, ok := s.store.(ExamPublicStore)
	if !ok {
		return nil, models.ErrExamDirectory
	}
	return store.ExamPublicFetch(ctx, s.now(), student.Uuid)
}
