package app

import (
	"log/slog"

	grpcapp "dvgmu/notification/internal/app/grpc"
	"dvgmu/notification/internal/config"
	"dvgmu/notification/internal/grpc"
	"dvgmu/notification/internal/service"
	"dvgmu/notification/internal/utils"
)

type App struct {
	GRPCServer *grpcapp.App
}

func New(
	log *slog.Logger,
	cfg *config.Config,
) *App {
	manager := utils.NewManager(log)

	if cfg.SMTP.Host != "" {
		manager.Register(utils.ChannelEmail, utils.NewEmailProvider(
			cfg.SMTP.Host,
			cfg.SMTP.Port,
			cfg.SMTP.From,
			cfg.SMTP.Password,
			cfg.SMTP.TLSSkipVerify,
		))
	} else {
		log.Warn("smtp host is empty, email channel is disabled")
	}

	notificationService := service.NewNotificationService(log, manager)
	notificationHandler := grpc.NotificationNewController(notificationService, log)

	grpcApp := grpcapp.New(
		log,
		notificationHandler,
		cfg.GRPC.Port,
		cfg.GRPC.CORSAllowedOrigins,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
