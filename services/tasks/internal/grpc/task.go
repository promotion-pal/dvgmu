package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/access"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	entity "fesmu/contract/tasks/entity"
	api "fesmu/contract/tasks/service"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/structpb"
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

func (c *TaskController) GetMyTask(ctx context.Context, req *connect.Request[api.GetMyTaskRequest]) (*connect.Response[api.GetMyTaskResponse], error) {
	const failureMessage = "loading task failed"
	applicant, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	details, err := c.service.GetMine(ctx, applicant.ID, req.Msg.Uuid)
	if err != nil {
		return nil, c.taskReadError(err, failureMessage)
	}
	task, formSchema, err := taskDetailsMessage(details)
	if err != nil {
		return nil, c.rpcError(err, failureMessage)
	}
	return connect.NewResponse(&api.GetMyTaskResponse{
		Task: task, FormSchema: formSchema,
		ServiceName: details.ServiceName, StatusName: details.StatusName, PriorityName: details.PriorityName,
	}), nil
}

func (c *TaskController) GetQueueTask(ctx context.Context, req *connect.Request[api.GetQueueTaskRequest]) (*connect.Response[api.GetQueueTaskResponse], error) {
	const failureMessage = "loading queue task failed"
	viewer, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	details, err := c.service.GetInQueue(ctx, viewer.ID, req.Msg.QueueCode, req.Msg.Uuid)
	if err != nil {
		return nil, c.taskReadError(err, failureMessage)
	}
	task, formSchema, err := taskDetailsMessage(details)
	if err != nil {
		return nil, c.rpcError(err, failureMessage)
	}
	return connect.NewResponse(&api.GetQueueTaskResponse{
		Task: task, FormSchema: formSchema,
		ServiceName: details.ServiceName, StatusName: details.StatusName, PriorityName: details.PriorityName,
	}), nil
}

func taskDetailsMessage(details models.TaskDetails) (*entity.Task, *entity.ServiceFormSchema, error) {
	extraFields := &structpb.Struct{}
	if err := protojson.Unmarshal([]byte(details.ExtraFields), extraFields); err != nil {
		return nil, nil, fmt.Errorf("decode stored task fields: %w", err)
	}
	var formSchema *entity.ServiceFormSchema
	if details.FormSchema != nil {
		formSchema = &entity.ServiceFormSchema{}
		if err := protojson.Unmarshal([]byte(*details.FormSchema), formSchema); err != nil {
			return nil, nil, fmt.Errorf("decode stored task form: %w", err)
		}
	}

	return &entity.Task{
		Uuid: details.UUID, Number: details.Number, Title: details.Title, Description: details.Description,
		CreatedAt: timestamppb.New(details.CreatedAt), UpdatedAt: timestamppb.New(details.UpdatedAt), Version: details.Version,
		ServiceId: details.ServiceID, DirectionId: details.DirectionID, StatusId: details.StatusID, PriorityId: details.PriorityID,
		FormVersion: details.FormVersion, ExtraFields: extraFields,
	}, formSchema, nil
}

func (c *TaskController) GetMyTaskHistory(ctx context.Context, req *connect.Request[api.GetMyTaskHistoryRequest]) (*connect.Response[api.GetMyTaskHistoryResponse], error) {
	applicant, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	events, err := c.service.GetHistoryMine(ctx, applicant.ID, req.Msg.Uuid)
	if err != nil {
		return nil, c.taskReadError(err, "loading task history failed")
	}
	response := &api.GetMyTaskHistoryResponse{Events: make([]*api.MyTaskHistoryEvent, 0, len(events))}
	for _, event := range events {
		response.Events = append(response.Events, &api.MyTaskHistoryEvent{
			Kind: event.Kind, CreatedAt: timestamppb.New(event.CreatedAt),
		})
	}
	return connect.NewResponse(response), nil
}

func (c *TaskController) taskReadError(err error, failureMessage string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return connect.NewError(connect.CodeNotFound, errors.New("task not found"))
	}
	return c.rpcError(err, failureMessage)
}

func (c *TaskController) rpcError(err error, failureMessage string) error {
	switch {
	case errors.Is(err, service.ErrInvalidTask):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, service.ErrTaskApplicantRequired):
		return connect.NewError(connect.CodeUnauthenticated, err)
	case errors.Is(err, storage.ErrQueueViewAccessDenied):
		return connect.NewError(connect.CodePermissionDenied, err)
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
