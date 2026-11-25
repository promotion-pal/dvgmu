package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/service/packages/certificate"
)

type CertificateHandler struct {
	service *certificate.Service
}

func CertificateNewController(service *certificate.Service) *CertificateHandler {
	return &CertificateHandler{service: service}
}

func (h *CertificateHandler) CertificateOrder(
	ctx context.Context,
	req *connect.Request[pb.CertificateOrderRequest],
) (*connect.Response[pb.CertificateOrderResponse], error) {
	resp, err := h.service.CertificateOrder(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *CertificateHandler) CertificateFetch(
	ctx context.Context,
	req *connect.Request[pb.CertificateFetchRequest],
) (*connect.Response[pb.CertificateFetchResponse], error) {
	resp, err := h.service.CertificateFetch(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *CertificateHandler) CertificateIssue(
	ctx context.Context,
	req *connect.Request[pb.CertificateIssueRequest],
) (*connect.Response[pb.CertificateIssueResponse], error) {
	resp, err := h.service.CertificateIssue(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *CertificateHandler) CertificateMyFetch(
	ctx context.Context,
	req *connect.Request[pb.CertificateMyFetchRequest],
) (*connect.Response[pb.CertificateFetchResponse], error) {
	resp, err := h.service.CertificateMyFetch(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *CertificateHandler) CertificatePrint(
	ctx context.Context,
	req *connect.Request[pb.CertificatePrintRequest],
) (*connect.Response[pb.CertificatePrintResponse], error) {
	resp, err := h.service.CertificatePrint(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *CertificateHandler) CertificateCancel(
	ctx context.Context,
	req *connect.Request[pb.CertificateCancelRequest],
) (*connect.Response[pb.CertificateCancelResponse], error) {
	resp, err := h.service.CertificateCancel(ctx, req.Msg)
	if err != nil {
		return nil, asConnect(err)
	}
	return connect.NewResponse(resp), nil
}

// asConnect keeps a Connect error's code (permission, not found...) and
// turns anything else into Internal.
func asConnect(err error) error {
	var ce *connect.Error
	if errors.As(err, &ce) {
		return ce
	}
	return connect.NewError(connect.CodeInternal, err)
}
