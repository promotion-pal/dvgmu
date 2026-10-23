package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entity "dvgmu/api/contract/gen/go/entity/v1"
	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type HallHandler struct {
	service *service.HallService
}

func HallNewController(service *service.HallService) *HallHandler {
	return &HallHandler{service: service}
}

func (h *HallHandler) HallFetch(
	ctx context.Context,
	req *connect.Request[pb.HallFetchRequest],
) (*connect.Response[pb.HallFetchResponse], error) {
	list, err := h.service.HallFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.HallFetchResponse{List: make([]*entity.Hall, 0, len(list))}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}

	return connect.NewResponse(resp), nil
}

// HallBookingFetch is the staff view: organizer and contact included.
func (h *HallHandler) HallBookingFetch(
	ctx context.Context,
	req *connect.Request[pb.HallBookingFetchRequest],
) (*connect.Response[pb.HallBookingFetchResponse], error) {
	return h.hallBookingFetch(ctx, req.Msg, (*models.HallBooking).ToProto)
}

// HallBookingPublicFetch is open without a login, so it never carries who
// booked the hall — only what is booked and when.
func (h *HallHandler) HallBookingPublicFetch(
	ctx context.Context,
	req *connect.Request[pb.HallBookingFetchRequest],
) (*connect.Response[pb.HallBookingFetchResponse], error) {
	return h.hallBookingFetch(ctx, req.Msg, (*models.HallBooking).ToPublicProto)
}

func (h *HallHandler) hallBookingFetch(
	ctx context.Context,
	msg *pb.HallBookingFetchRequest,
	toProto func(*models.HallBooking) *entity.HallBooking,
) (*connect.Response[pb.HallBookingFetchResponse], error) {
	list, err := h.service.HallBookingFetch(ctx, models.HallBookingFilter{
		HallID:   msg.GetHallId(),
		DateFrom: msg.GetDateFrom(),
		DateTo:   msg.GetDateTo(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.HallBookingFetchResponse{List: make([]*entity.HallBooking, 0, len(list))}
	for _, item := range list {
		resp.List = append(resp.List, toProto(item))
	}

	return connect.NewResponse(resp), nil
}

func (h *HallHandler) HallBookingCreate(
	ctx context.Context,
	req *connect.Request[pb.HallBookingCreateRequest],
) (*connect.Response[pb.HallBookingCreateResponse], error) {
	params := models.HallBookingCreateParams{
		HallID:    req.Msg.GetHallId(),
		Date:      req.Msg.GetDate(),
		TimeStart: req.Msg.GetTimeStart(),
		TimeEnd:   req.Msg.GetTimeEnd(),
		Title:     req.Msg.GetTitle(),
		Organizer: req.Msg.GetOrganizer(),
		Contact:   req.Msg.GetContact(),
		Consent:   req.Msg.GetPersonalDataConsent(),
	}

	id, err := h.service.HallBookingCreate(ctx, params)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrHallBookingInvalid):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		case errors.Is(err, models.ErrHallNotFound):
			return nil, connect.NewError(connect.CodeNotFound, err)
		case errors.Is(err, models.ErrHallBookingTaken):
			return nil, connect.NewError(connect.CodeAlreadyExists, err)
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&pb.HallBookingCreateResponse{
		Success:       true,
		Message:       "hall booking created",
		HallBookingId: id,
	}), nil
}

func (h *HallHandler) HallBookingDelete(
	ctx context.Context,
	req *connect.Request[pb.HallBookingDeleteRequest],
) (*connect.Response[pb.HallBookingDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.HallBookingDelete(ctx, req.Msg.GetId()); err != nil {
		if errors.Is(err, models.ErrHallBookingNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.HallBookingDeleteResponse{
		Success: true,
		Message: "hall booking deleted",
	}), nil
}
