package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"dvgmu/api/contract/gen/go/enum"
	"dvgmu/api/internal/domain/models"
)

type AccessGroupStore interface {
	AccessGroupFetch(ctx context.Context) ([]*models.AccessGroup, error)
	AccessGroupByID(ctx context.Context, id int64) (*models.AccessGroup, error)
	AccessGroupSave(ctx context.Context, g *models.AccessGroup, perms []string, deps []enum.UserEmployeeDepartment) (int64, error)
	AccessGroupDelete(ctx context.Context, id int64) error
	UserAccessGroupsSet(ctx context.Context, userID int64, groupIDs []int64) error
}

// AccessGroupService — наборы доступа (собирает администратор в fesmu,
// «Доступы») и их выдача людям.
type AccessGroupService struct {
	log   *slog.Logger
	users UserProvider
	store AccessGroupStore
}

func NewAccessGroupService(log *slog.Logger, users UserProvider, store AccessGroupStore) *AccessGroupService {
	return &AccessGroupService{log: log, users: users, store: store}
}

func (s *AccessGroupService) Fetch(ctx context.Context) ([]*models.AccessGroup, error) {
	return s.store.AccessGroupFetch(ctx)
}

func (s *AccessGroupService) Save(ctx context.Context, id int64, name, description string, perms []string, deps []enum.UserEmployeeDepartment) (*models.AccessGroup, error) {
	log := s.log.With(slog.String("op", "AccessGroup.Save"), slog.Int64("id", id))

	name, err := models.NormalizeAccessGroupName(name)
	if err != nil {
		return nil, err
	}
	perms, err = models.NormalizePermissions(perms)
	if err != nil {
		return nil, err
	}
	g := &models.AccessGroup{ID: id, Name: name, Description: strings.TrimSpace(description)}
	deps = models.NormalizeDepartments(deps)
	if id, err = s.store.AccessGroupSave(ctx, g, perms, deps); err != nil {
		if !errors.Is(err, models.ErrAccessGroupExists) && !errors.Is(err, models.ErrAccessGroupNotFound) {
			log.Error("failed to save access group", slog.String("error", err.Error()))
		}
		return nil, err
	}

	log.Info("access group saved", slog.String("name", name), slog.Any("permissions", perms), slog.Any("departments", deps))
	return s.store.AccessGroupByID(ctx, id)
}

func (s *AccessGroupService) Delete(ctx context.Context, id int64) error {
	if err := s.store.AccessGroupDelete(ctx, id); err != nil {
		return err
	}
	s.log.Info("access group deleted", slog.Int64("id", id))
	return nil
}

// UserGroupsSet заменяет наборы пользователя и возвращает его уже с ними.
func (s *AccessGroupService) UserGroupsSet(ctx context.Context, userID int64, groupIDs []int64) (*models.User, error) {
	groupIDs = models.NormalizeIDs(groupIDs)
	if err := s.store.UserAccessGroupsSet(ctx, userID, groupIDs); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) && !errors.Is(err, models.ErrAccessGroupNotFound) {
			s.log.Error("failed to set user access groups", slog.Int64("user_id", userID), slog.String("error", err.Error()))
		}
		return nil, err
	}
	s.log.Info("user access groups set", slog.Int64("user_id", userID), slog.Any("groups", groupIDs))
	return s.users.UserByID(ctx, userID)
}
