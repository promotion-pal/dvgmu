package grpc

import (
	"connectrpc.com/connect"
	"context"
	pb "fesmu/contract/fesmu/exam/service/v1"
)

// Only this explicitly public projection is available without staff rights.
func (h *TestSessionHandler) ExamPublicFetch(ctx context.Context, req *connect.Request[pb.ExamPublicFetchRequest]) (*connect.Response[pb.ExamPublicFetchResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	list, err := h.service.ExamPublicFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	response := &pb.ExamPublicFetchResponse{List: make([]*pb.ExamPublicTest, 0, len(list))}
	for _, exam := range list {
		response.List = append(response.List, &pb.ExamPublicTest{
			TestId: exam.TestID, Token: exam.Token, Faculty: exam.Faculty,
			Semester: int32(exam.Semester), Subject: exam.Subject, Title: exam.Title,
			DurationMinutes: int32(exam.DurationMinutes),
		})
	}
	return connect.NewResponse(response), nil
}
