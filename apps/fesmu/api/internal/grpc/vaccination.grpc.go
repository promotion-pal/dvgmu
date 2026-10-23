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

type VaccinationHandler struct {
	service *service.VaccinationService
}

func VaccinationNewController(service *service.VaccinationService) *VaccinationHandler {
	return &VaccinationHandler{service: service}
}

func (h *VaccinationHandler) VaccinationDayFetch(
	ctx context.Context,
	req *connect.Request[pb.VaccinationDayFetchRequest],
) (*connect.Response[pb.VaccinationDayFetchResponse], error) {
	list, err := h.service.VaccinationDayFetch(ctx, req.Msg.GetDateFrom())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.VaccinationDayFetchResponse{List: make([]*entity.VaccinationDay, 0, len(list))}
	for _, day := range list {
		resp.List = append(resp.List, day.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *VaccinationHandler) VaccinationDayCreate(
	ctx context.Context,
	req *connect.Request[pb.VaccinationDayCreateRequest],
) (*connect.Response[pb.VaccinationDayCreateResponse], error) {
	id, err := h.service.VaccinationDayCreate(ctx, models.VaccinationDayParams{
		Date:  req.Msg.GetDate(),
		Title: req.Msg.GetTitle(),
		Place: req.Msg.GetPlace(),
		Note:  req.Msg.GetNote(),
	})
	if err != nil {
		return nil, vaccinationConnectError(err)
	}
	return connect.NewResponse(&pb.VaccinationDayCreateResponse{Success: true, Message: "vaccination day created", VaccinationDayId: id}), nil
}

func (h *VaccinationHandler) VaccinationDayDelete(
	ctx context.Context,
	req *connect.Request[pb.VaccinationDayDeleteRequest],
) (*connect.Response[pb.VaccinationDayDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if err := h.service.VaccinationDayDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, vaccinationConnectError(err)
	}
	return connect.NewResponse(&pb.VaccinationDayDeleteResponse{Success: true, Message: "vaccination day deleted"}), nil
}

func (h *VaccinationHandler) VaccinationSignupCreate(
	ctx context.Context,
	req *connect.Request[pb.VaccinationSignupCreateRequest],
) (*connect.Response[pb.VaccinationSignupCreateResponse], error) {
	id, err := h.service.VaccinationSignupCreate(ctx, req.Msg.GetSlotId(), req.Msg.GetFullName(), req.Msg.GetPersonalDataConsent())
	if err != nil {
		return nil, vaccinationConnectError(err)
	}
	return connect.NewResponse(&pb.VaccinationSignupCreateResponse{Success: true, Message: "вы записаны", VaccinationSignupId: id}), nil
}

func (h *VaccinationHandler) VaccinationSignupDelete(
	ctx context.Context,
	req *connect.Request[pb.VaccinationSignupDeleteRequest],
) (*connect.Response[pb.VaccinationSignupDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if err := h.service.VaccinationSignupDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, vaccinationConnectError(err)
	}
	return connect.NewResponse(&pb.VaccinationSignupDeleteResponse{Success: true, Message: "vaccination signup deleted"}), nil
}

func vaccinationConnectError(err error) error {
	switch {
	case errors.Is(err, models.ErrVaccinationInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrVaccinationDayNotFound),
		errors.Is(err, models.ErrVaccinationSlotNotFound),
		errors.Is(err, models.ErrVaccinationSignupNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, models.ErrVaccinationSlotFull):
		return connect.NewError(connect.CodeResourceExhausted, err)
	case errors.Is(err, models.ErrVaccinationAlreadySignedUp):
		return connect.NewError(connect.CodeAlreadyExists, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
