package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type ScheduleHandler struct {
	service *service.ScheduleService
}

func ScheduleNewController(service *service.ScheduleService) *ScheduleHandler {
	return &ScheduleHandler{service: service}
}

func (h *ScheduleHandler) ScheduleFetch(
	ctx context.Context,
	req *connect.Request[pb.ScheduleFetchRequest],
) (*connect.Response[pb.ScheduleFetchResponse], error) {
	list, err := h.service.ScheduleFetch(ctx, models.ScheduleFilter{
		ProgramID: req.Msg.GetProgramId(),
		Course:    req.Msg.GetCourse(),
	})
	if err != nil {
		return nil, scheduleConnectError(err)
	}

	return connect.NewResponse(&pb.ScheduleFetchResponse{List: list}), nil
}

func (h *ScheduleHandler) ScheduleByID(
	ctx context.Context,
	req *connect.Request[pb.ScheduleByIDRequest],
) (*connect.Response[pb.ScheduleByIDResponse], error) {
	if req.Msg.GetId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	item, err := h.service.ScheduleByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, scheduleConnectError(err)
	}

	return connect.NewResponse(&pb.ScheduleByIDResponse{Item: item}), nil
}

func (h *ScheduleHandler) ScheduleCreate(
	ctx context.Context,
	req *connect.Request[pb.ScheduleCreateRequest],
) (*connect.Response[pb.ScheduleCreateResponse], error) {
	id, err := h.service.ScheduleCreate(ctx, req.Msg.GetItem())
	if err != nil {
		return nil, scheduleConnectError(err)
	}

	return connect.NewResponse(&pb.ScheduleCreateResponse{
		Success:    true,
		Message:    "schedule created",
		ScheduleId: id,
	}), nil
}

func (h *ScheduleHandler) ScheduleUpdate(
	ctx context.Context,
	req *connect.Request[pb.ScheduleUpdateRequest],
) (*connect.Response[pb.ScheduleUpdateResponse], error) {
	if err := h.service.ScheduleUpdate(ctx, req.Msg.GetItem()); err != nil {
		return nil, scheduleConnectError(err)
	}

	return connect.NewResponse(&pb.ScheduleUpdateResponse{
		Success: true,
		Message: "schedule updated",
	}), nil
}

func (h *ScheduleHandler) ScheduleDelete(
	ctx context.Context,
	req *connect.Request[pb.ScheduleDeleteRequest],
) (*connect.Response[pb.ScheduleDeleteResponse], error) {
	if req.Msg.GetId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.ScheduleDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, scheduleConnectError(err)
	}

	return connect.NewResponse(&pb.ScheduleDeleteResponse{
		Success: true,
		Message: "schedule deleted",
	}), nil
}

func scheduleConnectError(err error) error {
	switch {
	case errors.Is(err, models.ErrScheduleInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrScheduleNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
