package utils

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
)

type Channel string

const (
	ChannelEmail Channel = "email"
)

type Message struct {
	Channel   Channel
	Recipient string
	Subject   string
	Body      string
	HTML      bool
}

type Sender interface {
	Send(ctx context.Context, msg Message) error
}

type Manager struct {
	log     *slog.Logger
	senders map[Channel]Sender
}

func NewManager(log *slog.Logger) *Manager {
	return &Manager{
		log:     log,
		senders: make(map[Channel]Sender),
	}
}

func (m *Manager) Register(channel Channel, sender Sender) {
	m.senders[channel] = sender
}

func (m *Manager) Send(ctx context.Context, msg Message) error {
	sender, ok := m.senders[msg.Channel]
	if !ok {
		return fmt.Errorf("%w: %q", ErrChannelNotConfigured, msg.Channel)
	}

	if err := sender.Send(ctx, msg); err != nil {
		return err
	}

	m.log.Info("notification sent", "channel", msg.Channel, "recipient", msg.Recipient)
	return nil
}

var (
	ErrChannelNotConfigured = errors.New("notification channel is not configured")
	ErrInvalidRecipient     = errors.New("invalid recipient")
	ErrSendEmail            = errors.New("failed to send email")
)
