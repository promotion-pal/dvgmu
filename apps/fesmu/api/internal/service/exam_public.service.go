package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"errors"
	"time"
)

// ExamPublicStore is implemented by the examination session database.
type ExamPublicStore interface {
	ExamPublicFetch(context.Context, time.Time) ([]models.ExamPublicTest, error)
}

func (s *TestSessionService) ExamPublicFetch(ctx context.Context) ([]models.ExamPublicTest, error) {
	store, ok := s.store.(ExamPublicStore)
	if !ok {
		return nil, errors.New("public examination catalogue is unavailable")
	}
	return store.ExamPublicFetch(ctx, s.now())
}
