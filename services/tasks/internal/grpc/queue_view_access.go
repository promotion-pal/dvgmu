package grpc

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/service"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type QueueViewAccessController struct {
	service      *service.QueueViewAccessService
	requireAdmin func(context.Context, http.Header) error
	log          *slog.Logger
}

func NewQueueViewAccessController(service *service.QueueViewAccessService, requireAdmin func(context.Context, http.Header) error, log *slog.Logger) *QueueViewAccessController {
	return &QueueViewAccessController{service: service, requireAdmin: requireAdmin, log: log}
}

func (c *QueueViewAccessController) GrantQueueViewAccess(ctx context.Context, req *connect.Request[api.GrantQueueViewAccessRequest]) (*connect.Response[api.GrantQueueViewAccessResponse], error) {
	if err := c.requireAdmin(ctx, req.Header()); err != nil {
		return nil, err
	}
	if err := c.service.Grant(ctx, req.Msg.QueueCode, req.Msg.UserUuid); err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GrantQueueViewAccessResponse{}), nil
}

func (c *QueueViewAccessController) ListQueueViewAccess(ctx context.Context, req *connect.Request[api.ListQueueViewAccessRequest]) (*connect.Response[api.ListQueueViewAccessResponse], error) {
	if err := c.requireAdmin(ctx, req.Header()); err != nil {
		return nil, err
	}
	users, next, err := c.service.List(ctx, req.Msg.QueueCode, req.Msg.AfterUserUuid, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.ListQueueViewAccessResponse{UserUuids: users, NextAfterUserUuid: next}), nil
}

func (c *QueueViewAccessController) RevokeQueueViewAccess(ctx context.Context, req *connect.Request[api.RevokeQueueViewAccessRequest]) (*connect.Response[api.RevokeQueueViewAccessResponse], error) {
	if err := c.requireAdmin(ctx, req.Header()); err != nil {
		return nil, err
	}
	if err := c.service.Revoke(ctx, req.Msg.QueueCode, req.Msg.UserUuid); err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.RevokeQueueViewAccessResponse{}), nil
}

func (c *QueueViewAccessController) rpcError(err error) error {
	var rpcErr *connect.Error
	switch {
	case errors.As(err, &rpcErr):
		return rpcErr
	case errors.Is(err, service.ErrInvalidQueue):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("queue not found"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("queue access operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("queue access operation failed"))
	}
}
