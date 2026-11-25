package grpc

import (
	"context"
	"errors"
	"net/http"

	"connectrpc.com/connect"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/service/v1"
)

// errTestUnavailable is returned by every call while the test database is down.
var errTestUnavailable = errors.New("конструктор тестов недоступен: нет подключения к базе тестов")

type TestHandler struct {
	// nil when the test database couldn't be reached at startup.
	service *service.TestService
	exam    bool
}

func TestNewController(service *service.TestService, exam ...bool) *TestHandler {
	h := &TestHandler{service: service}
	if len(exam) > 0 {
		h.exam = exam[0]
	}
	return h
}

func (h *TestHandler) unavailable() error {
	if h.service == nil {
		return connect.NewError(connect.CodeUnavailable, errTestUnavailable)
	}
	return nil
}

func (h *TestHandler) TestFetch(
	ctx context.Context,
	req *connect.Request[pb.TestFetchRequest],
) (*connect.Response[pb.TestFetchResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	list, err := h.service.TestFetch(ctx, models.TestFilter{Topic: req.Msg.GetTopic()})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.TestFetchResponse{List: make([]*entity.Test, 0, len(list))}
	for _, item := range list {
		resp.List = append(resp.List, item.ToProto())
	}
	return connect.NewResponse(resp), nil
}

func (h *TestHandler) TestByID(
	ctx context.Context,
	req *connect.Request[pb.TestByIDRequest],
) (*connect.Response[pb.TestByIDResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	test, err := h.service.TestByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, testConnectError(err)
	}
	return connect.NewResponse(&pb.TestByIDResponse{Test: test.ToProto()}), nil
}

func (h *TestHandler) TestCreate(
	ctx context.Context,
	req *connect.Request[pb.TestCreateRequest],
) (*connect.Response[pb.TestCreateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if h.exam {
		if err := models.ValidateExamParams(testParams(req.Msg.GetDepartment(), req.Msg.GetDiscipline(), req.Msg.GetSemester(), req.Msg.GetTopic(), req.Msg.GetDescription(), req.Msg.GetVersion(), req.Msg.GetQuestions())); err != nil {
			return nil, testConnectError(err)
		}
	}
	if h.exam && (req.Msg.GetSemester() < 1 || req.Msg.GetSemester() > 12) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("укажите семестр от 1 до 12"))
	}
	id, err := h.service.TestCreate(ctx, testParams(req.Msg.GetDepartment(), req.Msg.GetDiscipline(), req.Msg.GetSemester(), req.Msg.GetTopic(), req.Msg.GetDescription(), req.Msg.GetVersion(), req.Msg.GetQuestions()))
	if err != nil {
		return nil, testConnectError(err)
	}

	return connect.NewResponse(&pb.TestCreateResponse{
		Success: true,
		Message: "test created",
		TestId:  id,
	}), nil
}

func (h *TestHandler) TestUpdate(
	ctx context.Context,
	req *connect.Request[pb.TestUpdateRequest],
) (*connect.Response[pb.TestUpdateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if h.exam {
		if err := models.ValidateExamParams(testParams(req.Msg.GetDepartment(), req.Msg.GetDiscipline(), req.Msg.GetSemester(), req.Msg.GetTopic(), req.Msg.GetDescription(), req.Msg.GetVersion(), req.Msg.GetQuestions())); err != nil {
			return nil, testConnectError(err)
		}
	}
	if h.exam && (req.Msg.GetSemester() < 1 || req.Msg.GetSemester() > 12) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("укажите семестр от 1 до 12"))
	}
	err := h.service.TestUpdate(ctx, req.Msg.GetId(), testParams(req.Msg.GetDepartment(), req.Msg.GetDiscipline(), req.Msg.GetSemester(), req.Msg.GetTopic(), req.Msg.GetDescription(), req.Msg.GetVersion(), req.Msg.GetQuestions()))
	if err != nil {
		return nil, testConnectError(err)
	}

	return connect.NewResponse(&pb.TestUpdateResponse{
		Success: true,
		Message: "test updated",
	}), nil
}

func (h *TestHandler) TestDelete(
	ctx context.Context,
	req *connect.Request[pb.TestDeleteRequest],
) (*connect.Response[pb.TestDeleteResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.TestDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, testConnectError(err)
	}

	return connect.NewResponse(&pb.TestDeleteResponse{
		Success: true,
		Message: "test deleted",
	}), nil
}

