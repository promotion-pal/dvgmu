package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"dvgmu/notification/internal/utils"
)

var (
	ErrRecipientRequired = errors.New("recipient is required")
	ErrBodyRequired      = errors.New("body is required")
)

type NotificationService struct {
	log     *slog.Logger
	manager *utils.Manager
}

func NewNotificationService(log *slog.Logger, manager *utils.Manager) *NotificationService {
	return &NotificationService{
		log:     log,
		manager: manager,
	}
}

func (s *NotificationService) Send(ctx context.Context, msg utils.Message) error {
	if strings.TrimSpace(msg.Recipient) == "" {
		return ErrRecipientRequired
	}
	if strings.TrimSpace(msg.Body) == "" {
		return ErrBodyRequired
	}

	return s.manager.Send(ctx, msg)
}
