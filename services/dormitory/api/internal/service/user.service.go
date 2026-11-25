package service

import (
	"context"
	"fmt"

	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/storage"
)

type UserService struct {
	storage *storage.UserStorage
}

func NewUserService(storage *storage.UserStorage) *UserService {
	return &UserService{storage: storage}
}

func (s *UserService) Create(ctx context.Context, user *models.User) (int64, error) {
	id, err := s.storage.Upsert(ctx, user)
	if err != nil {
		return 0, fmt.Errorf("upsert user: %w", err)
	}
	return id, nil
}

func (s *UserService) ByID(ctx context.Context, id int64) (*models.User, error) {
	user, err := s.storage.ByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return user, nil
}

func (s *UserService) Fetch(ctx context.Context) ([]models.User, error) {
	users, err := s.storage.Fetch(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch users: %w", err)
	}
	return users, nil
}
