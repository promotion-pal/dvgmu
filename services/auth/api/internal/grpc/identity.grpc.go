package grpc

import (
	"context"
	"crypto/subtle"
	"errors"
	"strings"

	"connectrpc.com/connect"

	pb "dvgmu/auth/contract/gen/go/auth/v2"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/service"
	"dvgmu/auth/internal/utils"
)

type IdentityHandler struct {
	service       *service.IdentityService
	internalToken string
}

func IdentityNewController(svc *service.IdentityService, internalToken string) *IdentityHandler {
	return &IdentityHandler{service: svc, internalToken: internalToken}
}

func (h *IdentityHandler) BatchLinkMDM2AD(
	ctx context.Context,
	req *connect.Request[pb.BatchLinkMDM2ADRequest],
) (*connect.Response[pb.BatchLinkMDM2ADResponse], error) {
	if !h.authorized(req.Header().Get("Authorization")) {
		return nil, errPermissionDenied
	}

	links := make([]models.MDMLink, 0, len(req.Msg.GetLinks()))
	for _, l := range req.Msg.GetLinks() {
		links = append(links, models.MDMLink{MDMID: l.GetMdmId(), ObjectGUID: l.GetObjectGuid()})
	}

	if err := h.service.LinkMDMBatch(ctx, links); err != nil {
		return nil, identityError(err)
	}
	return connect.NewResponse(&pb.BatchLinkMDM2ADResponse{Success: true}), nil
}

func (h *IdentityHandler) FetchIdentityByID(
	ctx context.Context,
	req *connect.Request[pb.FetchIdentityByIDRequest],
) (*connect.Response[pb.FetchIdentityByIDResponse], error) {
	if !h.authorized(req.Header().Get("Authorization")) {
		return nil, errPermissionDenied
	}

	identity, err := h.service.ByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, identityError(err)
	}
	return connect.NewResponse(&pb.FetchIdentityByIDResponse{Identity: identity.ToProto()}), nil
}

func (h *IdentityHandler) FetchIdentity(
	ctx context.Context,
	req *connect.Request[pb.FetchIdentityRequest],
) (*connect.Response[pb.FetchIdentityResponse], error) {
	if !h.authorized(req.Header().Get("Authorization")) {
		return nil, errPermissionDenied
	}

	filter := models.IdentityFilter{
		MDMID:      req.Msg.GetMdmId(),
		ObjectGUID: req.Msg.GetObjectGuid(),
		Email:      req.Msg.GetEmail(),
		Login:      req.Msg.GetLogin(),
		Linked:     req.Msg.Linked,
		Page:       int(req.Msg.GetPage()),
		PageSize:   int(req.Msg.GetPageSize()),
	}

	identities, total, err := h.service.Fetch(ctx, filter)
	if err != nil {
		return nil, identityError(err)
	}

	out := make([]*pb.Identity, 0, len(identities))
	for _, i := range identities {
		out = append(out, i.ToProto())
	}
	return connect.NewResponse(&pb.FetchIdentityResponse{Identities: out, Total: total}), nil
}

var errPermissionDenied = connect.NewError(connect.CodePermissionDenied, errors.New("invalid internal token"))

func (h *IdentityHandler) authorized(header string) bool {
	if h.internalToken == "" {
		return false
	}
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(h.internalToken)) == 1
}

func identityError(err error) error {
	switch {
	case errors.Is(err, utils.ErrInvalidLink):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, utils.ErrIdentityNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, utils.ErrDirectoryDisabled):
		return connect.NewError(connect.CodeUnimplemented, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
