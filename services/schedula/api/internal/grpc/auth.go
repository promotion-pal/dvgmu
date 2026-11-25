package grpc

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"slices"
	"strings"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/service"
	mdmenum "fesmu/contract/mdm/enum"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	schedulaconnect "fesmu/contract/schedula/service/serviceconnect"
)

type actorKey struct{}

func Authenticate(token string, directory mdmconnect.UserServiceClient) connect.UnaryInterceptorFunc {
	expected := sha256.Sum256([]byte("Bearer " + token))
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			actual := sha256.Sum256([]byte(req.Header().Get("Authorization")))
			if token == "" || subtle.ConstantTimeCompare(actual[:], expected[:]) != 1 {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("требуется служебный доступ"))
			}
			if req.Spec().Procedure == schedulaconnect.SchedulaServicePublicScheduleFetchProcedure {
				return next(ctx, req)
			}
			id := strings.TrimSpace(req.Header().Get("X-Schedula-User"))
			if id == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("требуется вход в личный кабинет"))
			}
			actor, err := actorFromMDM(ctx, directory, id, req.Spec().Procedure == schedulaconnect.SchedulaServiceScheduleFetchProcedure)
			if err != nil {
				return nil, err
			}
			return next(context.WithValue(ctx, actorKey{}, actor), req)
		}
	}
}

func actorFromMDM(ctx context.Context, directory mdmconnect.UserServiceClient, id string, needStudentGroup bool) (service.Actor, error) {
	response, err := directory.UserFetchByUUID(ctx, connect.NewRequest(&mdm.UserFetchByUUIDRequest{Uuid: id}))
	if connect.CodeOf(err) == connect.CodeNotFound {
		return service.Actor{}, connect.NewError(connect.CodePermissionDenied, errors.New("учётная запись недоступна"))
	}
	if err != nil {
		return service.Actor{}, directoryUnavailable()
	}
	user := response.Msg.GetUser()
	if user.GetStatus() != mdmenum.UserStatus_USER_STATUS_ACTIVE {
		return service.Actor{}, connect.NewError(connect.CodePermissionDenied, errors.New("учётная запись недоступна"))
	}
	roles := user.GetRoles()
	perms := response.Msg.GetEffectivePermissions()
	admin := slices.Contains(roles, mdmenum.UserRole_USER_ROLE_ADMIN)
	student := slices.Contains(roles, mdmenum.UserRole_USER_ROLE_STUDENT)
	teacher := slices.Contains(roles, mdmenum.UserRole_USER_ROLE_TEACHER)
	staff := slices.Contains(roles, mdmenum.UserRole_USER_ROLE_STAFF)
	canEdit := admin || (staff || teacher) && slices.Contains(perms, "schedule.post")
	canFindSlots := canEdit || (staff || teacher) && (slices.Contains(perms, "computer_classes.fetch") || slices.Contains(perms, "computer_classes.post"))
	if !student && !teacher && !staff && !canEdit && !canFindSlots {
		return service.Actor{}, connect.NewError(connect.CodePermissionDenied, errors.New("недостаточно прав"))
	}
	actor := service.Actor{ID: id, Student: student, Teacher: teacher, CanEdit: canEdit, CanFindSlots: canFindSlots}
	if student && needStudentGroup {
		profile, err := directory.UserFetchByID(ctx, connect.NewRequest(&mdm.UserFetchByIDRequest{Id: user.GetId()}))
		if err != nil {
			return service.Actor{}, directoryUnavailable()
		}
		student := profile.Msg.GetProfile().GetStudent()
		switch student.GetStatus() {
		case mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING, mdmenum.UserStudentStatus_USER_STUDENT_STATUS_RESTORED:
			actor.Group = strings.TrimSpace(student.GetGroup())
		}
	}
	return actor, nil
}

func directoryUnavailable() error {
	return connect.NewError(connect.CodeUnavailable, errors.New("справочник пользователей недоступен"))
}

func actorFromContext(ctx context.Context) service.Actor {
	actor, _ := ctx.Value(actorKey{}).(service.Actor)
	return actor
}

func require(allowed bool) error {
	if !allowed {
		return connect.NewError(connect.CodePermissionDenied, errors.New("недостаточно прав"))
	}
	return nil
}
