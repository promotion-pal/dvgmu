package grpc

import (
	"context"
	"errors"
	"fmt"
	"time"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	api "fesmu/contract/tasks/service"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (c *TaskController) ListMyTasks(ctx context.Context, req *connect.Request[api.ListMyTasksRequest]) (*connect.Response[api.ListMyTasksResponse], error) {
	applicant, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	filter, err := readTaskListFilter(req.Msg.ServiceId, req.Msg.StatusId, req.Msg.PriorityId, req.Msg.CreatedFrom, req.Msg.CreatedBefore)
	if err != nil {
		return nil, err
	}
	var after *models.TaskListCursor
	if req.Msg.After != nil {
		after, err = readTaskListCursor(req.Msg.After.CreatedAt, req.Msg.After.Uuid)
		if err != nil {
			return nil, err
		}
	}

	tasks, next, err := c.service.ListMine(ctx, applicant.ID, filter, after, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err, "listing tasks failed")
	}
	response := &api.ListMyTasksResponse{Tasks: make([]*api.MyTaskListItem, 0, len(tasks))}
	for _, item := range tasks {
		response.Tasks = append(response.Tasks, &api.MyTaskListItem{
			Uuid: item.UUID, Number: item.Number, Title: item.Title, CreatedAt: timestamppb.New(item.CreatedAt),
			ServiceId: item.ServiceID, ServiceName: item.ServiceName,
			StatusId: item.StatusID, StatusName: item.StatusName,
			PriorityId: item.PriorityID, PriorityName: item.PriorityName,
		})
	}
	if next != nil {
		response.NextCursor = &api.MyTasksCursor{CreatedAt: timestamppb.New(next.CreatedAt), Uuid: next.UUID}
	}
	return connect.NewResponse(response), nil
}

func (c *TaskController) ListQueueTasks(ctx context.Context, req *connect.Request[api.ListQueueTasksRequest]) (*connect.Response[api.ListQueueTasksResponse], error) {
	viewer, err := c.applicant.Resolve(ctx, req.Header())
	if err != nil {
		return nil, err
	}
	filter, err := readTaskListFilter(req.Msg.ServiceId, req.Msg.StatusId, req.Msg.PriorityId, req.Msg.CreatedFrom, req.Msg.CreatedBefore)
	if err != nil {
		return nil, err
	}
	var after *models.TaskListCursor
	if req.Msg.After != nil {
		after, err = readTaskListCursor(req.Msg.After.CreatedAt, req.Msg.After.Uuid)
		if err != nil {
			return nil, err
		}
	}

	tasks, next, err := c.service.ListQueue(ctx, viewer.ID, req.Msg.QueueCode, filter, after, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err, "listing queue tasks failed")
	}
	response := &api.ListQueueTasksResponse{Tasks: make([]*api.QueueTaskListItem, 0, len(tasks))}
	for _, item := range tasks {
		response.Tasks = append(response.Tasks, &api.QueueTaskListItem{
			Uuid: item.UUID, Number: item.Number, Title: item.Title, CreatedAt: timestamppb.New(item.CreatedAt),
			ServiceId: item.ServiceID, ServiceName: item.ServiceName,
			StatusId: item.StatusID, StatusName: item.StatusName,
			PriorityId: item.PriorityID, PriorityName: item.PriorityName,
		})
	}
	if next != nil {
		response.NextCursor = &api.QueueTasksCursor{CreatedAt: timestamppb.New(next.CreatedAt), Uuid: next.UUID}
	}
	return connect.NewResponse(response), nil
}

func readTaskListFilter(serviceID, statusID, priorityID *int64, createdFrom, createdBefore *timestamppb.Timestamp) (models.TaskListFilter, error) {
	from, err := taskListTimestamp(createdFrom, "created_from")
	if err != nil {
		return models.TaskListFilter{}, err
	}
	before, err := taskListTimestamp(createdBefore, "created_before")
	if err != nil {
		return models.TaskListFilter{}, err
	}
	return models.TaskListFilter{
		ServiceID: serviceID, StatusID: statusID, PriorityID: priorityID,
		CreatedFrom: from, CreatedBefore: before,
	}, nil
}

func taskListTimestamp(value *timestamppb.Timestamp, field string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}
	if err := value.CheckValid(); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid %s: %w", field, err))
	}
	converted := value.AsTime()
	return &converted, nil
}

func readTaskListCursor(timestamp *timestamppb.Timestamp, taskUUID string) (*models.TaskListCursor, error) {
	createdAt, err := taskListTimestamp(timestamp, "after.created_at")
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(taskUUID)
	if createdAt == nil || err != nil || id == uuid.Nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("after requires a creation timestamp and task UUID"))
	}
	return &models.TaskListCursor{CreatedAt: *createdAt, UUID: id.String()}, nil
}
