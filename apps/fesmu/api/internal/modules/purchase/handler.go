package purchase

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entity "dvgmu/api/contract/gen/go/entity/v2"
	pb "dvgmu/api/contract/gen/go/service/v2"
)

type handler struct {
	service *Service
}

// actor resolves who acts and checks they may act in that role.
func (h *handler) actor(ctx context.Context, p *entity.PurchaseActor) (actor, error) {
	return h.service.actorOf(ctx, p.GetRole(), p.GetName(), p.GetCuratorId())
}

func (h *handler) PurchaseOverview(
	ctx context.Context,
	req *connect.Request[pb.PurchaseOverviewRequest],
) (*connect.Response[pb.PurchaseOverviewResponse], error) {
	resp, err := h.service.Overview(ctx)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(resp), nil
}

func (h *handler) PurchaseRequestCreate(
	ctx context.Context,
	req *connect.Request[pb.PurchaseRequestCreateRequest],
) (*connect.Response[pb.PurchaseRequestCreateResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	id, err := h.service.RequestCreate(ctx, a, requestInput{
		title:        req.Msg.GetTitle(),
		quantity:     req.Msg.GetQuantity(),
		unit:         req.Msg.GetUnit(),
		description:  req.Msg.GetDescription(),
		itemType:     req.Msg.GetItemType(),
		departmentID: req.Msg.GetDepartmentId(),
	})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseRequestCreateResponse{Id: id}), nil
}

func (h *handler) PurchaseRequestUpdate(
	ctx context.Context,
	req *connect.Request[pb.PurchaseRequestUpdateRequest],
) (*connect.Response[pb.PurchaseRequestUpdateResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	err = h.service.RequestUpdate(ctx, a, req.Msg.GetId(), requestInput{
		title:       req.Msg.GetTitle(),
		quantity:    req.Msg.GetQuantity(),
		unit:        req.Msg.GetUnit(),
		description: req.Msg.GetDescription(),
		itemType:    req.Msg.GetItemType(),
	})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseRequestUpdateResponse{}), nil
}

