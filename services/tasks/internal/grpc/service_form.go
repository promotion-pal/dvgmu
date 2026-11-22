package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type ServiceFormController struct {
	service *service.ServiceFormService
	log     *slog.Logger
}

func NewServiceFormController(service *service.ServiceFormService, log *slog.Logger) *ServiceFormController {
	return &ServiceFormController{service: service, log: log}
}

func (c *ServiceFormController) GetServiceForm(ctx context.Context, req *connect.Request[api.GetServiceFormRequest]) (*connect.Response[api.GetServiceFormResponse], error) {
	schema, version, err := c.service.Get(ctx, req.Msg.ServiceId)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetServiceFormResponse{ServiceId: req.Msg.ServiceId, Version: version, Schema: schema}), nil
}

func (c *ServiceFormController) UpdateServiceForm(ctx context.Context, req *connect.Request[api.UpdateServiceFormRequest]) (*connect.Response[api.UpdateServiceFormResponse], error) {
	schema, version, err := c.service.Update(ctx, req.Msg.ServiceId, req.Msg.ExpectedVersion, req.Msg.Schema)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateServiceFormResponse{ServiceId: req.Msg.ServiceId, Version: version, Schema: schema}), nil
}

func (c *ServiceFormController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidServiceForm):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("service not found"))
	case errors.Is(err, storage.ErrServiceFormVersionConflict):
		return connect.NewError(connect.CodeAborted, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("service form operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("service form operation failed"))
	}
}