func (h *TestHandler) TestExport(
	ctx context.Context,
	req *connect.Request[pb.TestExportRequest],
) (*connect.Response[pb.TestExportResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	name, content, err := h.service.TestExport(ctx, req.Msg.GetId())
	if err != nil {
		return nil, testConnectError(err)
	}
	return connect.NewResponse(&pb.TestExportResponse{FileName: name, Content: content}), nil
}

func (h *TestHandler) TestImportParse(
	ctx context.Context,
	req *connect.Request[pb.TestImportParseRequest],
) (*connect.Response[pb.TestImportParseResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}

	params, warnings, err := h.service.TestImportParse(ctx, req.Msg.GetFileName(), req.Msg.GetContent())
	if err != nil {
		return nil, testConnectError(err)
	}

	resp := &pb.TestImportParseResponse{
		Topic:     params.Topic,
		Questions: make([]*pb.TestQuestionInput, 0, len(params.Questions)),
		Warnings:  warnings,
	}
	for _, q := range params.Questions {
		answers := make([]*pb.TestAnswerInput, 0, len(q.Answers))
		for _, a := range q.Answers {
			answers = append(answers, &pb.TestAnswerInput{Text: a.Text, IsCorrect: a.IsCorrect})
		}
		resp.Questions = append(resp.Questions, &pb.TestQuestionInput{Text: q.Text, Answers: answers, Image: q.Image})
	}
	return connect.NewResponse(resp), nil
}

func (h *TestHandler) TestExportStatusUpdate(
	ctx context.Context,
	req *connect.Request[pb.TestExportStatusUpdateRequest],
) (*connect.Response[pb.TestExportStatusUpdateResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.TestExportStatusUpdate(ctx, req.Msg.GetId(), req.Msg.GetExportStatus()); err != nil {
		return nil, testConnectError(err)
	}
	return connect.NewResponse(&pb.TestExportStatusUpdateResponse{
		Success: true,
		Message: "test export status updated",
	}), nil
}

func (h *TestHandler) TestImageUpload(
	ctx context.Context,
	req *connect.Request[pb.TestImageUploadRequest],
) (*connect.Response[pb.TestImageUploadResponse], error) {
	if err := h.unavailable(); err != nil {
		return nil, err
	}
	img, err := h.service.TestImageUpload(ctx, req.Msg.GetContent())
	if err != nil {
		return nil, testConnectError(err)
	}
	return connect.NewResponse(&pb.TestImageUploadResponse{Image: img.Hash, Width: int32(img.Width), Height: int32(img.Height)}), nil
}

// ImageHTTP serves a question's picture at GET /test-images/{hash}. Open
// without a login: students see it while taking a test. A picture never
// changes under its hash, so browsers may keep it for good.
func (h *TestHandler) ImageHTTP() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.service == nil {
			http.Error(w, errTestUnavailable.Error(), http.StatusServiceUnavailable)
			return
		}
		img, err := h.service.TestImage(r.Context(), r.PathValue("hash"))
		if errors.Is(err, models.ErrTestNotFound) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", img.Mime)
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Write(img.Data)
	})
}

func testParams(department, discipline string, semester int32, topic, description string, version enum.TestVersion, questions []*pb.TestQuestionInput) models.TestParams {
	params := models.TestParams{
		Version:     version,
		Department:  department,
		Discipline:  discipline,
		Semester:    int(semester),
		Topic:       topic,
		Description: description,
		Questions:   make([]models.TestQuestionParams, 0, len(questions)),
	}
	for _, q := range questions {
		answers := make([]models.TestAnswerParams, 0, len(q.GetAnswers()))
		for _, a := range q.GetAnswers() {
			answers = append(answers, models.TestAnswerParams{Text: a.GetText(), IsCorrect: a.GetIsCorrect()})
		}
		params.Questions = append(params.Questions, models.TestQuestionParams{Text: q.GetText(), Image: q.GetImage(), Answers: answers})
	}
	return params
}

func testConnectError(err error) error {
	switch {
	case errors.Is(err, models.ErrTestInvalid), errors.Is(err, models.ErrTestImportInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, models.ErrTestNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
