package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

// ScheduleCollectHandler serves the public collector page. A teacher has no
// account in this system, so its procedure is exempted from auth (see app.New).
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
	item, err := h.service.ScheduleCollectCreate(ctx, req.Msg.GetItem())
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
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.ScheduleCollectCreateResponse{
		Success: true,
		Message: "запись добавлена",
		Item:    item,
	}), nil
}
