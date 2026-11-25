package service

import (
	"context"
	"fmt"
	"time"

	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/storage"
)

type DormitoryRegistrationService struct {
	storage *storage.DormitoryRegistrationStorage
}

func NewDormitoryRegistrationService(storage *storage.DormitoryRegistrationStorage) *DormitoryRegistrationService {
	return &DormitoryRegistrationService{storage: storage}
}

func (s *DormitoryRegistrationService) Create(ctx context.Context, registration *models.DormitoryRegistration) (int64, error) {
	id, err := s.storage.Create(ctx, registration)
	if err != nil {
		return 0, fmt.Errorf("create dormitory registration: %w", err)
	}
	return id, nil
}

func (s *DormitoryRegistrationService) ByID(ctx context.Context, id int64) (*models.DormitoryRegistration, error) {
	registration, err := s.storage.ByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get dormitory registration: %w", err)
	}
	return registration, nil
}

func (s *DormitoryRegistrationService) HasRegistrationInMonth(
	ctx context.Context, userID int64, dutyDate time.Time,
) (bool, error) {
	exists, err := s.storage.ExistsUserMonth(ctx, userID, dutyDate)
	if err != nil {
		return false, fmt.Errorf("check user month registration: %w", err)
	}
	return exists, nil
}

func (s *DormitoryRegistrationService) UpdateDate(
	ctx context.Context, id int64, data, dutyDate time.Time, floor int32,
) error {
	if err := s.storage.UpdateDate(ctx, id, data, dutyDate, floor); err != nil {
		return fmt.Errorf("update dormitory registration date: %w", err)
	}
	return nil
}

func (s *DormitoryRegistrationService) Fetch(
	ctx context.Context,
	userID *int64,
	room *int32,
	recordBook *string,
	startDate, endDate *time.Time,
) ([]models.DormitoryRegistration, error) {
	registrations, err := s.storage.Fetch(ctx, userID, room, recordBook, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("fetch dormitory registrations: %w", err)
	}
	return registrations, nil
}
