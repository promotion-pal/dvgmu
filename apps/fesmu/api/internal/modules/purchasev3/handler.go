package purchasev3

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v3"
)

// handler adapts the service to Connect: the caller is the signed-in user,
// nothing in a message says who acts.
type handler struct {
	service *Service
}

func reply[T any](msg *T, err error) (*connect.Response[T], error) {
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(msg), nil
}

func (h *handler) PurchaseOverviewFetch(ctx context.Context, req *connect.Request[pb.PurchaseOverviewFetchRequest]) (*connect.Response[pb.PurchaseOverviewFetchResponse], error) {
	return reply(h.service.Overview(ctx, req.Msg.GetPlanYear()))
}

func (h *handler) PurchaseRequestCreate(ctx context.Context, req *connect.Request[pb.PurchaseRequestCreateRequest]) (*connect.Response[pb.PurchaseRequestCreateResponse], error) {
	m := req.Msg
	id, err := h.service.RequestCreate(ctx, requestInput{
		title: m.GetTitle(), itemType: m.GetItemType(), quantity: m.GetQuantity(), unit: m.GetUnit(),
		description: m.GetDescription(), department: int32(m.GetDepartment()),
	})
	return reply(&pb.PurchaseRequestCreateResponse{Id: id}, err)
}

func (h *handler) PurchaseRequestUpdate(ctx context.Context, req *connect.Request[pb.PurchaseRequestUpdateRequest]) (*connect.Response[pb.PurchaseRequestUpdateResponse], error) {
	m := req.Msg
	err := h.service.RequestUpdate(ctx, m.GetId(), requestInput{
		title: m.GetTitle(), itemType: m.GetItemType(), quantity: m.GetQuantity(), unit: m.GetUnit(), description: m.GetDescription(),
	})
	return reply(&pb.PurchaseRequestUpdateResponse{}, err)
}

func (h *handler) PurchaseRequestDelete(ctx context.Context, req *connect.Request[pb.PurchaseRequestDeleteRequest]) (*connect.Response[pb.PurchaseRequestDeleteResponse], error) {
	return reply(&pb.PurchaseRequestDeleteResponse{}, h.service.RequestDelete(ctx, req.Msg.GetId()))
}

func (h *handler) PurchaseRequestMove(ctx context.Context, req *connect.Request[pb.PurchaseRequestMoveRequest]) (*connect.Response[pb.PurchaseRequestMoveResponse], error) {
	m := req.Msg
	err := h.service.RequestMove(ctx, m.GetId(), m.GetMove(), m.GetComment(), int32(m.GetImplementingDepartment()), m.GetCuratorId())
	return reply(&pb.PurchaseRequestMoveResponse{}, err)
}

func (h *handler) PurchaseRequestMerge(ctx context.Context, req *connect.Request[pb.PurchaseRequestMergeRequest]) (*connect.Response[pb.PurchaseRequestMergeResponse], error) {
	m := req.Msg
	id, err := h.service.RequestMerge(ctx, m.GetRequestIds(), m.GetTitle(), m.GetDescription())
	return reply(&pb.PurchaseRequestMergeResponse{Id: id}, err)
}

func (h *handler) PurchaseLotCreate(ctx context.Context, req *connect.Request[pb.PurchaseLotCreateRequest]) (*connect.Response[pb.PurchaseLotCreateResponse], error) {
	m := req.Msg
	id, err := h.service.LotCreate(ctx, m.GetRequestIds(), m.GetTitle(), m.GetDescription(), m.GetCuratorId())
	return reply(&pb.PurchaseLotCreateResponse{Id: id}, err)
}

func (h *handler) PurchaseLotRequests(ctx context.Context, req *connect.Request[pb.PurchaseLotRequestsRequest]) (*connect.Response[pb.PurchaseLotRequestsResponse], error) {
	m := req.Msg
	return reply(&pb.PurchaseLotRequestsResponse{}, h.service.LotRequests(ctx, m.GetLotId(), m.GetAddIds(), m.GetRemoveIds()))
}

func (h *handler) PurchaseLotDisband(ctx context.Context, req *connect.Request[pb.PurchaseLotDisbandRequest]) (*connect.Response[pb.PurchaseLotDisbandResponse], error) {
	return reply(&pb.PurchaseLotDisbandResponse{}, h.service.LotDisband(ctx, req.Msg.GetId(), req.Msg.GetComment()))
}

