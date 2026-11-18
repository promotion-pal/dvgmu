package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	entity "fesmu/contract/fesmu/entity/v1"
	pb "fesmu/contract/fesmu/service/v1"
)

type TestSessionHandler struct {
	// nil when the test database couldn't be reached at startup.
	service *service.TestSessionService
}

func TestSessionNewController(service *service.TestSessionService) *TestSessionHandler {
	return &TestSessionHandler{service: service}
}

func (h *TestSessionHandler) unavailable() error {
	if h.service == nil {
		return connect.NewError(connect.CodeUnavailable, errTestUnavailable)
	}
	return nil
}

func (h *TestSessionHandler) TestSessionCreate(
	ctx context.Context,
	req *connect.Request[pb.TestSessionCreateRequest],
) (*connect.Response[pb.TestSessionCreateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetTestId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("test_id is required"))
	}

	params := models.TestSessionParams{
		Audience:        models.ExamAudienceFromProto(req.Msg.GetAudience()),
		DurationMinutes: int(req.Msg.GetDurationMinutes()),
		QuestionCount:   int(req.Msg.GetQuestionCount()),
		OptionCount:     int(req.Msg.GetOptionCount()),
		Shuffle:         req.Msg.GetShuffle(),
		ShowResult:      req.Msg.GetShowResult(),
		Note:            req.Msg.GetNote(),
	}
	if req.Msg.GetOpensAt() != nil {
		opensAt := req.Msg.GetOpensAt().AsTime()
		params.OpensAt = &opensAt
	}
	if req.Msg.GetClosesAt() != nil {
		closesAt := req.Msg.GetClosesAt().AsTime()
		params.ClosesAt = &closesAt
	}

	session, err := h.service.TestSessionCreate(ctx, req.Msg.GetTestId(), params)
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(&pb.TestSessionCreateResponse{Session: session.ToProto()}), nil
}

