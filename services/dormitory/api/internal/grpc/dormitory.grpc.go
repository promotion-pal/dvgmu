package grpc

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"fesmu/contract/dormitory/entity"
	pb "fesmu/contract/dormitory/service"
	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/service"
	"dvgmu/analytics/internal/storage"
	"dvgmu/analytics/internal/utils"
)

type DormitoryHandler struct {
	service       *service.DormitoryRegistrationService
	users         *service.UserService
	adminPassword string
}

func DormitoryNewController(
	service *service.DormitoryRegistrationService,
	users *service.UserService,
	adminPassword string,
) *DormitoryHandler {
	return &DormitoryHandler{service: service, users: users, adminPassword: adminPassword}
}

func (h *DormitoryHandler) requireAdmin(header http.Header) error {
	if h.adminPassword == "" {
		return connect.NewError(connect.CodePermissionDenied, errors.New("админ-доступ не настроен"))
	}
	token := strings.TrimPrefix(header.Get("Authorization"), "Bearer ")
	if token != h.adminPassword {
		return connect.NewError(connect.CodePermissionDenied, errors.New("нужен пароль администратора"))
	}
	return nil
}

func dutyDateUTC(ts *timestamppb.Timestamp) time.Time {
	t := ts.AsTime().UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// DormitoryRegistrationAdminUpsert — только для админа: перенос даты записи
// (id > 0) либо создание записи без студенческих ограничений (id == 0).
func (h *DormitoryHandler) DormitoryRegistrationAdminUpsert(
	ctx context.Context,
	req *connect.Request[pb.DormitoryRegistrationAdminUpsertRequest],
) (*connect.Response[pb.DormitoryRegistrationCreateResponse], error) {
	if err := h.requireAdmin(req.Header()); err != nil {
		return nil, err
	}
	if req.Msg.GetData() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("data is required"))
	}

	data := req.Msg.GetData().AsTime().UTC()
	dutyDate := dutyDateUTC(req.Msg.GetData())

	mapConflict := func(err error) error {
		if errors.Is(err, storage.ErrDutySlotTaken) {
			return connect.NewError(connect.CodeAlreadyExists, storage.ErrDutySlotTaken)
		}
		return connect.NewError(connect.CodeInternal, err)
	}

	if req.Msg.GetId() > 0 {
		existing, err := h.service.ByID(ctx, req.Msg.GetId())
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		if existing == nil {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("запись не найдена"))
		}
		floor := utils.FloorFromRoom(existing.Room)
		if err := h.service.UpdateDate(ctx, existing.ID, data, dutyDate, int32(floor)); err != nil {
			return nil, mapConflict(err)
		}
		return connect.NewResponse(&pb.DormitoryRegistrationCreateResponse{
			Id: existing.ID, Success: true, Message: "дата записи изменена",
		}), nil
	}

	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("userId is required"))
	}
	floor := utils.FloorFromRoom(req.Msg.GetRoom())
	if floor < 1 || floor > 50 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("не удалось определить этаж по номеру комнаты"))
	}

	registration := &models.DormitoryRegistration{
		UserID:   req.Msg.GetUserId(),
		Room:     req.Msg.GetRoom(),
		Data:     data,
		Floor:    int32(floor),
		DutyDate: dutyDate,
		ByAdmin:  true,
	}
	id, err := h.service.Create(ctx, registration)
	if err != nil {
		return nil, mapConflict(err)
	}
	return connect.NewResponse(&pb.DormitoryRegistrationCreateResponse{
		Id: id, Success: true, Message: "запись добавлена",
	}), nil
}

