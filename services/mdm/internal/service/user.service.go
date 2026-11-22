package service

import (
	"context"

	"dvgmu/mdm/internal/domain/models"
	enum "fesmu/contract/mdm/enum"
)

type UserRepository interface {
	UserFetch(context.Context) ([]models.User, error)
	UserByID(context.Context, int64) (*models.User, error)
	UserCreate(context.Context, *models.User) error
	UserUpdate(context.Context, *models.User) error
	UserRolesSet(context.Context, int64, []models.UserRole) (*models.User, error)
}

func (s *UserService) RolesSet(ctx context.Context, id int64, roles []enum.UserRole) (*models.User, error) {
	if id <= 0 {
		return nil, models.ErrUserNotFound
	}
	roles, err := models.NormalizeRoles(roles)
	if err != nil {
		return nil, err
	}
	stored := make([]models.UserRole, 0, len(roles))
	for _, role := range roles {
		stored = append(stored, models.UserRole{UserID: id, Role: role})
	}
	return s.repository.UserRolesSet(ctx, id, stored)
}

type UserService struct {
	repository UserRepository
}

func NewUserService(repository UserRepository) *UserService {
	return &UserService{repository: repository}
}

func (s *UserService) Fetch(ctx context.Context) ([]models.User, error) {
	return s.repository.UserFetch(ctx)
}

func (s *UserService) FetchByID(ctx context.Context, id int64) (*models.User, error) {
	if id <= 0 {
		return nil, models.ErrUserNotFound
	}
	return s.repository.UserByID(ctx, id)
}

func (s *UserService) Create(ctx context.Context, params models.UserCreateParams) (*models.User, error) {
	user, err := models.NewUser(params)
	if err != nil {
		return nil, err
	}
	if err := s.repository.UserCreate(ctx, user); err != nil {
		return nil, err
	}
	return s.repository.UserByID(ctx, user.ID)
}

func (s *UserService) Update(ctx context.Context, id int64, params models.UserCreateParams, status enum.UserStatus) (*models.User, error) {
	if id <= 0 {
		return nil, models.ErrUserNotFound
	}
	user, err := models.NewUser(params)
	if err != nil {
		return nil, err
	}
	if status != enum.UserStatus_USER_STATUS_ACTIVE && status != enum.UserStatus_USER_STATUS_INACTIVE {
		return nil, models.ErrInvalidUser
	}
	current, err := s.repository.UserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	user.ID = current.ID
	user.UUID = current.UUID
	user.ADObjectID = current.ADObjectID
	user.CreatedAt = current.CreatedAt
	user.Status = status
	if err := s.repository.UserUpdate(ctx, user); err != nil {
		return nil, err
	}
	return s.repository.UserByID(ctx, id)
}
