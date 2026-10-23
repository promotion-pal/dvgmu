package library

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "fesmu/contract/fesmu/service/v2"
)

type handler struct {
	service *Service
}

func timestamp(t time.Time) *timestamppb.Timestamp { return timestamppb.New(t) }

func reply[T any](msg *T, err error) (*connect.Response[T], error) {
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(msg), nil
}

func (h *handler) LibraryItemFetch(ctx context.Context, req *connect.Request[pb.LibraryItemFetchRequest]) (*connect.Response[pb.LibraryItemFetchResponse], error) {
	items, err := h.service.Items(ctx, req.Msg.GetQuery(), req.Msg.GetDiscipline())
	return reply(&pb.LibraryItemFetchResponse{Items: items}, err)
}

func (h *handler) LibraryItemByID(ctx context.Context, req *connect.Request[pb.LibraryItemByIDRequest]) (*connect.Response[pb.LibraryItemByIDResponse], error) {
	item, err := h.service.Item(ctx, req.Msg.GetId())
	return reply(&pb.LibraryItemByIDResponse{Item: item}, err)
}

func (h *handler) LibraryItemCreate(ctx context.Context, req *connect.Request[pb.LibraryItemCreateRequest]) (*connect.Response[pb.LibraryItemCreateResponse], error) {
	id, err := h.service.ItemCreate(ctx, req.Msg.GetItem(), req.Msg.GetFileName(), req.Msg.GetFileContent())
	return reply(&pb.LibraryItemCreateResponse{Id: id}, err)
}

func (h *handler) LibraryItemUpdate(ctx context.Context, req *connect.Request[pb.LibraryItemUpdateRequest]) (*connect.Response[pb.LibraryItemUpdateResponse], error) {
	err := h.service.ItemUpdate(ctx, req.Msg.GetId(), req.Msg.GetItem(), req.Msg.GetFileName(), req.Msg.GetFileContent())
	return reply(&pb.LibraryItemUpdateResponse{}, err)
}

func (h *handler) LibraryItemDelete(ctx context.Context, req *connect.Request[pb.LibraryItemDeleteRequest]) (*connect.Response[pb.LibraryItemDeleteResponse], error) {
	return reply(&pb.LibraryItemDeleteResponse{}, h.service.ItemDelete(ctx, req.Msg.GetId()))
}

func (h *handler) LibraryDisciplineFetch(ctx context.Context, _ *connect.Request[pb.LibraryDisciplineFetchRequest]) (*connect.Response[pb.LibraryDisciplineFetchResponse], error) {
	list, err := h.service.Disciplines(ctx)
	return reply(&pb.LibraryDisciplineFetchResponse{Disciplines: list}, err)
}

func (h *handler) LibraryFileUpload(ctx context.Context, req *connect.Request[pb.LibraryFileUploadRequest]) (*connect.Response[pb.LibraryFileUploadResponse], error) {
	f, err := h.service.FileUpload(ctx, req.Msg.GetFileName(), req.Msg.GetContent())
	return reply(&pb.LibraryFileUploadResponse{File: f}, err)
}

func (h *handler) LibraryFileFetch(ctx context.Context, req *connect.Request[pb.LibraryFileFetchRequest]) (*connect.Response[pb.LibraryFileFetchResponse], error) {
	f, content, err := h.service.FileFetch(ctx, req.Msg.GetId())
	return reply(&pb.LibraryFileFetchResponse{File: f, Content: content}, err)
}

func (h *handler) ManualFetch(ctx context.Context, req *connect.Request[pb.ManualFetchRequest]) (*connect.Response[pb.ManualFetchResponse], error) {
	list, err := h.service.Manuals(ctx, req.Msg.GetDiscipline(), req.Msg.GetQuery())
	return reply(&pb.ManualFetchResponse{Manuals: list}, err)
}

func (h *handler) ManualByID(ctx context.Context, req *connect.Request[pb.ManualByIDRequest]) (*connect.Response[pb.ManualByIDResponse], error) {
	m, literature, err := h.service.Manual(ctx, req.Msg.GetId(), req.Msg.GetDraft())
	return reply(&pb.ManualByIDResponse{Manual: m, Literature: literature}, err)
}

func (h *handler) ManualCreate(ctx context.Context, req *connect.Request[pb.ManualCreateRequest]) (*connect.Response[pb.ManualCreateResponse], error) {
	id, err := h.service.ManualCreate(ctx, req.Msg.GetManual())
	return reply(&pb.ManualCreateResponse{Id: id}, err)
}

func (h *handler) ManualUpdate(ctx context.Context, req *connect.Request[pb.ManualUpdateRequest]) (*connect.Response[pb.ManualUpdateResponse], error) {
	err := h.service.ManualUpdate(ctx, req.Msg.GetId(), req.Msg.GetManual(), req.Msg.GetSections())
	return reply(&pb.ManualUpdateResponse{}, err)
}

func (h *handler) ManualPublish(ctx context.Context, req *connect.Request[pb.ManualPublishRequest]) (*connect.Response[pb.ManualPublishResponse], error) {
	return reply(&pb.ManualPublishResponse{}, h.service.ManualPublish(ctx, req.Msg.GetId()))
}

func (h *handler) ManualArchive(ctx context.Context, req *connect.Request[pb.ManualArchiveRequest]) (*connect.Response[pb.ManualArchiveResponse], error) {
	return reply(&pb.ManualArchiveResponse{}, h.service.ManualArchive(ctx, req.Msg.GetId()))
}

func (h *handler) ManualDelete(ctx context.Context, req *connect.Request[pb.ManualDeleteRequest]) (*connect.Response[pb.ManualDeleteResponse], error) {
	return reply(&pb.ManualDeleteResponse{}, h.service.ManualDelete(ctx, req.Msg.GetId()))
}

func (h *handler) ReaderProgressFetch(ctx context.Context, req *connect.Request[pb.ReaderProgressFetchRequest]) (*connect.Response[pb.ReaderProgressFetchResponse], error) {
	list, err := h.service.Progress(ctx, req.Msg.GetKind(), req.Msg.GetRefId())
	return reply(&pb.ReaderProgressFetchResponse{Progress: list}, err)
}

func (h *handler) ReaderProgressSave(ctx context.Context, req *connect.Request[pb.ReaderProgressSaveRequest]) (*connect.Response[pb.ReaderProgressSaveResponse], error) {
	err := h.service.ProgressSave(ctx, req.Msg.GetKind(), req.Msg.GetRefId(), req.Msg.GetPosition(), req.Msg.GetPercent())
	return reply(&pb.ReaderProgressSaveResponse{}, err)
}

func toConnectError(err error) error {
	if ce := new(connect.Error); errors.As(err, &ce) {
		return ce
	}
	switch {
	case errors.Is(err, ErrInvalid):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, ErrForbidden):
		return connect.NewError(connect.CodePermissionDenied, err)
	case errors.Is(err, ErrUnavailable), errors.Is(err, ErrFiles):
		return connect.NewError(connect.CodeUnavailable, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return connect.NewError(connect.CodeDeadlineExceeded, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
