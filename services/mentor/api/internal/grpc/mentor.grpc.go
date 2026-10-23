package grpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"dvgmu/api/contract/gen/go/entity"
	pb "dvgmu/api/contract/gen/go/service"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type MentorHandler struct {
	service *service.MentorService
}

func MentorNewController(service *service.MentorService) *MentorHandler {
	return &MentorHandler{service: service}
}

func (h *MentorHandler) MentorApplicationCreate(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationCreateRequest],
) (*connect.Response[pb.MentorApplicationCreateResponse], error) {
	if req.Msg.GetFirstName() == "" || req.Msg.GetEmail() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("firstName and email are required"))
	}

	application := &models.MentorApplication{
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		CourseID:   req.Msg.GetCourseId(),
	}

	id, err := h.service.ApplicationCreate(ctx, application)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorApplicationCreateResponse{
		Success: true,
		Message: "mentor application created",
		Id:      id,
	}), nil
}

func (h *MentorHandler) MentorApplicationByID(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationByIDRequest],
) (*connect.Response[pb.MentorApplicationByIDResponse], error) {
	application, err := h.service.ApplicationByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if application == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("mentor application not found"))
	}

	return connect.NewResponse(&pb.MentorApplicationByIDResponse{
		Application: toProtoApplication(application),
	}), nil
}

func (h *MentorHandler) MentorApplicationFetch(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationFetchRequest],
	stream *connect.ServerStream[pb.MentorApplicationByIDResponse],
) error {
	applications, err := h.service.ApplicationFetch(ctx, req.Msg.GetCourseId(), req.Msg.GetPage(), req.Msg.GetPageSize())
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range applications {
		if err := stream.Send(&pb.MentorApplicationByIDResponse{
			Application: toProtoApplication(&applications[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *MentorHandler) MentorApplicationUpdate(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationUpdateRequest],
) (*connect.Response[pb.MentorApplicationUpdateResponse], error) {
	application := &models.MentorApplication{
		ID:         req.Msg.GetId(),
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		CourseID:   req.Msg.GetCourseId(),
	}

	if err := h.service.ApplicationUpdate(ctx, application); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorApplicationUpdateResponse{
		Success: true,
		Message: "mentor application updated",
	}), nil
}

func (h *MentorHandler) MentorApplicationDelete(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationDeleteRequest],
) (*connect.Response[pb.MentorApplicationDeleteResponse], error) {
	if err := h.service.ApplicationDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorApplicationDeleteResponse{
		Success: true,
		Message: "mentor application deleted",
	}), nil
}

func (h *MentorHandler) MentorApplicationMarkDone(
	ctx context.Context,
	req *connect.Request[pb.MentorApplicationMarkDoneRequest],
) (*connect.Response[pb.MentorApplicationMarkDoneResponse], error) {
	if err := h.service.ApplicationMarkDone(ctx, req.Msg.GetId(), req.Msg.GetIsDone()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorApplicationMarkDoneResponse{
		Success: true,
		Message: "mentor application updated",
	}), nil
}

func (h *MentorHandler) MentorCourseCreate(
	ctx context.Context,
	req *connect.Request[pb.MentorCourseCreateRequest],
) (*connect.Response[pb.MentorCourseCreateResponse], error) {
	if req.Msg.GetStartDate() == nil || req.Msg.GetEndDate() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("startDate and endDate are required"))
	}

	course := &models.MentorCourse{
		StartDate: protoDateToModel(req.Msg.GetStartDate()),
		EndDate:   protoDateToModel(req.Msg.GetEndDate()),
	}

	id, err := h.service.CourseCreate(ctx, course)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorCourseCreateResponse{
		Success: true,
		Message: "mentor course created",
		Id:      id,
	}), nil
}

func (h *MentorHandler) MentorCourseByID(
	ctx context.Context,
	req *connect.Request[pb.MentorCourseByIDRequest],
) (*connect.Response[pb.MentorCourseByIDResponse], error) {
	course, err := h.service.CourseByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if course == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("mentor course not found"))
	}

	return connect.NewResponse(&pb.MentorCourseByIDResponse{
		Course: toProtoCourse(course),
	}), nil
}

