package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entity "fesmu/contract/fesmu/entity/v1"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type ComputerClassHandler struct {
	service *service.ComputerClassService
}

func ComputerClassNewController(service *service.ComputerClassService) *ComputerClassHandler {
	return &ComputerClassHandler{service: service}
}

func (h *ComputerClassHandler) ComputerClassSessionFetch(
	ctx context.Context,
	req *connect.Request[pb.ComputerClassSessionFetchRequest],
) (*connect.Response[pb.ComputerClassSessionFetchResponse], error) {
	list, err := h.service.ComputerClassSessionFetch(ctx, models.ComputerClassSessionFilter{
		Room:     req.Msg.GetRoom(),
		DateFrom: req.Msg.GetDateFrom(),
		DateTo:   req.Msg.GetDateTo(),
		Kind:     req.Msg.GetKind(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.ComputerClassSessionFetchResponse{List: make([]*entity.ComputerClassSession, 0, len(list))}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *ComputerClassHandler) ComputerClassSessionCreate(
	ctx context.Context,
	req *connect.Request[pb.ComputerClassSessionCreateRequest],
) (*connect.Response[pb.ComputerClassSessionCreateResponse], error) {
	id, err := h.service.ComputerClassSessionCreate(ctx, models.ComputerClassSessionParams{
		Date:      req.Msg.GetDate(),
		TimeStart: req.Msg.GetTimeStart(),
		TimeEnd:   req.Msg.GetTimeEnd(),
		Room:      req.Msg.GetRoom(),
		Kind:      req.Msg.GetKind(),
		Title:     req.Msg.GetTitle(),
		Groups:    req.Msg.GetGroups(),
		Note:      req.Msg.GetNote(),
	})
	if err != nil {
		return nil, computerClassConnectError(err)
	}

	return connect.NewResponse(&pb.ComputerClassSessionCreateResponse{
		Success:                true,
		Message:                "computer class session created",
		ComputerClassSessionId: id,
	}), nil
}

func (h *ComputerClassHandler) ComputerClassSessionUpdate(
	ctx context.Context,
	req *connect.Request[pb.ComputerClassSessionUpdateRequest],
) (*connect.Response[pb.ComputerClassSessionUpdateResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	err := h.service.ComputerClassSessionUpdate(ctx, req.Msg.GetId(), models.ComputerClassSessionParams{
		Date:      req.Msg.GetDate(),
		TimeStart: req.Msg.GetTimeStart(),
		TimeEnd:   req.Msg.GetTimeEnd(),
		Room:      req.Msg.GetRoom(),
		Kind:      req.Msg.GetKind(),
		Title:     req.Msg.GetTitle(),
		Groups:    req.Msg.GetGroups(),
		Note:      req.Msg.GetNote(),
	})
	if err != nil {
		return nil, computerClassConnectError(err)
	}

	return connect.NewResponse(&pb.ComputerClassSessionUpdateResponse{
		Success: true,
		Message: "computer class session updated",
	}), nil
}

func (h *ComputerClassHandler) ComputerClassSessionDelete(
	ctx context.Context,
	req *connect.Request[pb.ComputerClassSessionDeleteRequest],
) (*connect.Response[pb.ComputerClassSessionDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.ComputerClassSessionDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, computerClassConnectError(err)
	}

	return connect.NewResponse(&pb.ComputerClassSessionDeleteResponse{
		Success: true,
		Message: "computer class session deleted",
	}), nil
}

func computerClassConnectError(err error) error {
	switch {
	case errors.Is(err, models.ErrComputerClassSessionInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrComputerClassSessionNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
