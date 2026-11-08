package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"dvgmu/api/internal/domain/models"
)

type UserPermissionGroupStore interface {
	UserPermissionGroupFetch(ctx context.Context) ([]*models.UserPermissionGroup, error)
	UserPermissionGroupAssignmentsFetch(ctx context.Context) ([]*models.UserPermissionGroupAssignment, error)
	UserPermissionGroupByID(ctx context.Context, id int64) (*models.UserPermissionGroup, error)
	UserPermissionGroupSave(ctx context.Context, g *models.UserPermissionGroup, perms []string) (int64, error)
	UserPermissionGroupDelete(ctx context.Context, id int64) error
	UserPermissionGroupsSet(ctx context.Context, userID int64, groupIDs []int64) error
}

// UserPermissionGroupService — наборы доступа (собирает администратор в fesmu,
// «Доступы») и их выдача людям.
type UserPermissionGroupService struct {
	log   *slog.Logger
	users UserProvider
	store UserPermissionGroupStore
}

func NewUserPermissionGroupService(log *slog.Logger, users UserProvider, store UserPermissionGroupStore) *UserPermissionGroupService {
	return &UserPermissionGroupService{log: log, users: users, store: store}
}

func (s *UserPermissionGroupService) Fetch(ctx context.Context) ([]*models.UserPermissionGroup, error) {
	return s.store.UserPermissionGroupFetch(ctx)
}

func (s *UserPermissionGroupService) FetchAssignments(ctx context.Context) ([]*models.UserPermissionGroupAssignment, error) {
	return s.store.UserPermissionGroupAssignmentsFetch(ctx)
}

func (s *UserPermissionGroupService) Save(ctx context.Context, id int64, name, description string, perms []string) (*models.UserPermissionGroup, error) {
	log := s.log.With(slog.String("op", "UserPermissionGroup.Save"), slog.Int64("id", id))

	name, err := models.NormalizeUserPermissionGroupName(name)
	if err != nil {
		return nil, err
	}
	perms, err = models.NormalizePermissions(perms)
	if err != nil {
		return nil, err
	}
	g := &models.UserPermissionGroup{ID: id, Name: name, Description: strings.TrimSpace(description)}
	if id, err = s.store.UserPermissionGroupSave(ctx, g, perms); err != nil {
		if !errors.Is(err, models.ErrUserPermissionGroupExists) && !errors.Is(err, models.ErrUserPermissionGroupNotFound) {
			log.Error("failed to save permission group", slog.String("error", err.Error()))
		}
		return nil, err
	}

	log.Info("permission group saved", slog.String("name", name), slog.Any("permissions", perms))
	return s.store.UserPermissionGroupByID(ctx, id)
}

func (s *UserPermissionGroupService) Delete(ctx context.Context, id int64) error {
	if err := s.store.UserPermissionGroupDelete(ctx, id); err != nil {
		return err
	}
	s.log.Info("permission group deleted", slog.Int64("id", id))
	return nil
}

// UserGroupsSet заменяет наборы пользователя и возвращает его уже с ними.
func (s *UserPermissionGroupService) UserPermissionGroupsSet(ctx context.Context, userID int64, groupIDs []int64) (*models.User, error) {
	groupIDs = models.NormalizeIDs(groupIDs)
	if err := s.store.UserPermissionGroupsSet(ctx, userID, groupIDs); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) && !errors.Is(err, models.ErrUserPermissionGroupNotFound) {
			s.log.Error("failed to set user permission groups", slog.Int64("user_id", userID), slog.String("error", err.Error()))
		}
		return nil, err
	}
	s.log.Info("user permission groups set", slog.Int64("user_id", userID), slog.Any("groups", groupIDs))
	return s.users.UserByID(ctx, userID)
}
