package grpc

import (
	"context"
	"crypto/subtle"
	"errors"
	"strings"

	"connectrpc.com/connect"

	pb "dvgmu/api/contract/gen/go/service"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

var errPermissionDenied = connect.NewError(connect.CodePermissionDenied, errors.New("invalid internal token"))

// UserLinkHandler — служебный UserLinkService (только для sync), под
// внутренним токеном.
type UserLinkHandler struct {
	service       *service.UserService
	activation    *service.ActivationService
	internalToken string
}

func UserLinkNewController(service *service.UserService, activation *service.ActivationService, internalToken string) *UserLinkHandler {
	return &UserLinkHandler{service: service, activation: activation, internalToken: internalToken}
}

func (h *UserLinkHandler) UserADLinkBatch(
	ctx context.Context,
	req *connect.Request[pb.UserADLinkBatchRequest],
) (*connect.Response[pb.UserADLinkBatchResponse], error) {
	if !h.authorized(req.Header().Get("Authorization")) {
		return nil, errPermissionDenied
	}

	links := make([]models.ADLink, 0, len(req.Msg.GetLinks()))
	for _, l := range req.Msg.GetLinks() {
		links = append(links, models.ADLink{UserID: l.GetId(), ADObjectID: l.GetAdObjectId()})
	}

	linked, skipped, err := h.service.UserADLinkBatch(ctx, links)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.UserADLinkBatchResponse{Linked: linked}
	for _, l := range skipped {
		resp.Skipped = append(resp.Skipped, &pb.UserADLink{Id: l.UserID, AdObjectId: l.ADObjectID})
	}
	return connect.NewResponse(resp), nil
}

func (h *UserLinkHandler) ActivationVerify(
	ctx context.Context,
	req *connect.Request[pb.ActivationCheckRequest],
) (*connect.Response[pb.ActivationCheckResponse], error) {
	return h.activationCheck(ctx, req, h.activation.Verify)
}

func (h *UserLinkHandler) ActivationConsume(
	ctx context.Context,
	req *connect.Request[pb.ActivationCheckRequest],
) (*connect.Response[pb.ActivationCheckResponse], error) {
	return h.activationCheck(ctx, req, h.activation.Consume)
}

func (h *UserLinkHandler) activationCheck(
	ctx context.Context,
	req *connect.Request[pb.ActivationCheckRequest],
	check func(ctx context.Context, username, code string) (*models.User, error),
) (*connect.Response[pb.ActivationCheckResponse], error) {
	if !h.authorized(req.Header().Get("Authorization")) {
		return nil, errPermissionDenied
	}

	user, err := check(ctx, req.Msg.GetUsername(), req.Msg.GetCode())
	if err != nil {
		switch {
		case errors.Is(err, models.ErrActivationInvalid):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		case errors.Is(err, models.ErrActivationLocked):
			return nil, connect.NewError(connect.CodeResourceExhausted, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&pb.ActivationCheckResponse{User: user.ToProto()}), nil
}

func (h *UserLinkHandler) authorized(header string) bool {
	if h.internalToken == "" {
		return false
	}
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(h.internalToken)) == 1
}
