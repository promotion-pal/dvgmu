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

type PriorityController struct {
	service *service.PriorityService
	log     *slog.Logger
}

func NewPriorityController(service *service.PriorityService, log *slog.Logger) *PriorityController {
	return &PriorityController{service: service, log: log}
}

func (c *PriorityController) CreatePriority(ctx context.Context, req *connect.Request[api.CreatePriorityRequest]) (*connect.Response[api.CreatePriorityResponse], error) {
	priority, err := c.service.Create(ctx, req.Msg.Code, req.Msg.Name, req.Msg.SortOrder)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.CreatePriorityResponse{Priority: priorityMessage(priority)}), nil
}

func (c *PriorityController) GetPriority(ctx context.Context, req *connect.Request[api.GetPriorityRequest]) (*connect.Response[api.GetPriorityResponse], error) {
	priority, err := c.service.Get(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetPriorityResponse{Priority: priorityMessage(priority)}), nil
}

func (c *PriorityController) ListPriorities(ctx context.Context, req *connect.Request[api.ListPrioritiesRequest]) (*connect.Response[api.ListPrioritiesResponse], error) {
	var after *models.PriorityCursor
	if req.Msg.After != nil {
		after = &models.PriorityCursor{SortOrder: req.Msg.After.SortOrder, ID: req.Msg.After.Id}
	}
	priorities, next, err := c.service.List(ctx, after, req.Msg.Active, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.ListPrioritiesResponse{}
	if next != nil {
		response.NextCursor = &api.PriorityCursor{SortOrder: next.SortOrder, Id: next.ID}
	}
	for _, priority := range priorities {
		response.Priorities = append(response.Priorities, priorityMessage(priority))
	}
	return connect.NewResponse(response), nil
}

func (c *PriorityController) UpdatePriority(ctx context.Context, req *connect.Request[api.UpdatePriorityRequest]) (*connect.Response[api.UpdatePriorityResponse], error) {
	priority, err := c.service.Update(ctx, req.Msg.Id, service.PriorityUpdate{
		Code: req.Msg.Code, Name: req.Msg.Name, SortOrder: req.Msg.SortOrder, Active: req.Msg.Active,
	})
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdatePriorityResponse{Priority: priorityMessage(priority)}), nil
}

func (c *PriorityController) DeletePriority(ctx context.Context, req *connect.Request[api.DeletePriorityRequest]) (*connect.Response[api.DeletePriorityResponse], error) {
	priority, err := c.service.Delete(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.DeletePriorityResponse{Priority: priorityMessage(priority)}), nil
}

func priorityMessage(priority models.Priority) *entity.Priority {
	return &entity.Priority{
		Id: priority.ID, Code: priority.Code, Name: priority.Name,
		SortOrder: priority.SortOrder, Active: &priority.Active,
	}
}

func (c *PriorityController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidPriority):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("priority not found"))
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return connect.NewError(connect.CodeAlreadyExists, errors.New("priority code already exists"))
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("priority is referenced by other records"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("priority operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("priority operation failed"))
	}
}
