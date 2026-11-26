package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/access"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	entity "fesmu/contract/tasks/entity"
	api "fesmu/contract/tasks/service"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

type TaskController struct {
	service   *service.TaskService
	applicant *access.ApplicantResolver
	log       *slog.Logger
}

func NewTaskController(service *service.TaskService, applicant *access.ApplicantResolver, log *slog.Logger) *TaskController {
	return &TaskController{service: service, applicant: applicant, log: log}
}

func (c *TaskController) CreateTask(ctx context.Context, req *connect.Request[api.CreateTaskRequest]) (*connect.Response[api.CreateTaskResponse], error) {
	applicant, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	input := service.TaskRegistration{
		ServiceID: req.Msg.ServiceId, FormVersion: req.Msg.FormVersion,
		Title: req.Msg.Title, Description: req.Msg.Description, ExtraFields: req.Msg.ExtraFields,
		IdempotencyKey: req.Msg.IdempotencyKey,
	}
	task, err := c.service.Create(ctx, input, applicant.ID, applicant.DepartmentID)
	if err != nil {
		return nil, c.rpcError(err, "task registration failed")
	}
	return connect.NewResponse(&api.CreateTaskResponse{Task: &entity.Task{
		Uuid: task.UUID, Number: task.Number, Title: task.Title, Description: task.Description,
		CreatedAt: timestamppb.New(task.CreatedAt), UpdatedAt: timestamppb.New(task.UpdatedAt), Version: task.Version,
		ServiceId: *task.ServiceID, DirectionId: *task.DirectionID, StatusId: *task.StatusID, PriorityId: *task.PriorityID,
		FormVersion: input.FormVersion, ExtraFields: input.ExtraFields,
	}}), nil
}

func (c *TaskController) rpcError(err error, failureMessage string) error {
	switch {
	case errors.Is(err, service.ErrInvalidTask):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, service.ErrTaskApplicantRequired):
		return connect.NewError(connect.CodeUnauthenticated, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("service not found"))
	case errors.Is(err, storage.ErrTaskServiceUnavailable), errors.Is(err, storage.ErrTaskDefaultsMissing),
		errors.Is(err, storage.ErrInitialStatusUnavailable), errors.Is(err, storage.ErrDefaultPriorityUnavailable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, storage.ErrTaskFormChanged):
		return connect.NewError(connect.CodeAborted, err)
	case errors.Is(err, storage.ErrTaskRegistrationKeyConflict):
		return connect.NewError(connect.CodeAlreadyExists, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error(failureMessage, "error", err)
		return connect.NewError(connect.CodeInternal, errors.New(failureMessage))
	}
}