func (h *MentorHandler) MentorCourseFetch(
	ctx context.Context,
	req *connect.Request[pb.MentorCourseFetchRequest],
	stream *connect.ServerStream[pb.MentorCourseFetchResponse],
) error {
	courses, err := h.service.CourseFetch(ctx, req.Msg.GetPage(), req.Msg.GetPageSize())
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range courses {
		if err := stream.Send(&pb.MentorCourseFetchResponse{
			Course: toProtoCourse(&courses[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *MentorHandler) MentorCourseUpdate(
	ctx context.Context,
	req *connect.Request[pb.MentorCourseUpdateRequest],
) (*connect.Response[pb.MentorCourseUpdateResponse], error) {
	course := &models.MentorCourse{
		ID:        req.Msg.GetId(),
		StartDate: protoDateToModel(req.Msg.GetStartDate()),
		EndDate:   protoDateToModel(req.Msg.GetEndDate()),
	}

	if err := h.service.CourseUpdate(ctx, course); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorCourseUpdateResponse{
		Success: true,
		Message: "mentor course updated",
	}), nil
}

func (h *MentorHandler) MentorCourseDelete(
	ctx context.Context,
	req *connect.Request[pb.MentorCourseDeleteRequest],
) (*connect.Response[pb.MentorCourseDeleteResponse], error) {
	if err := h.service.CourseDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorCourseDeleteResponse{
		Success: true,
		Message: "mentor course deleted",
	}), nil
}

func (h *MentorHandler) MentorQuestionCreate(
	ctx context.Context,
	req *connect.Request[pb.MentorQuestionCreateRequest],
) (*connect.Response[pb.MentorQuestionCreateResponse], error) {
	if req.Msg.GetFirstName() == "" || req.Msg.GetEmail() == "" || req.Msg.GetQuestion() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("firstName, email and question are required"))
	}

	question := &models.MentorQuestion{
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		Question:   req.Msg.GetQuestion(),
	}

	id, err := h.service.QuestionCreate(ctx, question)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorQuestionCreateResponse{
		Success: true,
		Message: "mentor question created",
		Id:      id,
	}), nil
}

