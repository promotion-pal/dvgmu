package service

import (
	"context"
	"errors"
	"log/slog"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type InfrastructureSaver interface {
	InfrastructureCreate(ctx context.Context, infrastructure *models.Infrastructure) (int64, error)
	InfrastructureUpdate(ctx context.Context, infrastructure *models.Infrastructure) error
	InfrastructureDelete(ctx context.Context, id int64) error
}

type InfrastructureProvider interface {
	InfrastructureFetch(ctx context.Context) ([]*models.Infrastructure, error)
	InfrastructureByID(ctx context.Context, id int64) (*models.Infrastructure, error)
}

type InfrastructureService struct {
	log      *slog.Logger
	saver    InfrastructureSaver
	provider InfrastructureProvider
}

func NewInfrastructureService(log *slog.Logger, saver InfrastructureSaver, provider InfrastructureProvider) *InfrastructureService {
	return &InfrastructureService{log: log, saver: saver, provider: provider}
}

func (s *InfrastructureService) InfrastructureFetch(ctx context.Context) ([]*models.Infrastructure, error) {
	const op = "Infrastructure.InfrastructureFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.InfrastructureFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("infrastructure", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("infrastructure", len(list)))
	return list, nil
}

func (s *InfrastructureService) InfrastructureByID(ctx context.Context, id int64) (*models.Infrastructure, error) {
	const op = "Infrastructure.InfrastructureByID"
	log := s.log.With(slog.String("op", op), slog.Int64("infrastructure_id", id))

	item, err := s.provider.InfrastructureByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			log.Warn(utils.MSGNotFoundError("infrastructure", id))
			return nil, err
		}
		log.Error(utils.MSGDBFetchByIDError("infrastructure", id, err))
		return nil, err
	}

	return item, nil
}

func (s *InfrastructureService) InfrastructureCreate(ctx context.Context, params models.InfrastructureCreateParams) (int64, error) {
	const op = "Infrastructure.InfrastructureCreate"
	log := s.log.With(slog.String("op", op))

	infrastructure, err := models.NewInfrastructure(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("infrastructure", err))
		return 0, err
	}

	id, err := s.saver.InfrastructureCreate(ctx, infrastructure)
	if err != nil {
		log.Error(utils.MSGCreateError("infrastructure", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("infrastructure", id))
	return id, nil
}

func (s *InfrastructureService) InfrastructureUpdate(ctx context.Context, id int64, params models.InfrastructureCreateParams) error {
	const op = "Infrastructure.InfrastructureUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("infrastructure_id", id))

	if _, err := s.provider.InfrastructureByID(ctx, id); err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			log.Warn(utils.MSGNotFoundError("infrastructure", id))
			return err
		}
		log.Error(utils.MSGDBFetchByIDError("infrastructure", id, err))
		return err
	}

	infrastructure, err := models.NewInfrastructure(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("infrastructure", err))
		return err
	}
	infrastructure.ID = id

	if err := s.saver.InfrastructureUpdate(ctx, infrastructure); err != nil {
		log.Error(utils.MSGDBUpdateError("infrastructure", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("infrastructure", id))
	return nil
}

func (s *InfrastructureService) InfrastructureDelete(ctx context.Context, id int64) error {
	const op = "Infrastructure.InfrastructureDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("infrastructure_id", id))

	if err := s.saver.InfrastructureDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrInfrastructureNotFound) {
			log.Warn(utils.MSGNotFoundError("infrastructure", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("infrastructure", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("infrastructure", id))
	return nil
}