func (h *DormitoryHandler) DormitoryRegistrationCreate(
	ctx context.Context,
	req *connect.Request[pb.DormitoryRegistrationCreateRequest],
) (*connect.Response[pb.DormitoryRegistrationCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("userId is required"))
	}
	if req.Msg.GetData() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("data is required"))
	}

	floor := utils.FloorFromRoom(req.Msg.GetRoom())
	if floor < 1 || floor > 50 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("не удалось определить этаж по номеру комнаты"))
	}

	data := req.Msg.GetData().AsTime().UTC()
	dutyDate := time.Date(data.Year(), data.Month(), data.Day(), 0, 0, 0, 0, time.UTC)

	user, err := h.users.ByID(ctx, req.Msg.GetUserId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if user == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("студент не найден"))
	}

	now := time.Now()
	course, _ := user.ParseCourse()
	if reason := utils.BookingBlockReason(course); reason != "" {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New(reason))
	}

	nextMonth := utils.NextMonth(now)
	if dutyDate.Year() != nextMonth.Year() || dutyDate.Month() != nextMonth.Month() {
		return nil, connect.NewError(
			connect.CodeFailedPrecondition,
			errors.New("дежурство назначается на "+utils.MonthLabel(nextMonth)),
		)
	}

	registration := &models.DormitoryRegistration{
		UserID:     req.Msg.GetUserId(),
		Room:       req.Msg.GetRoom(),
		RecordBook: req.Msg.GetRecordBook(),
		Data:       data,
		Floor:      int32(floor),
		DutyDate:   dutyDate,
	}

	id, err := h.service.Create(ctx, registration)
	if err != nil {
		switch {
		case errors.Is(err, storage.ErrDutySlotTaken):
			return nil, connect.NewError(connect.CodeAlreadyExists, storage.ErrDutySlotTaken)
		case errors.Is(err, storage.ErrUserMonthTaken):
			return nil, connect.NewError(connect.CodeAlreadyExists, storage.ErrUserMonthTaken)
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&pb.DormitoryRegistrationCreateResponse{
		Success: true,
		Message: "dormitory registration created",
		Id:      id,
	}), nil
}

func (h *DormitoryHandler) DormitoryRegistrationByID(
	ctx context.Context,
	req *connect.Request[pb.DormitoryRegistrationByIDRequest],
) (*connect.Response[pb.DormitoryRegistrationByIDResponse], error) {
	registration, err := h.service.ByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if registration == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("dormitory registration not found"))
	}

	return connect.NewResponse(&pb.DormitoryRegistrationByIDResponse{
		Entity: toProtoDormitoryRegistration(registration),
	}), nil
}

func (h *DormitoryHandler) DormitoryRegistrationFetch(
	ctx context.Context,
	req *connect.Request[pb.DormitoryRegistrationFetchRequest],
	stream *connect.ServerStream[pb.DormitoryRegistrationByIDResponse],
) error {
	var userID *int64
	if req.Msg.UserId != nil {
		userID = req.Msg.UserId
	}

	var room *int32
	if req.Msg.Room != nil {
		room = req.Msg.Room
	}

	var recordBook *string
	if req.Msg.RecordBook != nil {
		recordBook = req.Msg.RecordBook
	}

	var startDate, endDate *time.Time
	if req.Msg.StartDate != nil {
		t := req.Msg.GetStartDate().AsTime()
		startDate = &t
	}
	if req.Msg.EndDate != nil {
		t := req.Msg.GetEndDate().AsTime()
		endDate = &t
	}

	registrations, err := h.service.Fetch(ctx, userID, room, recordBook, startDate, endDate)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range registrations {
		if err := stream.Send(&pb.DormitoryRegistrationByIDResponse{
			Entity: toProtoDormitoryRegistration(&registrations[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func toProtoDormitoryRegistration(registration *models.DormitoryRegistration) *entity.DormitoryRegistration {
	return &entity.DormitoryRegistration{
		Id:         registration.ID,
		UserId:     registration.UserID,
		Room:       registration.Room,
		RecordBook: registration.RecordBook,
		Data:       timestamppb.New(registration.Data),
		CreatedAt:  timestamppb.New(registration.CreatedAt),
		UpdatedAt:  timestamppb.New(registration.UpdatedAt),
	}
}
