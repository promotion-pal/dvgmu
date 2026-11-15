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
	task, err := c.service.Create(ctx, req.Msg.GetTitle())
	if err != nil {
		if errors.Is(err, models.ErrTitleRequired) {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&servicepb.CreateTaskResponse{Task: toProtoTask(task)}), nil
}

func (c *TaskController) ListTasks(ctx context.Context, _ *connect.Request[servicepb.ListTasksRequest]) (*connect.Response[servicepb.ListTasksResponse], error) {
	tasks, err := c.service.Fetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	response := &servicepb.ListTasksResponse{Tasks: make([]*entity.Task, 0, len(tasks))}
	for i := range tasks {
		response.Tasks = append(response.Tasks, toProtoTask(&tasks[i]))
	}
	return connect.NewResponse(response), nil
}

func toProtoTask(task *models.Task) *entity.Task {
	return &entity.Task{Id: task.ID, Title: task.Title, CreatedAt: task.CreatedAt.Unix()}
}
