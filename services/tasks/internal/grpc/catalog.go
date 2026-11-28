package grpc

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	entity "fesmu/contract/tasks/entity"
	api "fesmu/contract/tasks/service"
	"gorm.io/gorm"
)

type CatalogController struct {
	service *service.CatalogService
	log     *slog.Logger
}

func NewCatalogController(service *service.CatalogService, log *slog.Logger) *CatalogController {
	return &CatalogController{service: service, log: log}
}

func (c *CatalogController) CreateService(ctx context.Context, req *connect.Request[api.CreateServiceRequest]) (*connect.Response[api.CreateServiceResponse], error) {
	entry, err := c.service.Create(ctx, req.Msg.DirectionId, req.Msg.Code, req.Msg.Name, req.Msg.Description, req.Msg.SortOrder)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.CreateServiceResponse{Service: entryMessage(entry)}), nil
}

func (c *CatalogController) GetService(ctx context.Context, req *connect.Request[api.GetServiceRequest]) (*connect.Response[api.GetServiceResponse], error) {
	entry, err := c.service.Get(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.GetServiceResponse{Service: entryMessage(entry)}), nil
}

func (c *CatalogController) ListServices(ctx context.Context, req *connect.Request[api.ListServicesRequest]) (*connect.Response[api.ListServicesResponse], error) {
	entries, next, err := c.service.List(ctx, req.Msg.DirectionId, req.Msg.AfterId, req.Msg.PageSize)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.ListServicesResponse{NextAfterId: next}
	for _, entry := range entries {
		response.Services = append(response.Services, entryMessage(entry))
	}
	return connect.NewResponse(response), nil
}

func (c *CatalogController) UpdateService(ctx context.Context, req *connect.Request[api.UpdateServiceRequest]) (*connect.Response[api.UpdateServiceResponse], error) {
	entry, err := c.service.Update(ctx, req.Msg.Id, service.ServiceUpdate{
		DirectionID: req.Msg.DirectionId, Description: req.Msg.Description, Code: req.Msg.Code, Name: req.Msg.Name, SortOrder: req.Msg.SortOrder, Active: req.Msg.Active,
	})
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.UpdateServiceResponse{Service: entryMessage(entry)}), nil
}

func (c *CatalogController) DeleteService(ctx context.Context, req *connect.Request[api.DeleteServiceRequest]) (*connect.Response[api.DeleteServiceResponse], error) {
	entry, err := c.service.Delete(ctx, req.Msg.Id)
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.DeleteServiceResponse{Service: entryMessage(entry)}), nil
}

func (c *CatalogController) GetServiceConfiguration(ctx context.Context, req *connect.Request[api.GetServiceConfigurationRequest]) (*connect.Response[api.GetServiceConfigurationResponse], error) {
	config, form, err := c.service.GetConfiguration(ctx, req.Msg.ServiceId)
	if err != nil {
		return nil, c.rpcError(err)
	}
	response := &api.GetServiceConfigurationResponse{
		Service: entryMessage(config.Entry),
		Form:    form,
		Routes:  routeMessages(config.Routes.Rules),
		Version: config.Version(),
	}
	if config.Settings.InitialStatusID != 0 {
		response.Settings = &api.ServiceSettings{
			InitialStatusId:   config.Settings.InitialStatusID,
			DefaultPriorityId: config.Settings.DefaultPriorityID,
		}
	}
	return connect.NewResponse(response), nil
}

func (c *CatalogController) SaveServiceConfiguration(ctx context.Context, req *connect.Request[api.SaveServiceConfigurationRequest]) (*connect.Response[api.SaveServiceConfigurationResponse], error) {
	input := req.Msg.Service
	if input == nil {
		return nil, c.rpcError(service.ErrInvalidService)
	}
	entry := models.Service{
		ID:          input.Id,
		DirectionID: input.DirectionId,
		Code:        input.Code,
		Name:        input.Name,
		Description: input.Description,
		SortOrder:   input.SortOrder,
		Active:      input.Active == nil || input.GetActive(),
	}
	var settings *models.ServiceSettings
	if input := req.Msg.Settings; input != nil {
		settings = &models.ServiceSettings{
			InitialStatusID:   input.InitialStatusId,
			DefaultPriorityID: input.DefaultPriorityId,
		}
	}
	id, err := c.service.SaveConfiguration(ctx, entry, req.Msg.ExpectedVersion, req.Msg.Form, settings, routeModels(req.Msg.Routes))
	if err != nil {
		return nil, c.rpcError(err)
	}
	return connect.NewResponse(&api.SaveServiceConfigurationResponse{ServiceId: id}), nil
}

func entryMessage(entry models.Service) *entity.Service {
	return &entity.Service{
		Id: entry.ID, DirectionId: entry.DirectionID, Description: entry.Description, Code: entry.Code, Name: entry.Name,
		SortOrder: entry.SortOrder, Active: &entry.Active,
	}
}

func (c *CatalogController) rpcError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidService), errors.Is(err, service.ErrInvalidServiceForm),
		errors.Is(err, service.ErrInvalidServiceRoutes), errors.Is(err, service.ErrInvalidServiceSettings):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, storage.ErrServiceConfigurationVersionConflict):
		return connect.NewError(connect.CodeAborted, err)
	case errors.Is(err, storage.ErrInitialStatusUnavailable), errors.Is(err, storage.ErrDefaultPriorityUnavailable),
		errors.Is(err, storage.ErrServiceRouteQueueUnavailable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, gorm.ErrRecordNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("service not found"))
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return connect.NewError(connect.CodeAlreadyExists, errors.New("service code already exists in this direction"))
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("direction does not exist or service is referenced by other records"))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err
	default:
		c.log.Error("catalog operation failed", "error", err)
		return connect.NewError(connect.CodeInternal, errors.New("catalog operation failed"))
	}
}
