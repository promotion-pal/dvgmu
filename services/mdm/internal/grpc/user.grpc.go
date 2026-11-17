package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"dvgmu/mdm/internal/domain/models"
	internalservice "dvgmu/mdm/internal/service"
	entity "fesmu/contract/mdm/entity"
	servicepb "fesmu/contract/mdm/service"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserController struct {
	service *internalservice.UserService
}

func NewUserController(userService *internalservice.UserService) *UserController {
	return &UserController{service: userService}
}

func (c *UserController) UserFetch(ctx context.Context, _ *connect.Request[servicepb.UserFetchRequest]) (*connect.Response[servicepb.UserFetchResponse], error) {
	users, err := c.service.Fetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	response := &servicepb.UserFetchResponse{Users: make([]*entity.User, 0, len(users))}
	for i := range users {
		response.Users = append(response.Users, users[i].ToProto())
	}
	return connect.NewResponse(response), nil
}

func (c *UserController) UserFetchByID(ctx context.Context, req *connect.Request[servicepb.UserFetchByIDRequest]) (*connect.Response[servicepb.UserFetchByIDResponse], error) {
	user, err := c.service.FetchByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserFetchByIDResponse{User: user.ToProto()}), nil
}

func (c *UserController) UserCreate(ctx context.Context, req *connect.Request[servicepb.UserCreateRequest]) (*connect.Response[servicepb.UserCreateResponse], error) {
	user, err := c.service.Create(ctx, userParams(req.Msg.GetFirstName(), req.Msg.GetLastName(), req.Msg.Patronymic, req.Msg.GetEmail(), req.Msg.Phone, req.Msg.GetBirthday()))
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserCreateResponse{User: user.ToProto()}), nil
}

func (c *UserController) UserUpdate(ctx context.Context, req *connect.Request[servicepb.UserUpdateRequest]) (*connect.Response[servicepb.UserUpdateResponse], error) {
	user, err := c.service.Update(ctx, req.Msg.GetId(), userParams(req.Msg.GetFirstName(), req.Msg.GetLastName(), req.Msg.Patronymic, req.Msg.GetEmail(), req.Msg.Phone, req.Msg.GetBirthday()), req.Msg.GetStatus())
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserUpdateResponse{User: user.ToProto()}), nil
}

func userParams(firstName, lastName string, patronymic *string, email string, phone *string, birthday *timestamppb.Timestamp) models.UserCreateParams {
	params := models.UserCreateParams{
		FirstName: firstName,
		LastName:  lastName,
	}
	if patronymic != nil {
		params.Patronymic = *patronymic
	}
	params.Email = email
	if phone != nil {
		params.Phone = phone
	}
	if birthday != nil {
		value := birthday.AsTime()
		params.Birthday = &value
	}
	return params
}

func userError(err error) error {
	switch {
	case errors.Is(err, models.ErrUserNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, models.ErrUserAlreadyExists):
		return connect.NewError(connect.CodeAlreadyExists, err)
	case errors.Is(err, models.ErrInvalidUser):
		return connect.NewError(connect.CodeInvalidArgument, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
