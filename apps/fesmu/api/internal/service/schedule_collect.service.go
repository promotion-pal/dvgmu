package service

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	entity "fesmu/contract/fesmu/entity/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type ScheduleCollectSaver interface {
	ScheduleCollectCreate(ctx context.Context, entry *models.ScheduleCollect) (string, error)
}

type ScheduleCollectService struct {
	log   *slog.Logger
	saver ScheduleCollectSaver
}

func NewScheduleCollectService(log *slog.Logger, saver ScheduleCollectSaver) *ScheduleCollectService {
	return &ScheduleCollectService{log: log, saver: saver}
}

func (s *ScheduleCollectService) ScheduleCollectCreate(ctx context.Context, e *entity.ScheduleCollectEntry) (*entity.ScheduleCollectEntry, error) {
	const op = "ScheduleCollect.ScheduleCollectCreate"
	log := s.log.With(slog.String("op", op))

	entry, err := models.NewScheduleCollect(e)
	if err != nil {
		log.Warn(utils.MSGValidateFailed("schedule collect entry", err))
		return nil, err
	}
	entry.ID = uuid.NewString()

	if _, err := s.saver.ScheduleCollectCreate(ctx, entry); err != nil {
		log.Error(utils.MSGCreateError("schedule collect entry", err))
		return nil, err
	}

	log.Info("schedule collect entry created",
		slog.String("schedule_collect_id", entry.ID),
		slog.String("group", entry.GroupName),
		slog.String("date", entry.Date),
	)
	return entry.ToProto(), nil
}
