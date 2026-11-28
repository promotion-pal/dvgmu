package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	entity "fesmu/contract/tasks/entity"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type QueueController struct {
	service *service.QueueService
	log     *slog.Logger
}

func NewQueueController(service *service.QueueService, log *slog.Logger) *QueueController {
	return &QueueController{service: service, log: log}
}

func (c *QueueController) CreateQueue(ctx context.Context, req *connect.Request[api.CreateQueueRequest]) (*connect.Response[api.CreateQueueResponse], error) {
	queue, err := c.service.Create(ctx, req.Msg.Code, req.Msg.Name)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.CreateQueueResponse{Queue: queueMessage(queue)}), nil
}

func (c *QueueController) GetQueue(ctx context.Context, req *connect.Request[api.GetQueueRequest]) (*connect.Response[api.GetQueueResponse], error) {
	queue, err := c.service.Get(ctx, req.Msg.Code)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetQueueResponse{Queue: queueMessage(queue)}), nil
}

func (c *QueueController) ListQueues(ctx context.Context, req *connect.Request[api.ListQueuesRequest]) (*connect.Response[api.ListQueuesResponse], error) {
	queues, next, err := c.service.List(ctx, req.Msg.AfterCode, req.Msg.Active, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.ListQueuesResponse{Queues: make([]*entity.Queue, 0, len(queues)), NextAfterCode: next}
	for _, queue := range queues {
		response.Queues = append(response.Queues, queueMessage(queue))
	}
	return connect.NewResponse(response), nil
}

func (c *QueueController) UpdateQueue(ctx context.Context, req *connect.Request[api.UpdateQueueRequest]) (*connect.Response[api.UpdateQueueResponse], error) {
	queue, err := c.service.Update(ctx, req.Msg.Code, req.Msg.Name, req.Msg.Active)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateQueueResponse{Queue: queueMessage(queue)}), nil
}

func queueMessage(queue models.Queue) *entity.Queue {
	return &entity.Queue{Code: queue.Code, Name: queue.Name, Active: &queue.Active}
}

func (c *QueueController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidQueue):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("queue not found"))
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return connect.NewError(connect.CodeAlreadyExists, errors.New("queue code already exists"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("queue operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("queue operation failed"))
	}
}