func (h *handler) PurchaseLotUpdate(ctx context.Context, req *connect.Request[pb.PurchaseLotUpdateRequest]) (*connect.Response[pb.PurchaseLotUpdateResponse], error) {
	return reply(&pb.PurchaseLotUpdateResponse{}, h.service.LotUpdate(ctx, req.Msg))
}

func (h *handler) PurchaseLotMove(ctx context.Context, req *connect.Request[pb.PurchaseLotMoveRequest]) (*connect.Response[pb.PurchaseLotMoveResponse], error) {
	m := req.Msg
	return reply(&pb.PurchaseLotMoveResponse{}, h.service.LotMove(ctx, m.GetId(), m.GetMove(), m.GetComment(), m.GetAssigneeUuid()))
}

func (h *handler) PurchaseQuotationCreate(ctx context.Context, req *connect.Request[pb.PurchaseQuotationCreateRequest]) (*connect.Response[pb.PurchaseQuotationCreateResponse], error) {
	m := req.Msg
	id, err := h.service.QuotationCreate(ctx, m.GetLotId(), quotationInput{
		supplier: m.GetSupplier(), inn: m.GetSupplierInn(), unitPrice: m.GetUnitPrice(), note: m.GetNote(),
		fileName: m.GetFileName(), content: m.GetFileContent(),
	})
	return reply(&pb.PurchaseQuotationCreateResponse{Id: id}, err)
}

func (h *handler) PurchaseQuotationDelete(ctx context.Context, req *connect.Request[pb.PurchaseQuotationDeleteRequest]) (*connect.Response[pb.PurchaseQuotationDeleteResponse], error) {
	return reply(&pb.PurchaseQuotationDeleteResponse{}, h.service.QuotationDelete(ctx, req.Msg.GetId()))
}

func (h *handler) PurchaseQuotationFileFetch(ctx context.Context, req *connect.Request[pb.PurchaseQuotationFileFetchRequest]) (*connect.Response[pb.PurchaseQuotationFileFetchResponse], error) {
	q, err := h.service.QuotationFile(ctx, req.Msg.GetId())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseQuotationFileFetchResponse{FileName: q.FileName, Content: q.FileContent}), nil
}

func (h *handler) PurchaseDocumentCreate(ctx context.Context, req *connect.Request[pb.PurchaseDocumentCreateRequest]) (*connect.Response[pb.PurchaseDocumentCreateResponse], error) {
	m := req.Msg
	id, err := h.service.DocumentCreate(ctx, m.GetLotId(), m.GetKind(), m.GetNote(), m.GetFileName(), m.GetFileContent())
	return reply(&pb.PurchaseDocumentCreateResponse{Id: id}, err)
}

func (h *handler) PurchaseDocumentDelete(ctx context.Context, req *connect.Request[pb.PurchaseDocumentDeleteRequest]) (*connect.Response[pb.PurchaseDocumentDeleteResponse], error) {
	return reply(&pb.PurchaseDocumentDeleteResponse{}, h.service.DocumentDelete(ctx, req.Msg.GetId()))
}

func (h *handler) PurchaseDocumentFileFetch(ctx context.Context, req *connect.Request[pb.PurchaseDocumentFileFetchRequest]) (*connect.Response[pb.PurchaseDocumentFileFetchResponse], error) {
	d, err := h.service.DocumentFile(ctx, req.Msg.GetId())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseDocumentFileFetchResponse{FileName: d.FileName, Content: d.FileContent}), nil
}

func (h *handler) PurchaseProtocolCreate(ctx context.Context, req *connect.Request[pb.PurchaseProtocolCreateRequest]) (*connect.Response[pb.PurchaseProtocolCreateResponse], error) {
	m := req.Msg
	in := protocolInput{
		number: m.GetNumber(), chairman: m.GetChairman(), secretary: m.GetSecretary(), comment: m.GetComment(),
		fileName: m.GetFileName(), content: m.GetFileContent(),
	}
	if m.GetHeldAt() != nil {
		in.heldAt = m.GetHeldAt().AsTime()
	}
	id, err := h.service.ProtocolCreate(ctx, in, m.GetDecisions())
	return reply(&pb.PurchaseProtocolCreateResponse{Id: id}, err)
}

func (h *handler) PurchaseProtocolUpdate(ctx context.Context, req *connect.Request[pb.PurchaseProtocolUpdateRequest]) (*connect.Response[pb.PurchaseProtocolUpdateResponse], error) {
	m := req.Msg
	in := protocolInput{
		number: m.GetNumber(), chairman: m.GetChairman(), secretary: m.GetSecretary(), comment: m.GetComment(),
		fileName: m.GetFileName(), content: m.GetFileContent(),
	}
	if m.GetHeldAt() != nil {
		in.heldAt = m.GetHeldAt().AsTime()
	}
	return reply(&pb.PurchaseProtocolUpdateResponse{}, h.service.ProtocolUpdate(ctx, m.GetId(), in))
}

