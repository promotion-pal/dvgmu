package grpc

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"connectrpc.com/connect"
	"dvgmu/mdm/internal/domain/models"
	internalservice "dvgmu/mdm/internal/service"
	entity "fesmu/contract/mdm/entity"
	servicepb "fesmu/contract/mdm/service"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserController struct {
	service              *internalservice.UserService
	internalServiceToken string
	gatewaySharedSecret  string
}

const adminRole = "USER_ROLE_ADMIN"

func NewUserController(userService *internalservice.UserService, internalServiceToken, gatewaySharedSecret string) *UserController {
	return &UserController{service: userService, internalServiceToken: internalServiceToken, gatewaySharedSecret: gatewaySharedSecret}
}

func (c *UserController) UserFetch(ctx context.Context, req *connect.Request[servicepb.UserFetchRequest]) (*connect.Response[servicepb.UserFetchResponse], error) {
	if err := c.authorize(req.Header(), 0, true, false); err != nil {
		return nil, err
	}
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
	if err := c.authorize(req.Header(), req.Msg.GetId(), false, true); err != nil {
		return nil, err
	}
	user, err := c.service.FetchByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserFetchByIDResponse{User: user.ToProto()}), nil
}

func (c *UserController) UserCreate(ctx context.Context, req *connect.Request[servicepb.UserCreateRequest]) (*connect.Response[servicepb.UserCreateResponse], error) {
	if err := c.authorize(req.Header(), 0, true, false); err != nil {
		return nil, err
	}
	user, err := c.service.Create(ctx, userParams(req.Msg.GetFirstName(), req.Msg.GetLastName(), req.Msg.Patronymic, req.Msg.GetEmail(), req.Msg.Phone, req.Msg.GetBirthday()))
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserCreateResponse{User: user.ToProto()}), nil
}

func (c *UserController) UserUpdate(ctx context.Context, req *connect.Request[servicepb.UserUpdateRequest]) (*connect.Response[servicepb.UserUpdateResponse], error) {
	if err := c.authorize(req.Header(), 0, true, false); err != nil {
		return nil, err
	}
	user, err := c.service.Update(ctx, req.Msg.GetId(), userParams(req.Msg.GetFirstName(), req.Msg.GetLastName(), req.Msg.Patronymic, req.Msg.GetEmail(), req.Msg.Phone, req.Msg.GetBirthday()), req.Msg.GetStatus())
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserUpdateResponse{User: user.ToProto()}), nil
}

func (c *UserController) UserRolesSet(ctx context.Context, req *connect.Request[servicepb.UserRolesSetRequest]) (*connect.Response[servicepb.UserRolesSetResponse], error) {
	if err := c.authorize(req.Header(), 0, true, false); err != nil {
		return nil, err
	}
	user, err := c.service.RolesSet(ctx, req.Msg.GetId(), req.Msg.GetRoles())
	if err != nil {
		return nil, userError(err)
	}
	return connect.NewResponse(&servicepb.UserRolesSetResponse{User: user.ToProto()}), nil
}

func (c *UserController) authorize(header http.Header, targetUserID int64, adminOnly, allowInternalRead bool) error {
	internal := header.Get("X-Internal-Service-Token")
	if allowInternalRead && c.internalServiceToken != "" && subtle.ConstantTimeCompare([]byte(internal), []byte(c.internalServiceToken)) == 1 {
		return nil
	}
	shared := header.Get("X-Gateway-Secret")
	if c.gatewaySharedSecret == "" || subtle.ConstantTimeCompare([]byte(shared), []byte(c.gatewaySharedSecret)) != 1 {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("trusted gateway identity required"))
	}
	userID, err := strconv.ParseInt(header.Get("X-Authenticated-User-ID"), 10, 64)
	if err != nil || userID <= 0 {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("authenticated identity required"))
	}
	admin := false
	for _, role := range strings.Split(header.Get("X-Authenticated-Roles"), ",") {
		if role == adminRole {
			admin = true
			break
		}
	}
	if adminOnly && !admin || targetUserID > 0 && targetUserID != userID && !admin {
		return connect.NewError(connect.CodePermissionDenied, errors.New("not allowed to access this user"))
	}
	return nil
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
	case errors.Is(err, models.ErrInvalidRole):
		return connect.NewError(connect.CodeInvalidArgument, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
