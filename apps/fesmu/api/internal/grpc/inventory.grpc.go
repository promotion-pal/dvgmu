package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type InventoryHandler struct {
	service *service.InventoryService
}

func InventoryNewController(service *service.InventoryService) *InventoryHandler {
	return &InventoryHandler{service: service}
}

func (h *InventoryHandler) InventoryFetch(
	ctx context.Context,
	req *connect.Request[pb.InventoryFetchRequest],
) (*connect.Response[pb.InventoryFetchResponse], error) {
	list, err := h.service.InventoryFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.InventoryFetchResponse{}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}

	return connect.NewResponse(resp), nil
}

func (h *InventoryHandler) InventoryCreate(
	ctx context.Context,
	req *connect.Request[pb.InventoryCreateRequest],
) (*connect.Response[pb.InventoryCreateResponse], error) {
	if req.Msg.GetTitle() == "" || req.Msg.GetInventoryNumber() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("title and inventory_number are required"))
	}

	params := models.InventoryCreateParams{
		Title:             req.Msg.GetTitle(),
		Description:       req.Msg.GetDescription(),
		InventoryNumber:   req.Msg.GetInventoryNumber(),
		SerialNumber:      req.Msg.GetSerialNumber(),
		PurchasePrice:     req.Msg.GetPurchasePrice(),
		InfrastructureID:  req.Msg.GetInfrastructureId(),
		ResponsibleUserID: req.Msg.GetResponsibleUserId(),
		Status:            req.Msg.GetStatus(),
		Type:              req.Msg.GetType(),
	}
	if req.Msg.GetPurchaseDate() != nil {
		t := req.Msg.GetPurchaseDate().AsTime()
		params.PurchaseDate = &t
	}

	id, err := h.service.InventoryCreate(ctx, params)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InventoryCreateResponse{
		Success:     true,
		Message:     "inventory created",
		InventoryId: id,
	}), nil
}

func (h *InventoryHandler) InventoryByID(
	ctx context.Context,
	req *connect.Request[pb.InventoryByIDRequest],
) (*connect.Response[pb.InventoryByIDResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	item, err := h.service.InventoryByID(ctx, req.Msg.GetId())
	if err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InventoryByIDResponse{
		Entity: item.ToProto(),
	}), nil
}

func (h *InventoryHandler) InventoryUpdate(
	ctx context.Context,
	req *connect.Request[pb.InventoryUpdateRequest],
) (*connect.Response[pb.InventoryUpdateResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	params := models.InventoryCreateParams{
		Title:             req.Msg.GetTitle(),
		Description:       req.Msg.GetDescription(),
		InventoryNumber:   req.Msg.GetInventoryNumber(),
		SerialNumber:      req.Msg.GetSerialNumber(),
		PurchasePrice:     req.Msg.GetPurchasePrice(),
		InfrastructureID:  req.Msg.GetInfrastructureId(),
		ResponsibleUserID: req.Msg.GetResponsibleUserId(),
		Status:            req.Msg.GetStatus(),
		Type:              req.Msg.GetType(),
	}
	if req.Msg.GetPurchaseDate() != nil {
		t := req.Msg.GetPurchaseDate().AsTime()
		params.PurchaseDate = &t
	}

	if err := h.service.InventoryUpdate(ctx, req.Msg.GetId(), params); err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InventoryUpdateResponse{
		Success: true,
		Message: "inventory updated",
	}), nil
}

func (h *InventoryHandler) InventoryDelete(
	ctx context.Context,
	req *connect.Request[pb.InventoryDeleteRequest],
) (*connect.Response[pb.InventoryDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.InventoryDelete(ctx, req.Msg.GetId()); err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.InventoryDeleteResponse{
		Success: true,
		Message: "inventory deleted",
	}), nil
}
