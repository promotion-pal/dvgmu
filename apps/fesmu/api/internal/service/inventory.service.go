package service

import (
	"context"
	"errors"
	"log/slog"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type InventorySaver interface {
	InventoryCreate(ctx context.Context, inventory *models.Inventory) (int64, error)
	InventoryUpdate(ctx context.Context, inventory *models.Inventory) error
	InventoryDelete(ctx context.Context, id int64) error
}

type InventoryProvider interface {
	InventoryFetch(ctx context.Context) ([]*models.Inventory, error)
	InventoryByID(ctx context.Context, id int64) (*models.Inventory, error)
}

type InventoryService struct {
	log      *slog.Logger
	saver    InventorySaver
	provider InventoryProvider
}

func NewInventoryService(log *slog.Logger, saver InventorySaver, provider InventoryProvider) *InventoryService {
	return &InventoryService{log: log, saver: saver, provider: provider}
}

func (s *InventoryService) InventoryFetch(ctx context.Context) ([]*models.Inventory, error) {
	const op = "Inventory.InventoryFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.InventoryFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("inventory", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("inventory", len(list)))
	return list, nil
}

func (s *InventoryService) InventoryByID(ctx context.Context, id int64) (*models.Inventory, error) {
	const op = "Inventory.InventoryByID"
	log := s.log.With(slog.String("op", op), slog.Int64("inventory_id", id))

	item, err := s.provider.InventoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			log.Warn(utils.MSGNotFoundError("inventory", id))
			return nil, err
		}
		log.Error(utils.MSGDBFetchByIDError("inventory", id, err))
		return nil, err
	}

	return item, nil
}

func (s *InventoryService) InventoryCreate(ctx context.Context, params models.InventoryCreateParams) (int64, error) {
	const op = "Inventory.InventoryCreate"
	log := s.log.With(slog.String("op", op))

	inventory, err := models.NewInventory(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("inventory", err))
		return 0, err
	}

	id, err := s.saver.InventoryCreate(ctx, inventory)
	if err != nil {
		log.Error(utils.MSGCreateError("inventory", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("inventory", id))
	return id, nil
}

func (s *InventoryService) InventoryUpdate(ctx context.Context, id int64, params models.InventoryCreateParams) error {
	const op = "Inventory.InventoryUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("inventory_id", id))

	if _, err := s.provider.InventoryByID(ctx, id); err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			log.Warn(utils.MSGNotFoundError("inventory", id))
			return err
		}
		log.Error(utils.MSGDBFetchByIDError("inventory", id, err))
		return err
	}

	inventory, err := models.NewInventory(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("inventory", err))
		return err
	}
	inventory.ID = id

	if err := s.saver.InventoryUpdate(ctx, inventory); err != nil {
		log.Error(utils.MSGDBUpdateError("inventory", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("inventory", id))
	return nil
}

func (s *InventoryService) InventoryDelete(ctx context.Context, id int64) error {
	const op = "Inventory.InventoryDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("inventory_id", id))

	if err := s.saver.InventoryDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrInventoryNotFound) {
			log.Warn(utils.MSGNotFoundError("inventory", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("inventory", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("inventory", id))
	return nil
}
