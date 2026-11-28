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
	portal "fesmu/contract/fesmu/enum/v1"
	mdmenum "fesmu/contract/mdm/enum"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	schedulaconnect "fesmu/contract/schedula/service/serviceconnect"
)

type actorKey struct{}

func Authenticate(token string, users mdmconnect.UserServiceClient, directory mdmconnect.UserDirectoryServiceClient) connect.UnaryInterceptorFunc {
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
			actor, err := actorFromMDM(ctx, users, directory, id, req.Spec().Procedure == schedulaconnect.SchedulaServiceScheduleFetchProcedure)
			if err != nil {
				return nil, err
			}
			return next(context.WithValue(ctx, actorKey{}, actor), req)
		}
	}
}

func actorFromMDM(ctx context.Context, users mdmconnect.UserServiceClient, directory mdmconnect.UserDirectoryServiceClient, id string, needStudentGroups bool) (service.Actor, error) {
	response, err := users.UserFetchByUUID(ctx, connect.NewRequest(&mdm.UserFetchByUUIDRequest{Uuid: id}))
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
	can := func(section portal.PermissionSection, write bool) bool {
		name := strings.ToLower(strings.TrimPrefix(section.String(), "PERMISSION_SECTION_"))
		return admin || slices.Contains(perms, name+".post") || !write && slices.Contains(perms, name+".fetch")
	}
	actor := service.Actor{
		ID: id, Student: student, Teacher: teacher,
		CanEdit:          can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_DRAFTS, true),
		CanPublish:       can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_PUBLICATION, true),
		CanReviewChanges: can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_CHANGES, true),
		CanEditCatalog:   can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_CATALOG, true),
		CanViewReports:   can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_REPORTS, false),
	}
	actor.CanFindSlots = actor.CanEdit || can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE_TESTING, false)
	if !student && !teacher && !actor.CanSeeDrafts() && !actor.CanReviewChanges && !actor.CanEditCatalog &&
		!actor.CanFindSlots && !can(portal.PermissionSection_PERMISSION_SECTION_SCHEDULE, false) {
		return service.Actor{}, connect.NewError(connect.CodePermissionDenied, errors.New("недостаточно прав"))
	}
	if student && needStudentGroups {
		groups, err := studentGroups(ctx, directory, id)
		if err != nil {
			return service.Actor{}, err
		}
		actor.Groups = groups
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
