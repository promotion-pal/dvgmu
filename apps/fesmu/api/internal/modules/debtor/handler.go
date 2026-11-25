package debtor

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
)

type handler struct {
	service *Service
}

func (h *handler) DebtorFetch(
	ctx context.Context,
	req *connect.Request[pb.DebtorFetchRequest],
) (*connect.Response[pb.DebtorFetchResponse], error) {
	resp, err := h.service.Fetch(ctx, req.Msg)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *handler) DebtorDiagnose(
	ctx context.Context,
	req *connect.Request[pb.DebtorDiagnoseRequest],
) (*connect.Response[pb.DebtorDiagnoseResponse], error) {
	resp, err := h.service.Diagnose(ctx, req.Msg.GetIncludeMetadata())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *handler) DebtorOperations(
	ctx context.Context,
	req *connect.Request[pb.DebtorOperationsRequest],
) (*connect.Response[pb.DebtorOperationsResponse], error) {
	resp, err := h.service.Operations(ctx, req.Msg.GetContractRef())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(resp), nil
}

func toConnectError(err error) error {
	switch {
	case errors.Is(err, ErrInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrNotConfigured):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return connect.NewError(connect.CodeDeadlineExceeded, err)
	default:
		// 1C is behind a WinRM hop on another network; a failure there
		// is an outage of the source, not a bug in the request.
		return connect.NewError(connect.CodeUnavailable, err)
	}
}
