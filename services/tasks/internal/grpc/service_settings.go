package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type ServiceSettingsController struct {
	service *service.ServiceSettingsService
	log     *slog.Logger
}

func NewServiceSettingsController(service *service.ServiceSettingsService, log *slog.Logger) *ServiceSettingsController {
	return &ServiceSettingsController{service: service, log: log}
}

func (c *ServiceSettingsController) GetServiceSettings(ctx context.Context, req *connect.Request[api.GetServiceSettingsRequest]) (*connect.Response[api.GetServiceSettingsResponse], error) {
	settings, err := c.service.Get(ctx, req.Msg.ServiceId)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.GetServiceSettingsResponse{ServiceId: settings.ServiceID}
	if settings.InitialStatusID != 0 {
		response.Settings = &api.ServiceSettings{
			InitialStatusId: settings.InitialStatusID, DefaultPriorityId: settings.DefaultPriorityID,
		}
	}
	return connect.NewResponse(response), nil
}

func (c *ServiceSettingsController) UpdateServiceSettings(ctx context.Context, req *connect.Request[api.UpdateServiceSettingsRequest]) (*connect.Response[api.UpdateServiceSettingsResponse], error) {
	settings := models.ServiceSettings{
		ServiceID:         req.Msg.ServiceId,
		InitialStatusID:   req.Msg.Settings.GetInitialStatusId(),
		DefaultPriorityID: req.Msg.Settings.GetDefaultPriorityId(),
	}
	if err := c.service.Update(ctx, settings); err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateServiceSettingsResponse{
		ServiceId: settings.ServiceID,
		Settings: &api.ServiceSettings{
			InitialStatusId: settings.InitialStatusID, DefaultPriorityId: settings.DefaultPriorityID,
		},
	}), nil
}

func (c *ServiceSettingsController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidServiceSettings):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("service not found"))
	case errors.Is(err, storage.ErrInitialStatusUnavailable), errors.Is(err, storage.ErrDefaultPriorityUnavailable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("service settings operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("service settings operation failed"))
	}
}
