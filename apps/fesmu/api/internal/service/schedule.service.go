package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	entity "dvgmu/api/contract/gen/go/entity/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type ScheduleSaver interface {
	ScheduleCreate(ctx context.Context, schedule *models.Schedule) (string, error)
	ScheduleUpdate(ctx context.Context, schedule *models.Schedule) error
	ScheduleDelete(ctx context.Context, id string) error
}

type ScheduleProvider interface {
	ScheduleFetch(ctx context.Context, filter models.ScheduleFilter) ([]*models.Schedule, error)
	ScheduleByID(ctx context.Context, id string) (*models.Schedule, error)
}

type ScheduleService struct {
	log      *slog.Logger
	saver    ScheduleSaver
	provider ScheduleProvider
}

func NewScheduleService(log *slog.Logger, saver ScheduleSaver, provider ScheduleProvider) *ScheduleService {
	return &ScheduleService{log: log, saver: saver, provider: provider}
}

func (s *ScheduleService) ScheduleFetch(ctx context.Context, filter models.ScheduleFilter) ([]*entity.ScheduleTimetable, error) {
	const op = "Schedule.ScheduleFetch"
	log := s.log.With(slog.String("op", op))

	records, err := s.provider.ScheduleFetch(ctx, filter)
	if err != nil {
		log.Error(utils.MSGFetchError("schedule", err))
		return nil, err
	}

	list := make([]*entity.ScheduleTimetable, 0, len(records))
	for _, record := range records {
		item, err := record.ToProto()
		if err != nil {
			// One unreadable document must not hide the others.
			log.Error("schedule record is unreadable, skipped", slog.String("schedule_id", record.ID), slog.String("error", err.Error()))
			continue
		}
		list = append(list, item)
	}

	log.Info(utils.MSGFetchSuccess("schedule", len(list)))
	return list, nil
}

func (s *ScheduleService) ScheduleByID(ctx context.Context, id string) (*entity.ScheduleTimetable, error) {
	const op = "Schedule.ScheduleByID"
	log := s.log.With(slog.String("op", op), slog.String("schedule_id", id))

	record, err := s.provider.ScheduleByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrScheduleNotFound) {
			log.Warn("schedule not found")
			return nil, err
		}
		log.Error(utils.MSGFetchByIDError("schedule", err))
		return nil, err
	}

	return record.ToProto()
}

func (s *ScheduleService) ScheduleCreate(ctx context.Context, timetable *entity.ScheduleTimetable) (string, error) {
	const op = "Schedule.ScheduleCreate"
	log := s.log.With(slog.String("op", op))

	schedule, err := models.NewSchedule(timetable)
	if err != nil {
		log.Warn(utils.MSGValidateFailed("schedule", err))
		return "", err
	}
	schedule.ID = uuid.NewString()

	id, err := s.saver.ScheduleCreate(ctx, schedule)
	if err != nil {
		log.Error(utils.MSGCreateError("schedule", err))
		return "", err
	}

	log.Info("schedule created", slog.String("schedule_id", id))
	return id, nil
}

func (s *ScheduleService) ScheduleUpdate(ctx context.Context, timetable *entity.ScheduleTimetable) error {
	const op = "Schedule.ScheduleUpdate"
	log := s.log.With(slog.String("op", op), slog.String("schedule_id", timetable.GetId()))

	if timetable.GetId() == "" {
		return fmt.Errorf("%w: не указан идентификатор расписания", models.ErrScheduleInvalid)
	}

	schedule, err := models.NewSchedule(timetable)
	if err != nil {
		log.Warn(utils.MSGValidateFailed("schedule", err))
		return err
	}

	if err := s.saver.ScheduleUpdate(ctx, schedule); err != nil {
		if errors.Is(err, models.ErrScheduleNotFound) {
			log.Warn("schedule not found")
			return err
		}
		log.Error(utils.MSGUpdateError("schedule", err))
		return err
	}

	log.Info("schedule updated")
	return nil
}

func (s *ScheduleService) ScheduleDelete(ctx context.Context, id string) error {
	const op = "Schedule.ScheduleDelete"
	log := s.log.With(slog.String("op", op), slog.String("schedule_id", id))

	if err := s.saver.ScheduleDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrScheduleNotFound) {
			log.Warn("schedule not found")
			return err
		}
		log.Error(utils.MSGDeleteError("schedule", err))
		return err
	}

	log.Info("schedule deleted")
	return nil
}
