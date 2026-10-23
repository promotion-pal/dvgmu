package service

import (
	"context"
	"fmt"
	"time"

	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/storage"
)

// IPService — учёт IP, с которых оставляли оценку по анкете, и проверка
// периода охлаждения. Отдельный внутренний сервис без gRPC-обёртки:
// вызывается напрямую из AnalyticService.
type IPService struct {
	storage *storage.IPStorage
	window  time.Duration
}

func NewIPService(storage *storage.IPStorage, reevaluationSeconds int) *IPService {
	return &IPService{
		storage: storage,
		window:  models.ReevaluationWindow(reevaluationSeconds),
	}
}

// Check сообщает, можно ли с этого IP оставить оценку по анкете сейчас.
// allowed=false → retryAfter указывает момент, когда станет можно.
// window <= 0 — проверка отключена, пропускаем всех.
func (s *IPService) Check(ctx context.Context, analyticID int64, ip string) (allowed bool, retryAfter time.Time, err error) {
	if s.window <= 0 {
		return true, time.Time{}, nil
	}

	last, err := s.storage.Last(ctx, analyticID, ip)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("ip check: %w", err)
	}
	allowed, retryAfter = last.CanReevaluate(s.window, time.Now())
	return allowed, retryAfter, nil
}

// Register фиксирует, что с IP оставили оценку по анкете.
// При отключённой проверке (window <= 0) ничего не пишем.
func (s *IPService) Register(ctx context.Context, analyticID int64, ip string) error {
	if s.window <= 0 {
		return nil
	}

	if _, err := s.storage.Create(ctx, &models.AnalyticIP{AnalyticID: analyticID, IP: ip}); err != nil {
		return fmt.Errorf("ip register: %w", err)
	}
	return nil
}
