package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type ScheduleCollectHandler struct {
	service *service.ScheduleCollectService
}

func ScheduleCollectNewController(service *service.ScheduleCollectService) *ScheduleCollectHandler {
	return &ScheduleCollectHandler{service: service}
}

func (h *ScheduleCollectHandler) ScheduleCollectCreate(
	ctx context.Context,
	req *connect.Request[pb.ScheduleCollectCreateRequest],
) (*connect.Response[pb.ScheduleCollectCreateResponse], error) {
	if err := auth.RequireRole(ctx, auth.RoleTeacher); err != nil {
		return nil, err
	}
	user, _ := auth.UserFromContext(ctx)
	item, err := h.service.ScheduleCollectCreate(ctx, user.UUID, req.Msg.GetItem())
	if err != nil {
		if errors.Is(err, models.ErrScheduleCollectInvalid) {
			// A validation problem is expected input from the person filling
			// the form in, not a transport failure — answer with success=false
			// and the reason instead of an RPC error.
			return connect.NewResponse(&pb.ScheduleCollectCreateResponse{
				Success: false,
				Message: err.Error(),
			}), nil
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("не удалось сохранить переданные сведения"))
	}

	return connect.NewResponse(&pb.ScheduleCollectCreateResponse{
		Success: true,
		Message: "запись добавлена",
		Item:    item,
	}), nil
}

func (h *ScheduleCollectHandler) ScheduleCollectFetch(
	ctx context.Context,
	req *connect.Request[pb.ScheduleCollectFetchRequest],
) (*connect.Response[pb.ScheduleCollectFetchResponse], error) {
	if err := auth.RequireCan(ctx, auth.SectionScheduleIntake, auth.ActionFetch); err != nil {
		return nil, err
	}
	items, hasMore, err := h.service.ScheduleCollectFetch(ctx, req.Msg.GetOffset())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("не удалось загрузить переданные сведения"))
	}
	return connect.NewResponse(&pb.ScheduleCollectFetchResponse{Items: items, HasMore: hasMore}), nil
}
