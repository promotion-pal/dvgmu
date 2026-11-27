package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	"dvgmu/schedula/internal/domain/models"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
	rpc "fesmu/contract/schedula/service"
)

const (
	pending  = scheduleenum.ChangeStatus_CHANGE_STATUS_PENDING
	approved = scheduleenum.ChangeStatus_CHANGE_STATUS_APPROVED
	rejected = scheduleenum.ChangeStatus_CHANGE_STATUS_REJECTED
)

func (s *Service) CreateChange(ctx context.Context, in *rpc.ChangeCreateRequest, actor Actor) (*rpc.ChangeCreateResponse, error) {
	result := &rpc.ChangeCreateResponse{}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" {
		return nil, invalid("укажите причину изменения")
	}
	var groups []Group
	if in.Type != scheduleenum.ChangeType_CHANGE_TYPE_CANCEL {
		var err error
		groups, err = s.groups(ctx)
		if err != nil {
			return nil, err
		}
	}
	err := s.store.Write(ctx, func(tx *storage.Storage) error {
		before, err := eventByID(ctx, tx, in.EventId)
		if err != nil {
			return err
		}
		if !actor.CanEdit && (!actor.Teacher || before.InstructorID != actor.ID) {
			return denied()
		}
		if err := requireRevision(before, in.Revision, published); err != nil {
			return err
		}
		var c catalog
		if in.Type != scheduleenum.ChangeType_CHANGE_TYPE_CANCEL {
			c, err = loadCatalog(ctx, tx, false)
			if err != nil {
				return err
			}
		}
		after, err := proposedEvent(before, in, c)
		if err != nil {
			return err
		}
		if after.Status != cancelled {
			result.Issues, err = check(ctx, tx, attendance(after, groups), false)
			if err != nil || len(result.Issues) != 0 {
				return err
			}
		}
		alreadyPending, err := tx.PendingChange(ctx, before.ID)
		if err != nil {
			return err
		}
		if alreadyPending {
			return connect.NewError(connect.CodeAlreadyExists, errors.New("по занятию уже есть заявка на согласовании"))
		}
		change := &models.Change{
			ID: newID(), EventID: before.ID, EventRevision: before.Revision, Type: in.Type, Status: pending,
			Before: before, After: after, Reason: reason, AuthorID: actor.ID, SubmittedAt: time.Now(),
		}
		if err := tx.InsertChange(ctx, change); err != nil {
			return err
		}
		result.Change = changeProto(*change)
		return nil
	})
	return result, err
}

func proposedEvent(before models.Event, in *rpc.ChangeCreateRequest, c catalog) (models.Event, error) {
	input := eventSnapshot(before, before.Status).Details
	switch in.Type {
	case scheduleenum.ChangeType_CHANGE_TYPE_MOVE:
		if in.Date == "" || in.StartMinute == nil {
			return models.Event{}, invalid("укажите новую дату и время")
		}
		if in.Date == input.Date && in.GetStartMinute() == input.GetStartMinute() {
			return models.Event{}, invalid("измените дату или время занятия")
		}
		input.Date, input.StartMinute = in.Date, in.StartMinute
	case scheduleenum.ChangeType_CHANGE_TYPE_INSTRUCTOR:
		instructor := strings.TrimSpace(in.InstructorId)
		if instructor == "" || instructor == input.InstructorId {
			return models.Event{}, invalid("выберите другого преподавателя")
		}
		input.InstructorId = instructor
	case scheduleenum.ChangeType_CHANGE_TYPE_ROOM:
		if in.RoomId == "" || in.RoomId == input.RoomId {
			return models.Event{}, invalid("выберите другую площадку")
		}
		input.RoomId, input.MeetingPoint = in.RoomId, in.MeetingPoint
	case scheduleenum.ChangeType_CHANGE_TYPE_CANCEL:
		before.Status, before.ChangeType = cancelled, in.Type
		before.Revision++
		return before, nil
	default:
		return models.Event{}, invalid("выберите тип изменения")
	}
	after, err := c.event(input)
	if err != nil {
		return after, err
	}
	after.ID, after.Status, after.SeriesID = before.ID, before.Status, before.SeriesID
	after.CreatedAt, after.AuthorID, after.UpdatedAt = before.CreatedAt, before.AuthorID, before.UpdatedAt
	after.ChangeType, after.Revision = in.Type, before.Revision+1
	return after, nil
}

func (s *Service) DecideChange(ctx context.Context, in *rpc.ChangeDecideRequest, actor Actor) (*rpc.ChangeDecideResponse, error) {
	if !validID(in.Id) {
		return nil, invalid("некорректный идентификатор заявки")
	}
	result := &rpc.ChangeDecideResponse{}
	decision := strings.TrimSpace(in.Decision)
	if !in.Approve && decision == "" {
		return nil, invalid("укажите причину отклонения")
	}
	var groups []Group
	if in.Approve {
		var err error
		groups, err = s.groups(ctx)
		if err != nil {
			return nil, err
		}
	}
	err := s.store.Write(ctx, func(tx *storage.Storage) error {
		change, err := tx.Change(ctx, in.Id)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return connect.NewError(connect.CodeNotFound, errors.New("заявка не найдена"))
		}
		if err != nil {
			return err
		}
		if change.Status != pending {
			return connect.NewError(connect.CodeFailedPrecondition, errors.New("по заявке уже принято решение"))
		}
		change.Status = rejected
		if in.Approve {
			e, err := eventByID(ctx, tx, change.EventID)
			if err != nil {
				return err
			}
			if err := requireRevision(e, change.EventRevision, published); err != nil {
				return err
			}
			next := change.After
			if next.Status != cancelled {
				c, err := loadCatalog(ctx, tx, false)
				if err != nil {
					return err
				}
				current, err := c.event(eventSnapshot(next, next.Status).Details)
				if err != nil {
					return err
				}
				current.ID = next.ID
				result.Issues, err = check(ctx, tx, attendance(current, groups), false)
				if err != nil || len(result.Issues) != 0 {
					return err
				}
			}
			if err := tx.UpdateEvent(ctx, &next); err != nil {
				return err
			}
			change.Status = approved
		}
		now := time.Now()
		change.ReviewerID, change.DecidedAt, change.Decision = actor.ID, &now, decision
		if err := tx.DecideChange(ctx, &change); err != nil {
			return err
		}
		result.Change = changeProto(change)
		return nil
	})
	return result, err
}

func (s *Service) History(ctx context.Context, eventID string, actor Actor) ([]*pb.Change, error) {
	if !validID(eventID) {
		return nil, invalid("некорректный идентификатор занятия")
	}
	var authorID *string
	if !actor.CanEdit {
		authorID = &actor.ID
	}
	history, err := s.store.Changes(ctx, eventID, authorID)
	if err != nil {
		return nil, err
	}
	var result []*pb.Change
	for _, change := range history {
		result = append(result, changeProto(change))
	}
	return result, nil
}
