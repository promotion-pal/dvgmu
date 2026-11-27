package service

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	entity "fesmu/contract/fesmu/entity/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
)

type ScheduleCollectStore interface {
	ScheduleCollectCreate(ctx context.Context, entry *models.ScheduleCollect) (string, error)
	ScheduleCollectFetch(ctx context.Context, offset, limit int) ([]models.ScheduleCollect, error)
}

type ScheduleCollectService struct {
	log   *slog.Logger
	store ScheduleCollectStore
}

func NewScheduleCollectService(log *slog.Logger, store ScheduleCollectStore) *ScheduleCollectService {
	return &ScheduleCollectService{log: log, store: store}
}

func (s *ScheduleCollectService) ScheduleCollectCreate(ctx context.Context, authorUUID string, e *entity.ScheduleCollectEntry) (*entity.ScheduleCollectEntry, error) {
	const op = "ScheduleCollect.ScheduleCollectCreate"
	log := s.log.With(slog.String("op", op))

	entry, err := models.NewScheduleCollect(e)
	if err != nil {
		log.Warn(utils.MSGValidateFailed("schedule collect entry", err))
		return nil, err
	}
	entry.ID = uuid.NewString()
	entry.AuthorUUID = &authorUUID

	if _, err := s.store.ScheduleCollectCreate(ctx, entry); err != nil {
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

func (s *ScheduleCollectService) ScheduleCollectFetch(ctx context.Context, offset uint32) ([]*entity.ScheduleCollectEntry, bool, error) {
	const pageSize = 50
	entries, err := s.store.ScheduleCollectFetch(ctx, int(offset), pageSize+1)
	if err != nil {
		s.log.Error("schedule collect fetch failed", "error", err)
		return nil, false, err
	}
	hasMore := len(entries) > pageSize
	if hasMore {
		entries = entries[:pageSize]
	}
	items := make([]*entity.ScheduleCollectEntry, 0, len(entries))
	for _, entry := range entries {
		items = append(items, entry.ToProto())
	}
	return items, hasMore, nil
}
