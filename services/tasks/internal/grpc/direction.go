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

type DirectionController struct {
	service *service.DirectionService
	log     *slog.Logger
}

func NewDirectionController(service *service.DirectionService, log *slog.Logger) *DirectionController {
	return &DirectionController{service: service, log: log}
}

func (c *DirectionController) CreateDirection(ctx context.Context, req *connect.Request[api.CreateDirectionRequest]) (*connect.Response[api.CreateDirectionResponse], error) {
	direction, err := c.service.Create(ctx, req.Msg.Code, req.Msg.Name, req.Msg.SortOrder)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.CreateDirectionResponse{Direction: directionMessage(direction)}), nil
}

func (c *DirectionController) GetDirection(ctx context.Context, req *connect.Request[api.GetDirectionRequest]) (*connect.Response[api.GetDirectionResponse], error) {
	direction, err := c.service.Get(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetDirectionResponse{Direction: directionMessage(direction)}), nil
}

func (c *DirectionController) ListDirections(ctx context.Context, req *connect.Request[api.ListDirectionsRequest]) (*connect.Response[api.ListDirectionsResponse], error) {
	directions, next, err := c.service.List(ctx, req.Msg.AfterId, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.ListDirectionsResponse{NextAfterId: next}
	for _, direction := range directions {
		response.Directions = append(response.Directions, directionMessage(direction))
	}
	return connect.NewResponse(response), nil
}

func (c *DirectionController) UpdateDirection(ctx context.Context, req *connect.Request[api.UpdateDirectionRequest]) (*connect.Response[api.UpdateDirectionResponse], error) {
	direction, err := c.service.Update(ctx, req.Msg.Id, service.DirectionUpdate{
		Code: req.Msg.Code, Name: req.Msg.Name, SortOrder: req.Msg.SortOrder, Active: req.Msg.Active,
	})
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateDirectionResponse{Direction: directionMessage(direction)}), nil
}

func (c *DirectionController) DeleteDirection(ctx context.Context, req *connect.Request[api.DeleteDirectionRequest]) (*connect.Response[api.DeleteDirectionResponse], error) {
	direction, err := c.service.Delete(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.DeleteDirectionResponse{Direction: directionMessage(direction)}), nil
}

func directionMessage(direction models.Direction) *entity.Direction {
	return &entity.Direction{
		Id: direction.ID, Code: direction.Code, Name: direction.Name,
		SortOrder: direction.SortOrder, Active: &direction.Active,
	}
}

func (c *DirectionController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidDirection):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("direction not found"))
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return connect.NewError(connect.CodeAlreadyExists, errors.New("direction code already exists"))
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("direction is referenced by other records"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("direction operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("direction operation failed"))
	}
}
