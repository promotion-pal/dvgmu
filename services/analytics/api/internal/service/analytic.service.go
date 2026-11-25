package service

import (
	"context"
	"fmt"
	"time"

	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/storage"
)

type AnalyticService struct {
	storage *storage.AnalyticStorage
	ip      *IPService
}

func NewAnalyticService(storage *storage.AnalyticStorage, ip *IPService) *AnalyticService {
	return &AnalyticService{storage: storage, ip: ip}
}

func (s *AnalyticService) AnalyticCreate(ctx context.Context, analytic *models.Analytic) (int64, error) {
	id, err := s.storage.AnalyticCreate(ctx, analytic)
	if err != nil {
		return 0, fmt.Errorf("create analytic: %w", err)
	}
	return id, nil
}

func (s *AnalyticService) AnalyticByID(ctx context.Context, id int64) (*models.Analytic, error) {
	analytic, err := s.storage.AnalyticByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get analytic: %w", err)
	}
	return analytic, nil
}

func (s *AnalyticService) AnalyticFetch(
	ctx context.Context,
	name *string,
	analyticType *int32,
	startDate, endDate *time.Time,
	qr *int64,
) ([]models.Analytic, error) {
	analytics, err := s.storage.AnalyticFetch(ctx, name, analyticType, startDate, endDate, qr)
	if err != nil {
		return nil, fmt.Errorf("fetch analytics: %w", err)
	}
	return analytics, nil
}

func (s *AnalyticService) AnalyticRatingCreate(ctx context.Context, rating *models.AnalyticRating, ip string) (int64, error) {
	if ip != "" {
		allowed, retryAfter, err := s.ip.Check(ctx, rating.AnalyticID, ip)
		if err != nil {
			return 0, err
		}
		if !allowed {
			return 0, models.ReevaluationTooSoonError{RetryAfter: retryAfter}
		}
	}

	id, err := s.storage.AnalyticRatingCreate(ctx, rating)
	if err != nil {
		return 0, fmt.Errorf("create analytic rating: %w", err)
	}

	if ip != "" {
		if err := s.ip.Register(ctx, rating.AnalyticID, ip); err != nil {
			return 0, err
		}
	}

	return id, nil
}

func (s *AnalyticService) AnalyticUpdate(ctx context.Context, id int64, patch models.AnalyticPatch) (*models.Analytic, error) {
	analytic, err := s.storage.AnalyticUpdate(ctx, id, patch)
	if err != nil {
		return nil, fmt.Errorf("update analytic: %w", err)
	}
	return analytic, nil
}
