package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type ComputerClassSaver interface {
	ComputerClassSessionCreate(ctx context.Context, session *models.ComputerClassSession) (int64, error)
	ComputerClassSessionUpdate(ctx context.Context, session *models.ComputerClassSession) error
	ComputerClassSessionDelete(ctx context.Context, id int64) error
}

type ComputerClassProvider interface {
	ComputerClassSessionFetch(ctx context.Context, filter models.ComputerClassSessionFilter) ([]*models.ComputerClassSession, error)
}

type ComputerClassService struct {
	log      *slog.Logger
	saver    ComputerClassSaver
	provider ComputerClassProvider
}

func NewComputerClassService(log *slog.Logger, saver ComputerClassSaver, provider ComputerClassProvider) *ComputerClassService {
	return &ComputerClassService{log: log, saver: saver, provider: provider}
}

func (s *ComputerClassService) ComputerClassSessionFetch(ctx context.Context, filter models.ComputerClassSessionFilter) ([]*models.ComputerClassSession, error) {
	const op = "ComputerClass.ComputerClassSessionFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.ComputerClassSessionFetch(ctx, filter)
	if err != nil {
		log.Error(utils.MSGFetchError("computer class session", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("computer class session", len(list)))
	return list, nil
}

func (s *ComputerClassService) ComputerClassSessionCreate(ctx context.Context, params models.ComputerClassSessionParams) (int64, error) {
	const op = "ComputerClass.ComputerClassSessionCreate"
	log := s.log.With(slog.String("op", op))

	session, err := models.NewComputerClassSession(params, time.Now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("computer class session", err))
		return 0, err
	}

	id, err := s.saver.ComputerClassSessionCreate(ctx, session)
	if err != nil {
		s.logWriteError(log, session, err, utils.MSGCreateError("computer class session", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("computer class session", id))
	return id, nil
}

func (s *ComputerClassService) ComputerClassSessionUpdate(ctx context.Context, id int64, params models.ComputerClassSessionParams) error {
	const op = "ComputerClass.ComputerClassSessionUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("computer_class_session_id", id))

	session, err := models.NewComputerClassSession(params, time.Now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("computer class session", err))
		return err
	}
	session.ID = id

	if err := s.saver.ComputerClassSessionUpdate(ctx, session); err != nil {
		s.logWriteError(log, session, err, utils.MSGDBUpdateError("computer class session", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("computer class session", id))
	return nil
}

func (s *ComputerClassService) ComputerClassSessionDelete(ctx context.Context, id int64) error {
	const op = "ComputerClass.ComputerClassSessionDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("computer_class_session_id", id))

	if err := s.saver.ComputerClassSessionDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrComputerClassSessionNotFound) {
			log.Warn(utils.MSGNotFoundError("computer class session", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("computer class session", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("computer class session", id))
	return nil
}

func (s *ComputerClassService) logWriteError(log *slog.Logger, session *models.ComputerClassSession, err error, msg string) {
	if errors.Is(err, models.ErrComputerClassSessionNotFound) {
		log.Warn(utils.MSGNotFoundError("computer class session", session.ID))
		return
	}
	log.Error(msg)
}
