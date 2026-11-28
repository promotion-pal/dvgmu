package service

import (
	"context"
	"fmt"
	"strings"

	"dvgmu/tasks/internal/storage"
	"github.com/google/uuid"
)

type QueueViewAccessService struct {
	store             *storage.QueueStorage
	requireActiveUser func(context.Context, string) error
}

func NewQueueViewAccessService(store *storage.QueueStorage, requireActiveUser func(context.Context, string) error) *QueueViewAccessService {
	return &QueueViewAccessService{store: store, requireActiveUser: requireActiveUser}
}

func (s *QueueViewAccessService) Grant(ctx context.Context, code, userUUID string) error {
	code = strings.TrimSpace(code)
	userID, err := parseQueueUserUUID(userUUID)
	if err != nil {
		return err
	}
	if err := s.requireQueue(ctx, code); err != nil {
		return err
	}
	if err := s.requireActiveUser(ctx, userID); err != nil {
		return err
	}
	return s.store.GrantViewAccess(ctx, code, userID)
}

func (s *QueueViewAccessService) List(ctx context.Context, code, afterUserUUID string, pageSize int32) ([]string, string, error) {
	code = strings.TrimSpace(code)
	if pageSize < 0 || pageSize > 100 {
		return nil, "", fmt.Errorf("%w: page_size must be between 0 and 100", ErrInvalidQueue)
	}
	if pageSize == 0 {
		pageSize = 50
	}
	if afterUserUUID != "" {
		id, err := parseQueueUserUUID(afterUserUUID)
		if err != nil {
			return nil, "", fmt.Errorf("%w: provide a valid after_user_uuid", ErrInvalidQueue)
		}
		afterUserUUID = id
	}
	if err := s.requireQueue(ctx, code); err != nil {
		return nil, "", err
	}
	limit := int(pageSize)
	userUUIDs, err := s.store.ListViewAccess(ctx, code, afterUserUUID, limit+1)
	if err != nil {
		return nil, "", err
	}
	if len(userUUIDs) <= limit {
		return userUUIDs, "", nil
	}
	return userUUIDs[:limit], userUUIDs[limit-1], nil
}

func (s *QueueViewAccessService) Revoke(ctx context.Context, code, userUUID string) error {
	code = strings.TrimSpace(code)
	userID, err := parseQueueUserUUID(userUUID)
	if err != nil {
		return err
	}
	if err := s.requireQueue(ctx, code); err != nil {
		return err
	}
	return s.store.RevokeViewAccess(ctx, code, userID)
}

func (s *QueueViewAccessService) requireQueue(ctx context.Context, code string) error {
	if !validQueueLookupCode(code) {
		return fmt.Errorf("%w: provide a valid queue_code", ErrInvalidQueue)
	}
	_, err := s.store.Get(ctx, code)
	return err
}

func parseQueueUserUUID(value string) (string, error) {
	id, err := uuid.Parse(strings.TrimSpace(value))
	if err != nil || id == uuid.Nil {
		return "", fmt.Errorf("%w: provide a valid user_uuid", ErrInvalidQueue)
	}
	return id.String(), nil
}