func (h *MentorHandler) MentorQuestionFetch(
	ctx context.Context,
	req *connect.Request[pb.MentorQuestionFetchRequest],
	stream *connect.ServerStream[pb.MentorQuestionFetchResponse],
) error {
	questions, err := h.service.QuestionFetch(ctx, req.Msg.GetPage(), req.Msg.GetPageSize())
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range questions {
		if err := stream.Send(&pb.MentorQuestionFetchResponse{
			Question: toProtoQuestion(&questions[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *MentorHandler) MentorQuestionDelete(
	ctx context.Context,
	req *connect.Request[pb.MentorQuestionDeleteRequest],
) (*connect.Response[pb.MentorQuestionDeleteResponse], error) {
	if err := h.service.QuestionDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorQuestionDeleteResponse{
		Success: true,
		Message: "mentor question deleted",
	}), nil
}

func (h *MentorHandler) MentorQuestionMarkDone(
	ctx context.Context,
	req *connect.Request[pb.MentorQuestionMarkDoneRequest],
) (*connect.Response[pb.MentorQuestionMarkDoneResponse], error) {
	if err := h.service.QuestionMarkDone(ctx, req.Msg.GetId(), req.Msg.GetIsDone()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorQuestionMarkDoneResponse{
		Success: true,
		Message: "mentor question updated",
	}), nil
}

func (h *MentorHandler) MentorTechnicalQuestionCreate(
	ctx context.Context,
	req *connect.Request[pb.MentorTechnicalQuestionCreateRequest],
) (*connect.Response[pb.MentorTechnicalQuestionCreateResponse], error) {
	if req.Msg.GetFirstName() == "" || req.Msg.GetEmail() == "" || req.Msg.GetQuestion() == "" || req.Msg.GetCourseId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("firstName, email, courseId and question are required"))
	}

	question := &models.MentorTechnicalQuestion{
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		CourseID:   req.Msg.GetCourseId(),
		Question:   req.Msg.GetQuestion(),
	}

	id, err := h.service.TechnicalQuestionCreate(ctx, question)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorTechnicalQuestionCreateResponse{
		Success: true,
		Message: "mentor technical question created",
		Id:      id,
	}), nil
}

func (h *MentorHandler) MentorTechnicalQuestionFetch(
	ctx context.Context,
	req *connect.Request[pb.MentorTechnicalQuestionFetchRequest],
	stream *connect.ServerStream[pb.MentorTechnicalQuestionFetchResponse],
) error {
	questions, err := h.service.TechnicalQuestionFetch(ctx, req.Msg.GetCourseId(), req.Msg.GetPage(), req.Msg.GetPageSize())
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range questions {
		if err := stream.Send(&pb.MentorTechnicalQuestionFetchResponse{
			Question: toProtoTechnicalQuestion(&questions[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *MentorHandler) MentorTechnicalQuestionDelete(
	ctx context.Context,
	req *connect.Request[pb.MentorTechnicalQuestionDeleteRequest],
) (*connect.Response[pb.MentorTechnicalQuestionDeleteResponse], error) {
	if err := h.service.TechnicalQuestionDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorTechnicalQuestionDeleteResponse{
		Success: true,
		Message: "mentor technical question deleted",
	}), nil
}

func (h *MentorHandler) MentorTechnicalQuestionMarkDone(
	ctx context.Context,
	req *connect.Request[pb.MentorTechnicalQuestionMarkDoneRequest],
) (*connect.Response[pb.MentorTechnicalQuestionMarkDoneResponse], error) {
	if err := h.service.TechnicalQuestionMarkDone(ctx, req.Msg.GetId(), req.Msg.GetIsDone()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MentorTechnicalQuestionMarkDoneResponse{
		Success: true,
		Message: "mentor technical question updated",
	}), nil
}

func toProtoApplication(application *models.MentorApplication) *entity.MentorApplication {
	return &entity.MentorApplication{
		Id:         application.ID,
		FirstName:  application.FirstName,
		LastName:   application.LastName,
		Patronymic: application.Patronymic,
		Email:      application.Email,
		CourseId:   application.CourseID,
		CreatedAt:  timestamppb.New(application.CreatedAt),
		UpdatedAt:  timestamppb.New(application.UpdatedAt),
		IsDone:     application.IsDone,
	}
}

func toProtoCourse(course *models.MentorCourse) *entity.MentorCourse {
	var startDate, endDate *timestamppb.Timestamp
	if course.StartDate != nil {
		startDate = timestamppb.New(*course.StartDate)
	}
	if course.EndDate != nil {
		endDate = timestamppb.New(*course.EndDate)
	}

	return &entity.MentorCourse{
		Id:        course.ID,
		StartDate: startDate,
		EndDate:   endDate,
		CreatedAt: timestamppb.New(course.CreatedAt),
		UpdatedAt: timestamppb.New(course.UpdatedAt),
	}
}

func toProtoQuestion(question *models.MentorQuestion) *entity.MentorQuestion {
	return &entity.MentorQuestion{
		Id:         question.ID,
		FirstName:  question.FirstName,
		LastName:   question.LastName,
		Patronymic: question.Patronymic,
		Email:      question.Email,
		Question:   question.Question,
		CreatedAt:  timestamppb.New(question.CreatedAt),
		UpdatedAt:  timestamppb.New(question.UpdatedAt),
		IsDone:     question.IsDone,
	}
}

func toProtoTechnicalQuestion(question *models.MentorTechnicalQuestion) *entity.MentorTechnicalQuestion {
	return &entity.MentorTechnicalQuestion{
		Id:         question.ID,
		FirstName:  question.FirstName,
		LastName:   question.LastName,
		Patronymic: question.Patronymic,
		Email:      question.Email,
		CourseId:   question.CourseID,
		Question:   question.Question,
		CreatedAt:  timestamppb.New(question.CreatedAt),
		UpdatedAt:  timestamppb.New(question.UpdatedAt),
		IsDone:     question.IsDone,
	}
}

func protoDateToModel(date *timestamppb.Timestamp) *time.Time {
	if date == nil {
		return nil
	}
	t := date.AsTime()
	return &t
}
