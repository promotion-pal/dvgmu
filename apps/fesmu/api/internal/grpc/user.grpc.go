package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"

	entity "dvgmu/api/contract/gen/go/entity/v1"
	enum "dvgmu/api/contract/gen/go/enum/v1"
	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/mdm"
)

// roleByName maps the role names in the auth token (set in MDM) to fesmu's
// own enum; unknown names are dropped.
var roleByName = map[string]enum.UserRole{
	auth.RoleAdmin:   enum.UserRole_USER_ROLE_ADMIN,
	auth.RoleStaff:   enum.UserRole_USER_ROLE_STAFF,
	auth.RoleStudent: enum.UserRole_USER_ROLE_STUDENT,
	auth.RoleTeacher: enum.UserRole_USER_ROLE_TEACHER,
}

// Profiles reads the MDM record behind the session (name, email, id).
type Profiles interface {
	ByUUID(ctx context.Context, uuid string) (*mdm.User, error)
}

type UserHandler struct {
	// nil when PACKAGE_MDM isn't set: UserMe then answers without a name.
	profiles Profiles
	log      *slog.Logger
}

func UserNewController(profiles Profiles, log *slog.Logger) *UserHandler {
	return &UserHandler{profiles: profiles, log: log}
}

// UserMe — the signed-in user: uuid, login and roles from the access token,
// name, email and MDM id from MDM. Without a session the interceptor answers
// Unauthenticated before this; the frontend asks auth's /me why.
func (h *UserHandler) UserMe(
	ctx context.Context,
	_ *connect.Request[pb.UserMeRequest],
) (*connect.Response[pb.UserMeResponse], error) {
	login, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}

	roles := make([]enum.UserRole, 0, len(login.Roles))
	for _, name := range login.Roles {
		if r, ok := roleByName[name]; ok {
			roles = append(roles, r)
		}
	}
	resp := &pb.UserMeResponse{
		User:     &entity.User{Uuid: login.UUID, Roles: roles, Permissions: login.Permissions},
		Username: login.Username,
	}

	// An unreachable MDM costs the name, not the login.
	if h.profiles != nil {
		profile, err := h.profiles.ByUUID(ctx, login.UUID)
		if err != nil {
			h.log.Warn("user: mdm profile unavailable", "uuid", login.UUID, "error", err.Error())
		} else {
			resp.User.Id = profile.ID
			resp.User.MdmId = profile.ID
			resp.FirstName = profile.FirstName
			resp.LastName = profile.LastName
			resp.Email = profile.Email
		}
	}
	return connect.NewResponse(resp), nil
}
