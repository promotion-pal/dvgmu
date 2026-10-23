package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"

	"dvgmu/notification/contract/gen/go/enum"
	servicepb "dvgmu/notification/contract/gen/go/service"
	"dvgmu/notification/contract/gen/go/service/serviceconnect"
	"dvgmu/notification/internal/service"
	"dvgmu/notification/internal/utils"
)

type NotificationHandler struct {
	serviceconnect.UnimplementedNotificationServiceHandler

	log     *slog.Logger
	service *service.NotificationService
}

func NotificationNewController(notificationService *service.NotificationService, log *slog.Logger) *NotificationHandler {
	return &NotificationHandler{
		log:     log,
		service: notificationService,
	}
}

func (h *NotificationHandler) NotificationSend(ctx context.Context, req *connect.Request[servicepb.NotificationSendRequest]) (*connect.Response[servicepb.NotificationSendResponse], error) {
	m := req.Msg.GetMessage()

	channel, ok := channelFromProto(m.GetChannel())
	if !ok {
		return connect.NewResponse(&servicepb.NotificationSendResponse{
			Success: false,
			Message: "unsupported notification channel",
		}), nil
	}

	err := h.service.Send(ctx, utils.Message{
		Channel:   channel,
		Recipient: m.GetRecipient(),
		Subject:   m.GetSubject(),
		Body:      m.GetBody(),
		HTML:      m.GetIsHtml(),
	})
	if err != nil {
		h.log.Error("notification send failed", "channel", channel, "recipient", m.GetRecipient(), "error", err.Error())
		return connect.NewResponse(&servicepb.NotificationSendResponse{
			Success: false,
			Message: userMessage(err),
		}), nil
	}

	return connect.NewResponse(&servicepb.NotificationSendResponse{Success: true}), nil
}

func channelFromProto(c enum.NotificationChannel) (utils.Channel, bool) {
	switch c {
	case enum.NotificationChannel_NOTIFICATION_CHANNEL_EMAIL:
		return utils.ChannelEmail, true
	default:
		return "", false
	}
}

func userMessage(err error) string {
	switch {
	case errors.Is(err, service.ErrRecipientRequired),
		errors.Is(err, service.ErrBodyRequired),
		errors.Is(err, utils.ErrInvalidRecipient),
		errors.Is(err, utils.ErrChannelNotConfigured):
		return err.Error()
	default:
		return "failed to send notification"
	}
}
