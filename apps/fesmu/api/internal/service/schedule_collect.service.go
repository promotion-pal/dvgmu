package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
	entity "fesmu/contract/fesmu/entity/v1"
)

type ScheduleCollectStore interface {
	ScheduleCollectCreate(ctx context.Context, entry *models.ScheduleCollect) (string, error)
	ScheduleCollectBatchCreate(ctx context.Context, batch models.ScheduleCollectBatch, entries []models.ScheduleCollect) ([]models.ScheduleCollect, error)
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

func (s *ScheduleCollectService) ScheduleCollectBatchCreate(ctx context.Context, authorUUID, batchID string, items []*entity.ScheduleCollectEntry) ([]*entity.ScheduleCollectEntry, error) {
	if id, err := uuid.Parse(batchID); err != nil || id == uuid.Nil || id.String() != batchID {
		return nil, fmt.Errorf("%w: неверный идентификатор пакета", models.ErrScheduleCollectInvalid)
	}
	if len(items) < 1 || len(items) > 50 {
		return nil, fmt.Errorf("%w: в пакете должно быть от 1 до 50 строк", models.ErrScheduleCollectInvalid)
	}
	entries := make([]models.ScheduleCollect, 0, len(items))
	seen := make(map[[sha256.Size]byte]uint32)
	hash := sha256.New()
	created := time.Now()
	for i, item := range items {
		row := uint32(i + 1)
		if strings.TrimSpace(item.GetGroup()) == "" {
			return nil, fmt.Errorf("%w: строка %d: укажите группу", models.ErrScheduleCollectInvalid, row)
		}
		input := proto.CloneOf(item)
		lessonDate, err := time.Parse(time.DateOnly, input.GetDate())
		if err != nil {
			return nil, fmt.Errorf("%w: строка %d: укажите дату занятия в формате ГГГГ-ММ-ДД", models.ErrScheduleCollectInvalid, row)
		}
		input.Day = int32((lessonDate.Weekday()+6)%7 + 1)
		entry, err := models.NewScheduleCollect(input)
		if err != nil {
			return nil, fmt.Errorf("строка %d: %w", row, err)
		}
		if err := entry.NormalizeBatchText(); err != nil {
			return nil, fmt.Errorf("строка %d: %w", row, err)
		}
		data := entry.ToProto()
		data.CreatedAt = nil
		encoded, err := proto.MarshalOptions{Deterministic: true}.Marshal(data)
		if err != nil {
			return nil, err
		}
		digest := sha256.Sum256(encoded)
		if other := seen[digest]; other != 0 {
			return nil, fmt.Errorf("%w: строка %d повторяет строку %d", models.ErrScheduleCollectInvalid, row, other)
		}
		seen[digest] = row
		_, _ = hash.Write(digest[:])
		entry.ID = uuid.NewString()
		entry.AuthorUUID = &authorUUID
		entry.BatchID = &batchID
		entry.BatchRow = &row
		entry.CreatedAt = created
		entries = append(entries, *entry)
	}
	batch := models.ScheduleCollectBatch{ID: batchID, AuthorUUID: authorUUID, PayloadHash: fmt.Sprintf("%x", hash.Sum(nil))}
	stored, err := s.store.ScheduleCollectBatchCreate(ctx, batch, entries)
	if err != nil {
		s.log.Error("schedule collect batch create failed", "batch_id", batchID, "error", err)
		return nil, err
	}
	result := make([]*entity.ScheduleCollectEntry, 0, len(stored))
	for _, entry := range stored {
		result = append(result, entry.ToProto())
	}
	return result, nil
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
