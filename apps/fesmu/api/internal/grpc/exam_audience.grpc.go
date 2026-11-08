package grpc

import (
	"connectrpc.com/connect"
	"context"
	"dvgmu/api/internal/auth"
	pb "fesmu/contract/mdm/service"
)

func (h *TestSessionHandler) ExamAudienceFetch(ctx context.Context, req *connect.Request[pb.UserDirectoryFetchRequest]) (*connect.Response[pb.UserDirectoryFetchResponse], error) {
	if err := auth.RequireCan(ctx, auth.SectionExamTests, auth.ActionPost); err != nil {
		return nil, err
	}
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	response, err := h.service.ExamAudienceFetch(ctx, req.Msg)
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(response), nil
}
