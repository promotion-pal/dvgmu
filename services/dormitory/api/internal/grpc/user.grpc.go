package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"dvgmu/analytics/contract/gen/go/entity"
	pb "dvgmu/analytics/contract/gen/go/service"
	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/service"
)

type UserHandler struct {
	service *service.UserService
}

func UserNewController(service *service.UserService) *UserHandler {
	return &UserHandler{service: service}
}

func (h *UserHandler) UserFetch(
	ctx context.Context,
	req *connect.Request[pb.UserFetchRequest],
) (*connect.Response[pb.UserFetchResponse], error) {
	users, err := h.service.Fetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoUsers := make([]*entity.User, 0, len(users))
	for i := range users {
		protoUsers = append(protoUsers, toProtoUser(&users[i]))
	}

	return connect.NewResponse(&pb.UserFetchResponse{
		Users: protoUsers,
	}), nil
}

func (h *UserHandler) UserCreate(
	ctx context.Context,
	req *connect.Request[pb.UserCreateRequest],
) (*connect.Response[pb.UserCreateResponse], error) {
	if req.Msg.GetPhone() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("phone is required"))
	}
	if req.Msg.GetLastName() == "" || req.Msg.GetFirstName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("lastName and firstName are required"))
	}

	user := &models.User{
		Phone:      req.Msg.GetPhone(),
		LastName:   req.Msg.GetLastName(),
		FirstName:  req.Msg.GetFirstName(),
		Patronymic: req.Msg.GetPatronymic(),
		RecordBook: req.Msg.GetRecordBook(),
		Group:      req.Msg.GetGroup(),
	}

	id, err := h.service.Create(ctx, user)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserCreateResponse{
		Success: true,
		Message: "user created",
		Id:      id,
	}), nil
}

func toProtoUser(user *models.User) *entity.User {
	return &entity.User{
		Id:         user.ID,
		Phone:      user.Phone,
		LastName:   user.LastName,
		FirstName:  user.FirstName,
		Patronymic: user.Patronymic,
		RecordBook: user.RecordBook,
		Group:      user.Group,
		CreatedAt:  timestamppb.New(user.CreatedAt),
		UpdatedAt:  timestamppb.New(user.UpdatedAt),
	}
}