func (h *TestSessionHandler) TestSessionFetch(
	ctx context.Context,
	req *connect.Request[pb.TestSessionFetchRequest],
) (*connect.Response[pb.TestSessionFetchResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	list, err := h.service.TestSessionFetch(ctx, req.Msg.GetTestId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.TestSessionFetchResponse{List: make([]*entity.TestSession, 0, len(list))}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *TestSessionHandler) TestSessionOpenUpdate(
	ctx context.Context,
	req *connect.Request[pb.TestSessionOpenUpdateRequest],
) (*connect.Response[pb.TestSessionOpenUpdateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.TestSessionOpenUpdate(ctx, req.Msg.GetId(), req.Msg.GetIsOpen()); err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(&pb.TestSessionOpenUpdateResponse{Success: true, Message: "test session updated"}), nil
}

func (h *TestSessionHandler) TestSessionDelete(
	ctx context.Context,
	req *connect.Request[pb.TestSessionDeleteRequest],
) (*connect.Response[pb.TestSessionDeleteResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.TestSessionDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(&pb.TestSessionDeleteResponse{Success: true, Message: "test session deleted"}), nil
}

func (h *TestSessionHandler) TestAttemptFetch(
	ctx context.Context,
	req *connect.Request[pb.TestAttemptFetchRequest],
) (*connect.Response[pb.TestAttemptFetchResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetSessionId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("session_id is required"))
	}

	session, views, err := h.service.TestAttemptFetch(ctx, req.Msg.GetSessionId())
	if err != nil {
		return nil, testSessionConnectError(err)
	}

	resp := &pb.TestAttemptFetchResponse{
		Session:   session.ToProto(),
		Questions: session.QuestionsProto(),
		List:      make([]*entity.TestAttempt, 0, len(views)),
	}
	for _, v := range views {
		resp.List = append(resp.List, v.Attempt.ToProto(v.Questions))
	}
	return connect.NewResponse(resp), nil
}

func (h *TestSessionHandler) TestAttemptDelete(
	ctx context.Context,
	req *connect.Request[pb.TestAttemptDeleteRequest],
) (*connect.Response[pb.TestAttemptDeleteResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.TestAttemptDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(&pb.TestAttemptDeleteResponse{Success: true, Message: "test attempt deleted"}), nil
}

func (h *TestSessionHandler) TestTakeInfo(
	ctx context.Context,
	req *connect.Request[pb.TestTakeInfoRequest],
) (*connect.Response[pb.TestTakeInfoResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	session, open, err := h.service.TestTakeInfo(ctx, req.Msg.GetToken())
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	resp := &pb.TestTakeInfoResponse{
		Topic:               session.Topic,
		Description:         session.Description,
		DurationMinutes:     int32(session.DurationMinutes),
		QuestionCount:       int32(session.AskedCount()),
		IsOpen:              open,
		InstructionRequired: session.ExamSettings.Enabled,
		Instruction:         models.ExamV2Instruction,
	}
	if session.OpensAt != nil {
		resp.OpensAt = timestamppb.New(*session.OpensAt)
	}
	if session.ClosesAt != nil {
		resp.ClosesAt = timestamppb.New(*session.ClosesAt)
	}
	return connect.NewResponse(resp), nil
}

func (h *TestSessionHandler) TestTakeStart(
	ctx context.Context,
	req *connect.Request[pb.TestTakeStartRequest],
) (*connect.Response[pb.TestTakeStateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	view, err := h.service.TestTakeStart(ctx, req.Msg.GetToken(), models.TestAttemptParams{
		RecordBook:          req.Msg.GetRecordBook(),
		InstructionAccepted: req.Msg.GetInstructionAccepted(),
		FullName:            req.Msg.GetFullName(),
		StudentGroup:        req.Msg.GetStudentGroup(),
	})
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(h.takeState(view)), nil
}

func (h *TestSessionHandler) TestTakeState(
	ctx context.Context,
	req *connect.Request[pb.TestTakeStateRequest],
) (*connect.Response[pb.TestTakeStateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	view, err := h.service.TestTakeState(ctx, req.Msg.GetAttemptToken())
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(h.takeState(view)), nil
}

func (h *TestSessionHandler) TestTakeAnswer(
	ctx context.Context,
	req *connect.Request[pb.TestTakeAnswerRequest],
) (*connect.Response[pb.TestTakeAnswerResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	err := h.service.TestTakeAnswer(ctx, req.Msg.GetAttemptToken(), req.Msg.GetQuestionId(), req.Msg.GetAnswerIds())
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(&pb.TestTakeAnswerResponse{Success: true}), nil
}

func (h *TestSessionHandler) TestTakeFinish(
	ctx context.Context,
	req *connect.Request[pb.TestTakeFinishRequest],
) (*connect.Response[pb.TestTakeStateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	view, err := h.service.TestTakeFinish(ctx, req.Msg.GetAttemptToken())
	if err != nil {
		return nil, testSessionConnectError(err)
	}
	return connect.NewResponse(h.takeState(view)), nil
}

// takeState is what the student's page gets: the questions while the
// attempt runs, the score (if the session shows it) once it is over —
// never which options are correct.
func (h *TestSessionHandler) takeState(view *service.TestAttemptView) *pb.TestTakeStateResponse {
	a := view.Attempt
	resp := &pb.TestTakeStateResponse{
		AttemptToken: a.Token,
		Topic:        view.Session.Topic,
		FullName:     a.FullName,
		Status:       a.Status,
		Deadline:     timestamppb.New(a.Deadline),
		ServerTime:   timestamppb.New(h.service.Now()),
		ShowResult:   view.Session.ShowResult && (!h.service.IsExam() || view.Session.ExamSettings.Enabled),
	}
	if a.InProgress() {
		resp.Questions = models.TakeQuestionsProto(view.Questions)
		if h.service.IsExam() {
			for _, question := range resp.Questions {
				question.Multiple = false
			}
		}
		resp.Answers = a.SavedAnswersProto()
	} else if resp.ShowResult {
		resp.Score = int32(a.Score)
		resp.Total = int32(a.Total)
	}
	return resp
}

func testSessionConnectError(err error) error {
	switch {
	case errors.Is(err, models.ErrExamAlreadyTaken):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, models.ErrExamNotAssigned):
		return connect.NewError(connect.CodePermissionDenied, err)
	case errors.Is(err, models.ErrExamDirectory):
		return connect.NewError(connect.CodeUnavailable, err)
	case errors.Is(err, models.ErrExamAudience), errors.Is(err, models.ErrExamStudent):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrTestInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrTestNotFound),
		errors.Is(err, models.ErrTestSessionNotFound),
		errors.Is(err, models.ErrTestAttemptNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, models.ErrTestSessionClosed), errors.Is(err, models.ErrTestSessionNotOpenYet), errors.Is(err, models.ErrTestAttemptOver):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
