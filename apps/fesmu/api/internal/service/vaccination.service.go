package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type VaccinationSaver interface {
	VaccinationDayCreate(ctx context.Context, day *models.VaccinationDay) (int64, error)
	VaccinationDayDelete(ctx context.Context, id int64) error
	VaccinationSignupCreate(ctx context.Context, signup *models.VaccinationSignup, today string) (int64, error)
	VaccinationSignupDelete(ctx context.Context, id int64) error
}

type VaccinationProvider interface {
	VaccinationDayFetch(ctx context.Context, dateFrom string) ([]*models.VaccinationDay, error)
}

type VaccinationService struct {
	log      *slog.Logger
	saver    VaccinationSaver
	provider VaccinationProvider
	now      func() time.Time
}

func NewVaccinationService(log *slog.Logger, saver VaccinationSaver, provider VaccinationProvider) *VaccinationService {
	return &VaccinationService{log: log, saver: saver, provider: provider, now: time.Now}
}

func (s *VaccinationService) VaccinationDayFetch(ctx context.Context, dateFrom string) ([]*models.VaccinationDay, error) {
	const op = "Vaccination.VaccinationDayFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.VaccinationDayFetch(ctx, dateFrom)
	if err != nil {
		log.Error(utils.MSGFetchError("vaccination day", err))
		return nil, err
	}
	return list, nil
}

func (s *VaccinationService) VaccinationDayCreate(ctx context.Context, params models.VaccinationDayParams) (int64, error) {
	const op = "Vaccination.VaccinationDayCreate"
	log := s.log.With(slog.String("op", op))

	day, err := models.NewVaccinationDay(params, s.now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("vaccination day", err))
		return 0, err
	}

	id, err := s.saver.VaccinationDayCreate(ctx, day)
	if err != nil {
		log.Error(utils.MSGCreateError("vaccination day", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("vaccination day", id))
	return id, nil
}

func (s *VaccinationService) VaccinationDayDelete(ctx context.Context, id int64) error {
	const op = "Vaccination.VaccinationDayDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("vaccination_day_id", id))

	if err := s.saver.VaccinationDayDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrVaccinationDayNotFound) {
			log.Warn(utils.MSGNotFoundError("vaccination day", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("vaccination day", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("vaccination day", id))
	return nil
}

// VaccinationSignupCreate is open to anyone: the sign-up page has no login.
func (s *VaccinationService) VaccinationSignupCreate(ctx context.Context, slotID int64, fullName string, consent bool) (int64, error) {
	const op = "Vaccination.VaccinationSignupCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("vaccination_slot_id", slotID))

	now := s.now()
	signup, err := models.NewVaccinationSignup(slotID, fullName, consent, now)
	if err != nil {
		log.Warn(utils.MSGValidateFailed("vaccination signup", err))
		return 0, err
	}

	id, err := s.saver.VaccinationSignupCreate(ctx, signup, now.Format("2006-01-02"))
	if err != nil {
		switch {
		case errors.Is(err, models.ErrVaccinationSlotNotFound),
			errors.Is(err, models.ErrVaccinationSlotFull),
			errors.Is(err, models.ErrVaccinationAlreadySignedUp):
			log.Warn("vaccination signup rejected", slog.String("reason", err.Error()))
		default:
			log.Error(utils.MSGCreateError("vaccination signup", err))
		}
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("vaccination signup", id))
	return id, nil
}

func (s *VaccinationService) VaccinationSignupDelete(ctx context.Context, id int64) error {
	const op = "Vaccination.VaccinationSignupDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("vaccination_signup_id", id))

	if err := s.saver.VaccinationSignupDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrVaccinationSignupNotFound) {
			log.Warn(utils.MSGNotFoundError("vaccination signup", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("vaccination signup", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("vaccination signup", id))
	return nil
}
