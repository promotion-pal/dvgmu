package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type ServiceRoutesController struct {
	service *service.ServiceRoutesService
	log     *slog.Logger
}

func NewServiceRoutesController(service *service.ServiceRoutesService, log *slog.Logger) *ServiceRoutesController {
	return &ServiceRoutesController{service: service, log: log}
}

func (c *ServiceRoutesController) GetServiceRoutes(ctx context.Context, req *connect.Request[api.GetServiceRoutesRequest]) (*connect.Response[api.GetServiceRoutesResponse], error) {
	routes, err := c.service.Get(ctx, req.Msg.ServiceId)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetServiceRoutesResponse{
		ServiceId: routes.ServiceID, Version: routes.Version, Rules: routeMessages(routes.Rules),
	}), nil
}

func (c *ServiceRoutesController) UpdateServiceRoutes(ctx context.Context, req *connect.Request[api.UpdateServiceRoutesRequest]) (*connect.Response[api.UpdateServiceRoutesResponse], error) {
	routes, err := c.service.Update(ctx, req.Msg.ServiceId, req.Msg.ExpectedVersion, routeModels(req.Msg.Rules))
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateServiceRoutesResponse{
		ServiceId: routes.ServiceID, Version: routes.Version, Rules: routeMessages(routes.Rules),
	}), nil
}

func routeModels(messages []*api.ServiceRouteRule) []models.ServiceRouteRule {
	rules := make([]models.ServiceRouteRule, 0, len(messages))
	for _, rule := range messages {
		rules = append(rules, models.ServiceRouteRule{
			ApplicantDepartmentID: rule.GetApplicantDepartmentId(),
			QueueID:               rule.GetQueueId(),
			Active:                rule != nil && (rule.Active == nil || rule.GetActive()),
		})
	}
	return rules
}

func routeMessages(rules []models.ServiceRouteRule) []*api.ServiceRouteRule {
	messages := make([]*api.ServiceRouteRule, 0, len(rules))
	for _, rule := range rules {
		messages = append(messages, &api.ServiceRouteRule{
			ApplicantDepartmentId: rule.ApplicantDepartmentID,
			QueueId:               rule.QueueID,
			Active:                &rule.Active,
		})
	}
	return messages
}

func (c *ServiceRoutesController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidServiceRoutes):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("service not found"))
	case errors.Is(err, storage.ErrServiceRoutesVersionConflict):
		return connect.NewError(connect.CodeAborted, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("service routes operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("service routes operation failed"))
	}
}
