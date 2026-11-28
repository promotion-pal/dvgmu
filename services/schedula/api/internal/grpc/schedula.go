package grpc

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	"dvgmu/schedula/internal/service"
	mdmenum "fesmu/contract/mdm/enum"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
	rpc "fesmu/contract/schedula/service"
)

type Handler struct {
	service   *service.Service
	users     mdmconnect.UserServiceClient
	directory mdmconnect.UserDirectoryServiceClient
	log       *slog.Logger
}

func New(s *service.Service, users mdmconnect.UserServiceClient, directory mdmconnect.UserDirectoryServiceClient, log *slog.Logger) *Handler {
	return &Handler{service: s, users: users, directory: directory, log: log}
}

func (h *Handler) ScheduleFetch(ctx context.Context, req *connect.Request[rpc.ScheduleFetchRequest]) (*connect.Response[rpc.ScheduleFetchResponse], error) {
	result, err := h.service.Schedule(ctx, req.Msg, actorFromContext(ctx))
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	events := slices.Concat(result.Events, result.Transfers)
	instructorIDs := make(map[string]struct{})
	for _, event := range events {
		if id := event.GetDetails().GetInstructorId(); id != "" {
			instructorIDs[id] = struct{}{}
		}
	}
	if len(instructorIDs) != 0 {
		instructors, err := h.instructors(ctx, slices.Sorted(maps.Keys(instructorIDs)))
		if err != nil {
			return nil, err
		}
		names := make(map[string]string, len(instructors))
		for _, instructor := range instructors {
			names[instructor.Id] = instructor.Name
		}
		for _, event := range events {
			event.InstructorName = names[event.GetDetails().GetInstructorId()]
		}
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) PublicScheduleFetch(ctx context.Context, req *connect.Request[rpc.PublicScheduleFetchRequest]) (*connect.Response[rpc.PublicScheduleFetchResponse], error) {
	result, err := h.service.PublicSchedule(ctx, req.Msg.Filter)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) CatalogFetch(ctx context.Context, _ *connect.Request[rpc.CatalogFetchRequest]) (*connect.Response[rpc.CatalogFetchResponse], error) {
	catalog, err := h.service.Catalog(ctx, actorFromContext(ctx).CanEditCatalog)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	instructors, err := h.instructors(ctx, nil)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&rpc.CatalogFetchResponse{Catalog: catalog, Instructors: instructors}), nil
}

func (h *Handler) CatalogSave(ctx context.Context, req *connect.Request[rpc.CatalogSaveRequest]) (*connect.Response[rpc.CatalogSaveResponse], error) {
	if err := require(actorFromContext(ctx).CanEditCatalog); err != nil {
		return nil, err
	}
	if err := h.service.SaveCatalog(ctx, req.Msg.Catalog); err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(&rpc.CatalogSaveResponse{}), nil
}

func (h *Handler) EventSave(ctx context.Context, req *connect.Request[rpc.EventSaveRequest]) (*connect.Response[rpc.EventSaveResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanEdit); err != nil {
		return nil, err
	}
	if err := h.checkInstructor(ctx, req.Msg.GetDetails().GetInstructorId()); err != nil {
		return nil, err
	}
	events, err := h.service.Save(ctx, req.Msg, actor)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(&rpc.EventSaveResponse{Events: events}), nil
}

func (h *Handler) CompletenessFetch(ctx context.Context, req *connect.Request[rpc.CompletenessFetchRequest]) (*connect.Response[rpc.CompletenessFetchResponse], error) {
	if err := require(actorFromContext(ctx).CanViewReports); err != nil {
		return nil, err
	}
	gaps, err := h.service.Completeness(ctx, req.Msg.TermId)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(&rpc.CompletenessFetchResponse{Gaps: gaps}), nil
}

func (h *Handler) EventCheckFetch(ctx context.Context, req *connect.Request[rpc.EventCheckFetchRequest]) (*connect.Response[rpc.EventCheckFetchResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanEdit || actor.CanPublish); err != nil {
		return nil, err
	}
	issues, err := h.service.Check(ctx, req.Msg.Id)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(&rpc.EventCheckFetchResponse{Issues: issues}), nil
}

