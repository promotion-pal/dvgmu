package grpc

import (
	"context"
	"crypto/subtle"
	"errors"
	"strconv"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	authv1 "dvgmu/auth/contract/gen/go/auth/v1"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/service"
)

// IdentityV1Handler — адаптер старого API (contract.auth.service) поверх
// текущего IdentityService. Своей логики не держит: только переводит
// запросы/ответы v1 в вызовы сервиса. Удаляется вместе с auth/v1/identity.proto,
// когда sync переедет на v2.
type IdentityV1Handler struct {
	service       *service.IdentityService
	internalToken string
}

func IdentityV1NewController(svc *service.IdentityService, internalToken string) *IdentityV1Handler {
	return &IdentityV1Handler{service: svc, internalToken: internalToken}
}

func (h *IdentityV1Handler) ByGUID(
	ctx context.Context,
	req *connect.Request[authv1.IdentityByGUIDRequest],
) (*connect.Response[authv1.IdentityResponse], error) {
	identity, err := h.service.ByGUID(ctx, req.Msg.GetObjectGuid())
	if err != nil {
		return nil, identityError(err)
	}
	return connect.NewResponse(&authv1.IdentityResponse{Identity: identityToV1(identity)}), nil
}

// List в v1 был курсорным (page_token), в v2 — постраничный. Токен для
// клиента непрозрачный, поэтому кладём в него номер следующей страницы.
func (h *IdentityV1Handler) List(
	ctx context.Context,
	req *connect.Request[authv1.IdentityListRequest],
) (*connect.Response[authv1.IdentityListResponse], error) {
	page := 1
	if t := req.Msg.GetPageToken(); t != "" {
		p, err := strconv.Atoi(t)
		if err != nil || p < 1 {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid page_token"))
		}
		page = p
	}

	pageSize := int(req.Msg.GetPageSize())
	if pageSize <= 0 {
		pageSize = 200
	}
	pageSize = service.IdentityPageSize(pageSize)

	identities, total, err := h.service.Fetch(ctx, models.IdentityFilter{Page: page, PageSize: pageSize})
	if err != nil {
		return nil, identityError(err)
	}

	out := make([]*authv1.Identity, 0, len(identities))
	for _, i := range identities {
		out = append(out, identityToV1(i))
	}

	next := ""
	if len(identities) > 0 && int64((page-1)*pageSize+len(identities)) < total {
		next = strconv.Itoa(page + 1)
	}
	return connect.NewResponse(&authv1.IdentityListResponse{Identities: out, NextPageToken: next}), nil
}

// LinkMDM — в v1 секрет приходит в теле запроса, а не в Authorization.
func (h *IdentityV1Handler) LinkMDM(
	ctx context.Context,
	req *connect.Request[authv1.LinkMDMRequest],
) (*connect.Response[authv1.LinkMDMResponse], error) {
	token := req.Msg.GetInternalToken()
	if h.internalToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(h.internalToken)) != 1 {
		return nil, errPermissionDenied
	}

	link := models.MDMLink{MDMID: req.Msg.GetMdmId(), ObjectGUID: req.Msg.GetObjectGuid()}
	if err := h.service.LinkMDMBatch(ctx, []models.MDMLink{link}); err != nil {
		return nil, identityError(err)
	}
	return connect.NewResponse(&authv1.LinkMDMResponse{Success: true}), nil
}

func identityToV1(i *models.Identity) *authv1.Identity {
	return &authv1.Identity{
		Id:         i.ID,
		MdmId:      i.MDMID,
		Email:      i.Email,
		ObjectGuid: i.ObjectGUID,
		SyncedAt:   timestamppb.New(i.SyncedAt),
	}
}