func (h *handler) PurchaseProtocolFileFetch(ctx context.Context, req *connect.Request[pb.PurchaseProtocolFileFetchRequest]) (*connect.Response[pb.PurchaseProtocolFileFetchResponse], error) {
	p, err := h.service.ProtocolFile(ctx, req.Msg.GetId())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseProtocolFileFetchResponse{FileName: p.FileName, Content: p.FileContent}), nil
}

func (h *handler) PurchaseCodeSuggestFetch(ctx context.Context, req *connect.Request[pb.PurchaseCodeSuggestFetchRequest]) (*connect.Response[pb.PurchaseCodeSuggestFetchResponse], error) {
	s, err := h.service.CodeSuggest(ctx, req.Msg.GetTitle())
	return reply(&pb.PurchaseCodeSuggestFetchResponse{Suggestion: s}, err)
}

func (h *handler) PurchaseEmployeeFetch(ctx context.Context, req *connect.Request[pb.PurchaseEmployeeFetchRequest]) (*connect.Response[pb.PurchaseEmployeeFetchResponse], error) {
	list, err := h.service.EmployeeFetch(ctx, int32(req.Msg.GetDepartment()))
	return reply(&pb.PurchaseEmployeeFetchResponse{List: list}, err)
}

func (h *handler) PurchaseActivityFetch(ctx context.Context, req *connect.Request[pb.PurchaseActivityFetchRequest]) (*connect.Response[pb.PurchaseActivityFetchResponse], error) {
	list, err := h.service.ActivityFetch(ctx, req.Msg.GetDays())
	return reply(&pb.PurchaseActivityFetchResponse{List: list}, err)
}

func (h *handler) PurchaseCuratorSave(ctx context.Context, req *connect.Request[pb.PurchaseCuratorSaveRequest]) (*connect.Response[pb.PurchaseCuratorSaveResponse], error) {
	m := req.Msg
	id, err := h.service.CuratorSave(ctx, curatorInput{
		id: m.GetId(), title: m.GetTitle(), shortTitle: m.GetShortTitle(), personName: m.GetPersonName(),
		userUUID: m.GetUserUuid(), userName: m.GetUserName(), sortOrder: m.GetSortOrder(),
	})
	return reply(&pb.PurchaseCuratorSaveResponse{Id: id}, err)
}

func (h *handler) PurchaseCuratorDelete(ctx context.Context, req *connect.Request[pb.PurchaseCuratorDeleteRequest]) (*connect.Response[pb.PurchaseCuratorDeleteResponse], error) {
	return reply(&pb.PurchaseCuratorDeleteResponse{}, h.service.CuratorDelete(ctx, req.Msg.GetId()))
}

func (h *handler) PurchaseDepartmentSave(ctx context.Context, req *connect.Request[pb.PurchaseDepartmentSaveRequest]) (*connect.Response[pb.PurchaseDepartmentSaveResponse], error) {
	m := req.Msg
	return reply(&pb.PurchaseDepartmentSaveResponse{}, h.service.DepartmentSave(ctx, int32(m.GetDepartment()), m.GetCuratorId()))
}

func (h *handler) PurchaseCategorySave(ctx context.Context, req *connect.Request[pb.PurchaseCategorySaveRequest]) (*connect.Response[pb.PurchaseCategorySaveResponse], error) {
	m := req.Msg
	id, err := h.service.CategorySave(ctx, categoryInput{
		id: m.GetId(), name: m.GetName(), okpd2: m.GetOkpd2Prefix(), implementing: int32(m.GetImplementingDepartment()),
	})
	return reply(&pb.PurchaseCategorySaveResponse{Id: id}, err)
}

func (h *handler) PurchaseCategoryDelete(ctx context.Context, req *connect.Request[pb.PurchaseCategoryDeleteRequest]) (*connect.Response[pb.PurchaseCategoryDeleteResponse], error) {
	return reply(&pb.PurchaseCategoryDeleteResponse{}, h.service.CategoryDelete(ctx, req.Msg.GetId()))
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
	case errors.Is(err, ErrState):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, ErrUnavailable):
		return connect.NewError(connect.CodeUnavailable, err)
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return connect.NewError(connect.CodeDeadlineExceeded, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
