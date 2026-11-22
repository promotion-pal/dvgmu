package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	entity "fesmu/contract/tasks/entity"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type StatusController struct {
	service *service.StatusService
	log     *slog.Logger
}

func NewStatusController(service *service.StatusService, log *slog.Logger) *StatusController {
	return &StatusController{service: service, log: log}
}

func (c *StatusController) CreateStatus(ctx context.Context, req *connect.Request[api.CreateStatusRequest]) (*connect.Response[api.CreateStatusResponse], error) {
	status, err := c.service.Create(ctx, req.Msg.Code, req.Msg.Name, req.Msg.SortOrder, req.Msg.Terminal)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.CreateStatusResponse{Status: statusMessage(status)}), nil
}

func (c *StatusController) GetStatus(ctx context.Context, req *connect.Request[api.GetStatusRequest]) (*connect.Response[api.GetStatusResponse], error) {
	status, err := c.service.Get(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetStatusResponse{Status: statusMessage(status)}), nil
}

func (c *StatusController) ListStatuses(ctx context.Context, req *connect.Request[api.ListStatusesRequest]) (*connect.Response[api.ListStatusesResponse], error) {
	var after *models.StatusCursor
	if req.Msg.After != nil {
		after = &models.StatusCursor{SortOrder: req.Msg.After.SortOrder, ID: req.Msg.After.Id}
	}
	statuses, next, err := c.service.List(ctx, after, req.Msg.Active, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.ListStatusesResponse{}
	if next != nil {
		response.NextCursor = &api.StatusCursor{SortOrder: next.SortOrder, Id: next.ID}
	}
	for _, status := range statuses {
		response.Statuses = append(response.Statuses, statusMessage(status))
	}
	return connect.NewResponse(response), nil
}

func (c *StatusController) UpdateStatus(ctx context.Context, req *connect.Request[api.UpdateStatusRequest]) (*connect.Response[api.UpdateStatusResponse], error) {
	status, err := c.service.Update(ctx, req.Msg.Id, service.StatusUpdate{
		Code: req.Msg.Code, Name: req.Msg.Name, SortOrder: req.Msg.SortOrder, Active: req.Msg.Active, Terminal: req.Msg.Terminal,
	})
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateStatusResponse{Status: statusMessage(status)}), nil
}

func (c *StatusController) DeleteStatus(ctx context.Context, req *connect.Request[api.DeleteStatusRequest]) (*connect.Response[api.DeleteStatusResponse], error) {
	status, err := c.service.Delete(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.DeleteStatusResponse{Status: statusMessage(status)}), nil
}

func statusMessage(status models.Status) *entity.Status {
	return &entity.Status{
		Id: status.ID, Code: status.Code, Name: status.Name,
		SortOrder: status.SortOrder, Active: &status.Active, Terminal: &status.Terminal,
	}
}

func (c *StatusController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidStatus):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("status not found"))
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return connect.NewError(connect.CodeAlreadyExists, errors.New("status code already exists"))
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("status is referenced by other records"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("status operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("status operation failed"))
	}
}