func (h *Handler) EventPublish(ctx context.Context, req *connect.Request[rpc.EventPublishRequest]) (*connect.Response[rpc.EventPublishResponse], error) {
	if err := require(actorFromContext(ctx).CanPublish); err != nil {
		return nil, err
	}
	result, err := h.service.Publish(ctx, req.Msg)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) SlotsFetch(ctx context.Context, req *connect.Request[rpc.SlotsFetchRequest]) (*connect.Response[rpc.SlotsFetchResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanFindSlots); err != nil {
		return nil, err
	}
	if !actor.CanEdit {
		switch req.Msg.GetDetails().GetType() {
		case scheduleenum.EventType_EVENT_TYPE_EXAM, scheduleenum.EventType_EVENT_TYPE_CONSULTATION,
			scheduleenum.EventType_EVENT_TYPE_RETAKE, scheduleenum.EventType_EVENT_TYPE_GIA:
		default:
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("выберите тип события учебной аттестации"))
		}
	}
	result, err := h.service.Slots(ctx, req.Msg, actor.CanEdit)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) ChangeCreate(ctx context.Context, req *connect.Request[rpc.ChangeCreateRequest]) (*connect.Response[rpc.ChangeCreateResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanReviewChanges || actor.Teacher); err != nil {
		return nil, err
	}
	if req.Msg.Type == scheduleenum.ChangeType_CHANGE_TYPE_INSTRUCTOR {
		if err := h.checkInstructor(ctx, req.Msg.InstructorId); err != nil {
			return nil, err
		}
	}
	result, err := h.service.CreateChange(ctx, req.Msg, actor)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) ChangeDecide(ctx context.Context, req *connect.Request[rpc.ChangeDecideRequest]) (*connect.Response[rpc.ChangeDecideResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanReviewChanges); err != nil {
		return nil, err
	}
	result, err := h.service.DecideChange(ctx, req.Msg, actor)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) ChangeHistoryFetch(ctx context.Context, req *connect.Request[rpc.ChangeHistoryFetchRequest]) (*connect.Response[rpc.ChangeHistoryFetchResponse], error) {
	actor := actorFromContext(ctx)
	if err := require(actor.CanReviewChanges || actor.Teacher); err != nil {
		return nil, err
	}
	changes, err := h.service.History(ctx, req.Msg.EventId, actor)
	if err != nil {
		return nil, h.rpcError(ctx, err)
	}
	return connect.NewResponse(&rpc.ChangeHistoryFetchResponse{Changes: changes}), nil
}

func (h *Handler) rpcError(ctx context.Context, err error) error {
	var connectErr *connect.Error
	if errors.As(err, &connectErr) {
		return connectErr
	}
	if errors.Is(err, context.Canceled) {
		return connect.NewError(connect.CodeCanceled, err)
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return connect.NewError(connect.CodeDeadlineExceeded, err)
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) || errors.Is(err, gorm.ErrForeignKeyViolated) || errors.Is(err, gorm.ErrCheckConstraintViolated) {
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("запись нарушает ограничения справочника"))
	}
	h.log.ErrorContext(ctx, "schedule storage request failed", "error_type", fmt.Sprintf("%T", err))
	return connect.NewError(connect.CodeInternal, errors.New("не удалось выполнить операцию с расписанием"))
}

func (h *Handler) instructors(ctx context.Context, ids []string) ([]*pb.Instructor, error) {
	const pageSize = 200
	batches := slices.Collect(slices.Chunk(ids, pageSize))
	if len(batches) == 0 {
		batches = [][]string{nil}
	}
	seen := make(map[string]bool)
	var instructors []*pb.Instructor
	for _, batch := range batches {
		for offset := int32(0); ; {
			resp, err := h.directory.UserDirectoryFetch(ctx, connect.NewRequest(&mdm.UserDirectoryFetchRequest{
				Role: mdmenum.UserRole_USER_ROLE_TEACHER, UserStatus: mdmenum.UserStatus_USER_STATUS_ACTIVE,
				ProfileKind: "employee", UserUuids: batch, Limit: pageSize, Offset: offset,
			}))
			if err != nil {
				return nil, directoryUnavailable()
			}
			for _, user := range resp.Msg.GetUsers() {
				id := user.GetUuid()
				if id != "" && !seen[id] {
					seen[id] = true
					instructors = append(instructors, &pb.Instructor{Id: id, Name: user.GetFullName()})
				}
			}
			if resp.Msg.GetNextOffset() <= offset {
				break
			}
			offset = resp.Msg.GetNextOffset()
		}
	}
	slices.SortFunc(instructors, func(a, b *pb.Instructor) int {
		return cmp.Or(strings.Compare(a.Name, b.Name), strings.Compare(a.Id, b.Id))
	})
	return instructors, nil
}

func (h *Handler) checkInstructor(ctx context.Context, id string) error {
	if id == "" {
		return nil
	}
	resp, err := h.users.UserFetchByUUID(ctx, connect.NewRequest(&mdm.UserFetchByUUIDRequest{Uuid: id}))
	if err != nil && connect.CodeOf(err) != connect.CodeNotFound {
		return directoryUnavailable()
	}
	if err != nil || resp.Msg.GetUser().GetStatus() != mdmenum.UserStatus_USER_STATUS_ACTIVE ||
		!slices.Contains(resp.Msg.GetUser().GetRoles(), mdmenum.UserRole_USER_ROLE_TEACHER) {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("выберите действующего преподавателя из справочника"))
	}
	return nil
}
