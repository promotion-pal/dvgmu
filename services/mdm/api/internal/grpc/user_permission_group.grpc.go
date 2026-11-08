package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"dvgmu/api/internal/domain/models"
	pb "fesmu/contract/mdm/service"
)

func userPermissionGroupError(err error) error {
	switch {
	case errors.Is(err, models.ErrUserPermissionGroupName), errors.Is(err, models.ErrInvalidPermission):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrUserPermissionGroupExists):
		return connect.NewError(connect.CodeAlreadyExists, err)
	case errors.Is(err, models.ErrUserPermissionGroupNotFound), errors.Is(err, models.ErrUserNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	}
	return connect.NewError(connect.CodeInternal, err)
}

func (h *UserHandler) UserPermissionGroupFetch(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionGroupFetchRequest],
) (*connect.Response[pb.UserPermissionGroupFetchResponse], error) {
	groups, err := h.userPermissionGroups.Fetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.UserPermissionGroupFetchResponse{}
	for _, g := range groups {
		resp.Groups = append(resp.Groups, g.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *UserHandler) UserPermissionGroupSave(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionGroupSaveRequest],
) (*connect.Response[pb.UserPermissionGroupSaveResponse], error) {
	g, err := h.userPermissionGroups.Save(ctx, req.Msg.GetId(), req.Msg.GetName(), req.Msg.GetDescription(), req.Msg.GetPermissions())
	if err != nil {
		return nil, userPermissionGroupError(err)
	}
	return connect.NewResponse(&pb.UserPermissionGroupSaveResponse{Group: g.ToProto()}), nil
}

func (h *UserHandler) UserPermissionGroupDelete(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionGroupDeleteRequest],
) (*connect.Response[pb.UserPermissionGroupDeleteResponse], error) {
	if err := h.userPermissionGroups.Delete(ctx, req.Msg.GetId()); err != nil {
		return nil, userPermissionGroupError(err)
	}
	return connect.NewResponse(&pb.UserPermissionGroupDeleteResponse{}), nil
}

func (h *UserHandler) UserPermissionGroupsSet(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionGroupsSetRequest],
) (*connect.Response[pb.UserPermissionGroupsSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	user, err := h.userPermissionGroups.UserPermissionGroupsSet(ctx, req.Msg.GetId(), req.Msg.GetGroupIds())
	if err != nil {
		return nil, userPermissionGroupError(err)
	}
	return connect.NewResponse(&pb.UserPermissionGroupsSetResponse{User: user.ToProto()}), nil
}

func (h *UserHandler) UserPermissionGroupAssignmentsFetch(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionGroupAssignmentsFetchRequest],
) (*connect.Response[pb.UserPermissionGroupAssignmentsFetchResponse], error) {
	assignments, err := h.userPermissionGroups.FetchAssignments(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.UserPermissionGroupAssignmentsFetchResponse{}
	for _, assignment := range assignments {
		resp.Assignments = append(resp.Assignments, &pb.UserPermissionGroupAssignment{
			UserId:  assignment.UserID,
			GroupId: assignment.GroupID,
		})
	}
	return connect.NewResponse(resp), nil
}
