package grpc

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"

	"connectrpc.com/connect"
	"dvgmu/tickets/internal/domain/models"
	"dvgmu/tickets/internal/service"
	entity "fesmu/contract/tickets/entity"
	servicepb "fesmu/contract/tickets/service"
)

type TaskController struct {
	service      *service.TaskService
	sharedSecret string
}

func NewTaskController(taskService *service.TaskService, sharedSecret string) *TaskController {
	return &TaskController{service: taskService, sharedSecret: sharedSecret}
}

func (c *TaskController) CreateTask(ctx context.Context, req *connect.Request[servicepb.CreateTaskRequest]) (*connect.Response[servicepb.CreateTaskResponse], error) {
	userID, err := c.authenticatedUserID(req.Header())
	if err != nil {
		return nil, err
	}
	task, err := c.service.Create(ctx, userID, req.Msg.GetTitle())
	if err != nil {
		return nil, taskError(err)
	}
	return connect.NewResponse(&servicepb.CreateTaskResponse{Task: toProtoTask(task)}), nil
}

func (c *TaskController) ListTasks(ctx context.Context, req *connect.Request[servicepb.ListTasksRequest]) (*connect.Response[servicepb.ListTasksResponse], error) {
	userID, err := c.authenticatedUserID(req.Header())
	if err != nil {
		return nil, err
	}
	tasks, err := c.service.Fetch(ctx, userID)
	if err != nil {
		return nil, taskError(err)
	}
	response := &servicepb.ListTasksResponse{Tasks: make([]*entity.Task, 0, len(tasks))}
	for i := range tasks {
		response.Tasks = append(response.Tasks, toProtoTask(&tasks[i]))
	}
	return connect.NewResponse(response), nil
}

func (c *TaskController) authenticatedUserID(header http.Header) (int64, error) {
	if c.sharedSecret == "" || subtle.ConstantTimeCompare([]byte(header.Get("X-Gateway-Secret")), []byte(c.sharedSecret)) != 1 {
		return 0, connect.NewError(connect.CodeUnauthenticated, errors.New("trusted gateway identity required"))
	}
	userID, err := strconv.ParseInt(header.Get("X-Authenticated-User-ID"), 10, 64)
	if err != nil || userID <= 0 {
		return 0, connect.NewError(connect.CodeUnauthenticated, models.ErrUserIDRequired)
	}
	return userID, nil
}

func taskError(err error) error {
	switch {
	case errors.Is(err, models.ErrPermissionDenied):
		return connect.NewError(connect.CodePermissionDenied, err)
	case errors.Is(err, models.ErrUserIDRequired), errors.Is(err, models.ErrTitleRequired):
		return connect.NewError(connect.CodeInvalidArgument, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}

func toProtoTask(task *models.Task) *entity.Task {
	return &entity.Task{Id: task.ID, Title: task.Title, CreatedAt: task.CreatedAt.Unix()}
}