func (h *handler) PurchaseRequestAction(
	ctx context.Context,
	req *connect.Request[pb.PurchaseRequestActionRequest],
) (*connect.Response[pb.PurchaseRequestActionResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	if err := h.service.RequestAction(ctx, a, req.Msg.GetId(), req.Msg.GetAction(), req.Msg.GetComment(), req.Msg.GetImplementingDepartment()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseRequestActionResponse{}), nil
}

func (h *handler) PurchaseRequestDelete(
	ctx context.Context,
	req *connect.Request[pb.PurchaseRequestDeleteRequest],
) (*connect.Response[pb.PurchaseRequestDeleteResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	if err := h.service.RequestDelete(ctx, a, req.Msg.GetId()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseRequestDeleteResponse{}), nil
}

func (h *handler) PurchaseRequestMerge(
	ctx context.Context,
	req *connect.Request[pb.PurchaseRequestMergeRequest],
) (*connect.Response[pb.PurchaseRequestMergeResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	id, err := h.service.RequestMerge(ctx, a, req.Msg.GetRequestIds(), req.Msg.GetTitle())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseRequestMergeResponse{Id: id}), nil
}

func (h *handler) PurchaseLotCreate(
	ctx context.Context,
	req *connect.Request[pb.PurchaseLotCreateRequest],
) (*connect.Response[pb.PurchaseLotCreateResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	id, err := h.service.LotCreate(ctx, a, req.Msg.GetRequestIds(), req.Msg.GetTitle())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseLotCreateResponse{Id: id}), nil
}

func (h *handler) PurchaseLotUpdate(
	ctx context.Context,
	req *connect.Request[pb.PurchaseLotUpdateRequest],
) (*connect.Response[pb.PurchaseLotUpdateResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	m := req.Msg
	err = h.service.LotUpdate(ctx, a, m.GetId(), lotInput{
		title:             m.GetTitle(),
		description:       m.GetDescription(),
		quantity:          m.GetQuantity(),
		unit:              m.GetUnit(),
		comment:           m.GetComment(),
		okpd2:             m.GetOkpd2(),
		ktru:              m.GetKtru(),
		okved:             m.GetOkved(),
		fundingSource:     m.GetFundingSource(),
		kosgu:             m.GetKosgu(),
		economistComment:  m.GetEconomistComment(),
		nmck:              m.GetNmck(),
		planType:          m.GetPlanType(),
		planYear:          int(m.GetPlanYear()),
		commissionComment: m.GetCommissionComment(),
	})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseLotUpdateResponse{}), nil
}

func (h *handler) PurchaseLotRequests(
	ctx context.Context,
	req *connect.Request[pb.PurchaseLotRequestsRequest],
) (*connect.Response[pb.PurchaseLotRequestsResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	if err := h.service.LotRequests(ctx, a, req.Msg.GetLotId(), req.Msg.GetAddIds(), req.Msg.GetRemoveIds()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseLotRequestsResponse{}), nil
}

func (h *handler) PurchaseLotAction(
	ctx context.Context,
	req *connect.Request[pb.PurchaseLotActionRequest],
) (*connect.Response[pb.PurchaseLotActionResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	m := req.Msg
	if err := h.service.LotAction(ctx, a, m.GetId(), m.GetAction(), lotActionInput{
		comment:      m.GetComment(),
		planType:     m.GetPlanType(),
		planYear:     int(m.GetPlanYear()),
		assigneeUUID: m.GetAssigneeUuid(),
		assigneeName: m.GetAssigneeName(),
	}); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseLotActionResponse{}), nil
}

func (h *handler) PurchaseQuotationCreate(
	ctx context.Context,
	req *connect.Request[pb.PurchaseQuotationCreateRequest],
) (*connect.Response[pb.PurchaseQuotationCreateResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	m := req.Msg
	id, err := h.service.QuotationCreate(ctx, a, m.GetLotId(), quotationInput{
		supplier:  m.GetSupplier(),
		unitPrice: m.GetUnitPrice(),
		note:      m.GetNote(),
		fileName:  m.GetFileName(),
		content:   m.GetFileContent(),
	})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseQuotationCreateResponse{Id: id}), nil
}

func (h *handler) PurchaseQuotationDelete(
	ctx context.Context,
	req *connect.Request[pb.PurchaseQuotationDeleteRequest],
) (*connect.Response[pb.PurchaseQuotationDeleteResponse], error) {
	a, err := h.actor(ctx, req.Msg.GetActor())
	if err != nil {
		return nil, toConnectError(err)
	}
	if err := h.service.QuotationDelete(ctx, a, req.Msg.GetId()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseQuotationDeleteResponse{}), nil
}

func (h *handler) PurchaseQuotationFile(
	ctx context.Context,
	req *connect.Request[pb.PurchaseQuotationFileRequest],
) (*connect.Response[pb.PurchaseQuotationFileResponse], error) {
	q, err := h.service.QuotationFile(ctx, req.Msg.GetId())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseQuotationFileResponse{FileName: q.FileName, Content: q.FileContent}), nil
}

func (h *handler) PurchaseCodeSuggest(
	ctx context.Context,
	req *connect.Request[pb.PurchaseCodeSuggestRequest],
) (*connect.Response[pb.PurchaseCodeSuggestResponse], error) {
	return connect.NewResponse(&pb.PurchaseCodeSuggestResponse{
		Suggestion: h.service.CodeSuggest(req.Msg.GetTitle()),
	}), nil
}

func (h *handler) PurchaseEmployeeFetch(
	ctx context.Context,
	req *connect.Request[pb.PurchaseEmployeeFetchRequest],
) (*connect.Response[pb.PurchaseEmployeeFetchResponse], error) {
	list, err := h.service.EmployeeFetch(ctx, req.Msg.GetDepartment())
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseEmployeeFetchResponse{List: list}), nil
}

func (h *handler) PurchaseCuratorSave(
	ctx context.Context,
	req *connect.Request[pb.PurchaseCuratorSaveRequest],
) (*connect.Response[pb.PurchaseCuratorSaveResponse], error) {
	m := req.Msg
	id, err := h.service.CuratorSave(ctx, curatorInput{
		id: m.GetId(), name: m.GetName(), position: m.GetPosition(), userUUID: m.GetUserUuid(), userName: m.GetUserName(),
	})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseCuratorSaveResponse{Id: id}), nil
}

func (h *handler) PurchaseDepartmentSave(
	ctx context.Context,
	req *connect.Request[pb.PurchaseDepartmentSaveRequest],
) (*connect.Response[pb.PurchaseDepartmentSaveResponse], error) {
	if err := h.service.DepartmentSave(ctx, req.Msg.GetDepartment(), req.Msg.GetCuratorId()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseDepartmentSaveResponse{}), nil
}

func (h *handler) PurchaseCategorySave(
	ctx context.Context,
	req *connect.Request[pb.PurchaseCategorySaveRequest],
) (*connect.Response[pb.PurchaseCategorySaveResponse], error) {
	m := req.Msg
	id, err := h.service.CategorySave(ctx, categoryInput{id: m.GetId(), name: m.GetName(), okpd2: m.GetOkpd2Prefix(), department: m.GetDepartment()})
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseCategorySaveResponse{Id: id}), nil
}

func (h *handler) PurchaseCategoryDelete(
	ctx context.Context,
	req *connect.Request[pb.PurchaseCategoryDeleteRequest],
) (*connect.Response[pb.PurchaseCategoryDeleteResponse], error) {
	if err := h.service.CategoryDelete(ctx, req.Msg.GetId()); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&pb.PurchaseCategoryDeleteResponse{}), nil
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
