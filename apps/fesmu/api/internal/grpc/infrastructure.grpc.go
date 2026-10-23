package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type InfrastructureHandler struct {
	service *service.InfrastructureService
}

func InfrastructureNewController(service *service.InfrastructureService) *InfrastructureHandler {
	return &InfrastructureHandler{service: service}
}

func (h *InfrastructureHandler) InfrastructureFetch(
	ctx context.Context,
	req *connect.Request[pb.InfrastructureFetchRequest],
) (*connect.Response[pb.InfrastructureFetchResponse], error) {
	list, err := h.service.InfrastructureFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.InfrastructureFetchResponse{}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}

	return connect.NewResponse(resp), nil
}

func (h *InfrastructureHandler) InfrastructureCreate(
	ctx context.Context,
	req *connect.Request[pb.InfrastructureCreateRequest],
) (*connect.Response[pb.InfrastructureCreateResponse], error) {
	if req.Msg.GetTitle() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("title is required"))
	}

	params := models.InfrastructureCreateParams{
		Title:       req.Msg.GetTitle(),
		Description: req.Msg.GetDescription(),
		Floor:       req.Msg.GetFloor(),
		Room:        req.Msg.GetRoom(),
		Location:    req.Msg.GetLocation(),
	}

	id, err := h.service.InfrastructureCreate(ctx, params)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InfrastructureCreateResponse{
		Success:          true,
		Message:          "infrastructure created",
		InfrastructureId: id,
	}), nil
}

func (h *InfrastructureHandler) InfrastructureByID(
	ctx context.Context,
	req *connect.Request[pb.InfrastructureByIDRequest],
) (*connect.Response[pb.InfrastructureByIDResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	item, err := h.service.InfrastructureByID(ctx, req.Msg.GetId())
	if err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InfrastructureByIDResponse{
		Item: item.ToProto(),
	}), nil
}

func (h *InfrastructureHandler) InfrastructureUpdate(
	ctx context.Context,
	req *connect.Request[pb.InfrastructureUpdateRequest],
) (*connect.Response[pb.InfrastructureUpdateResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	params := models.InfrastructureCreateParams{
		Title:       req.Msg.GetTitle(),
		Description: req.Msg.GetDescription(),
		Floor:       req.Msg.GetFloor(),
		Room:        req.Msg.GetRoom(),
	}

	if err := h.service.InfrastructureUpdate(ctx, req.Msg.GetId(), params); err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InfrastructureUpdateResponse{
		Success: true,
		Message: "infrastructure updated",
	}), nil
}

func (h *InfrastructureHandler) InfrastructureDelete(
	ctx context.Context,
	req *connect.Request[pb.InfrastructureDeleteRequest],
) (*connect.Response[pb.InfrastructureDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.InfrastructureDelete(ctx, req.Msg.GetId()); err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InfrastructureDeleteResponse{
		Success: true,
		Message: "infrastructure deleted",
	}), nil
}
