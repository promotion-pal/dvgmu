package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type HallSaver interface {
	HallBookingCreate(ctx context.Context, booking *models.HallBooking) (int64, error)
	HallBookingDelete(ctx context.Context, id int64) error
}

type HallProvider interface {
	HallFetch(ctx context.Context) ([]*models.Hall, error)
	HallBookingFetch(ctx context.Context, filter models.HallBookingFilter) ([]*models.HallBooking, error)
}

type HallService struct {
	log      *slog.Logger
	saver    HallSaver
	provider HallProvider
}

func NewHallService(log *slog.Logger, saver HallSaver, provider HallProvider) *HallService {
	return &HallService{log: log, saver: saver, provider: provider}
}

func (s *HallService) HallFetch(ctx context.Context) ([]*models.Hall, error) {
	const op = "Hall.HallFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.HallFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("hall", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("hall", len(list)))
	return list, nil
}

func (s *HallService) HallBookingFetch(ctx context.Context, filter models.HallBookingFilter) ([]*models.HallBooking, error) {
	const op = "Hall.HallBookingFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.HallBookingFetch(ctx, filter)
	if err != nil {
		log.Error(utils.MSGFetchError("hall booking", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("hall booking", len(list)))
	return list, nil
}

// HallBookingCreate books a hall. It is open to anyone (the public booking
// page has no login); overlaps are rejected by the storage under a hall lock.
func (s *HallService) HallBookingCreate(ctx context.Context, params models.HallBookingCreateParams) (int64, error) {
	const op = "Hall.HallBookingCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("hall_id", params.HallID))

	booking, err := models.NewHallBooking(params, time.Now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("hall booking", err))
		return 0, err
	}

	id, err := s.saver.HallBookingCreate(ctx, booking)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrHallNotFound):
			log.Warn(utils.MSGNotFoundError("hall", booking.HallID))
		case errors.Is(err, models.ErrHallBookingTaken):
			log.Warn("hall is already booked",
				slog.String("date", booking.Date),
				slog.String("time_start", booking.TimeStart),
				slog.String("time_end", booking.TimeEnd),
			)
		default:
			log.Error(utils.MSGCreateError("hall booking", err))
		}
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("hall booking", id))
	return id, nil
}

func (s *HallService) HallBookingDelete(ctx context.Context, id int64) error {
	const op = "Hall.HallBookingDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("hall_booking_id", id))

	if err := s.saver.HallBookingDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrHallBookingNotFound) {
			log.Warn(utils.MSGNotFoundError("hall booking", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("hall booking", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("hall booking", id))
	return nil
}
