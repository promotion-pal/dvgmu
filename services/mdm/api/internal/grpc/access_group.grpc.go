package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/mdm/service"
	"dvgmu/api/internal/domain/models"
)

func accessGroupError(err error) error {
	switch {
	case errors.Is(err, models.ErrAccessGroupName), errors.Is(err, models.ErrInvalidPermission):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrAccessGroupExists):
		return connect.NewError(connect.CodeAlreadyExists, err)
	case errors.Is(err, models.ErrAccessGroupNotFound), errors.Is(err, models.ErrUserNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	}
	return connect.NewError(connect.CodeInternal, err)
}

func (h *UserHandler) AccessGroupFetch(
	ctx context.Context,
	req *connect.Request[pb.AccessGroupFetchRequest],
) (*connect.Response[pb.AccessGroupFetchResponse], error) {
	groups, err := h.access.Fetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.AccessGroupFetchResponse{}
	for _, g := range groups {
		resp.Groups = append(resp.Groups, g.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *UserHandler) AccessGroupSave(
	ctx context.Context,
	req *connect.Request[pb.AccessGroupSaveRequest],
) (*connect.Response[pb.AccessGroupSaveResponse], error) {
	g, err := h.access.Save(ctx, req.Msg.GetId(), req.Msg.GetName(), req.Msg.GetDescription(), req.Msg.GetPermissions(), req.Msg.GetDepartments())
	if err != nil {
		return nil, accessGroupError(err)
	}
	return connect.NewResponse(&pb.AccessGroupSaveResponse{Group: g.ToProto()}), nil
}

func (h *UserHandler) AccessGroupDelete(
	ctx context.Context,
	req *connect.Request[pb.AccessGroupDeleteRequest],
) (*connect.Response[pb.AccessGroupDeleteResponse], error) {
	if err := h.access.Delete(ctx, req.Msg.GetId()); err != nil {
		return nil, accessGroupError(err)
	}
	return connect.NewResponse(&pb.AccessGroupDeleteResponse{}), nil
}

func (h *UserHandler) UserAccessGroupsSet(
	ctx context.Context,
	req *connect.Request[pb.UserAccessGroupsSetRequest],
) (*connect.Response[pb.UserAccessGroupsSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	user, err := h.access.UserGroupsSet(ctx, req.Msg.GetId(), req.Msg.GetGroupIds())
	if err != nil {
		return nil, accessGroupError(err)
	}
	return connect.NewResponse(&pb.UserAccessGroupsSetResponse{User: user.ToProto()}), nil
}
