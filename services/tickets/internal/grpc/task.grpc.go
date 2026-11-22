package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"dvgmu/tickets/internal/domain/models"
	"dvgmu/tickets/internal/service"
	entity "fesmu/contract/tickets/entity"
	servicepb "fesmu/contract/tickets/service"
)

type TaskController struct {
	service *service.TaskService
}

func NewTaskController(taskService *service.TaskService) *TaskController {
	return &TaskController{service: taskService}
}

func (c *TaskController) CreateTask(ctx context.Context, req *connect.Request[servicepb.CreateTaskRequest]) (*connect.Response[servicepb.CreateTaskResponse], error) {
	task, err := c.service.Create(ctx, req.Msg.GetUserId(), req.Msg.GetTitle())
	if err != nil {
		return nil, taskError(err)
	}
	return connect.NewResponse(&servicepb.CreateTaskResponse{Task: toProtoTask(task)}), nil
}

func (c *TaskController) ListTasks(ctx context.Context, req *connect.Request[servicepb.ListTasksRequest]) (*connect.Response[servicepb.ListTasksResponse], error) {
	tasks, err := c.service.Fetch(ctx, req.Msg.GetUserId())
	if err != nil {
		return nil, taskError(err)
	}
	response := &servicepb.ListTasksResponse{Tasks: make([]*entity.Task, 0, len(tasks))}
	for i := range tasks {
		response.Tasks = append(response.Tasks, toProtoTask(&tasks[i]))
	}
	return connect.NewResponse(response), nil
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
