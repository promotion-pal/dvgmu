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
	from, err := taskListTimestamp(req.Msg.CreatedFrom, "created_from")
	if err != nil {
		return nil, err
	}
	before, err := taskListTimestamp(req.Msg.CreatedBefore, "created_before")
	if err != nil {
		return nil, err
	}
	after, err := readMyTasksCursor(req.Msg.After)
	if err != nil {
		return nil, err
	}
	filter := models.MyTasksFilter{
		ServiceID: req.Msg.ServiceId, StatusID: req.Msg.StatusId, PriorityID: req.Msg.PriorityId,
		CreatedFrom: from, CreatedBefore: before,
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

func readMyTasksCursor(after *api.MyTasksCursor) (*models.MyTasksCursor, error) {
	if after == nil {
		return nil, nil
	}
	createdAt, err := taskListTimestamp(after.CreatedAt, "after.created_at")
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(after.Uuid)
	if createdAt == nil || err != nil || id == uuid.Nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("after requires a creation timestamp and task UUID"))
	}
	return &models.MyTasksCursor{CreatedAt: *createdAt, UUID: id.String()}, nil
}
