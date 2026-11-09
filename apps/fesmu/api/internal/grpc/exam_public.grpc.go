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
	catalogue, err := h.service.ExamPublicFetch(ctx, req.Msg.GetRecordBook())
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	response := &pb.ExamPublicFetchResponse{List: make([]*pb.ExamPublicTest, 0, len(catalogue.Exams))}
	response.Student = &pb.ExamPublicStudent{FullName: catalogue.Student.FullName, StudentGroup: catalogue.Student.StudentGroup, Faculty: catalogue.Student.Faculty, Course: int32(catalogue.Student.Course)}
	for _, exam := range catalogue.Exams {
		response.List = append(response.List, &pb.ExamPublicTest{
			TestId: exam.TestID, Token: exam.Token, Faculty: exam.Faculty,
			Semester: int32(exam.Semester), Subject: exam.Subject, Title: exam.Title,
			DurationMinutes: int32(exam.DurationMinutes),
		})
	}
	return connect.NewResponse(response), nil
}
