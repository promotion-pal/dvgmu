package grpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"fesmu/contract/analytics/entity"
	"fesmu/contract/analytics/enum"
	pb "fesmu/contract/analytics/service"
	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/service"
)

type AnalyticHandler struct {
	service *service.AnalyticService
}

func AnalyticNewController(service *service.AnalyticService) *AnalyticHandler {
	return &AnalyticHandler{service: service}
}

func (h *AnalyticHandler) AnalyticCreate(
	ctx context.Context,
	req *connect.Request[pb.AnalyticCreateRequest],
) (*connect.Response[pb.AnalyticCreateResponse], error) {
	if req.Msg.GetName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("name is required"))
	}

	analytic := &models.Analytic{
		QR:         req.Msg.GetQr(),
		Name:       req.Msg.GetName(),
		Transcript: req.Msg.GetTranscript(),
		Type:       int32(req.Msg.GetType()),
	}

	id, err := h.service.AnalyticCreate(ctx, analytic)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.AnalyticCreateResponse{
		Success: true,
		Message: "analytic created",
		Id:      id,
	}), nil
}

func (h *AnalyticHandler) AnalyticUpdate(
	ctx context.Context,
	req *connect.Request[pb.AnalyticUpdateRequest],
) (*connect.Response[pb.AnalyticUpdateResponse], error) {
	msg := req.Msg
	if msg.GetId() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if msg.Name != nil && msg.GetName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("name is required"))
	}
	if msg.Qr != nil && msg.GetQr() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("qr must be positive"))
	}

	patch := models.AnalyticPatch{Name: msg.Name, Transcript: msg.Transcript, QR: msg.Qr}
	if msg.Type != nil {
		t := int32(msg.GetType())
		patch.Type = &t
	}

	analytic, err := h.service.AnalyticUpdate(ctx, msg.GetId(), patch)
	if errors.Is(err, models.ErrQRTaken) {
		return nil, connect.NewError(connect.CodeAlreadyExists, models.ErrQRTaken)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if analytic == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("analytic not found"))
	}

	return connect.NewResponse(&pb.AnalyticUpdateResponse{
		Success: true,
		Message: "analytic updated",
		Entity:  toProtoAnalytic(analytic),
	}), nil
}

func (h *AnalyticHandler) AnalyticByID(
	ctx context.Context,
	req *connect.Request[pb.AnalyticByIDRequest],
) (*connect.Response[pb.AnalyticByIDResponse], error) {
	analytic, err := h.service.AnalyticByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if analytic == nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("analytic not found"))
	}

	return connect.NewResponse(&pb.AnalyticByIDResponse{
		Entity: toProtoAnalytic(analytic),
	}), nil
}

func (h *AnalyticHandler) AnalyticFetch(
	ctx context.Context,
	req *connect.Request[pb.AnalyticFetchRequest],
	stream *connect.ServerStream[pb.AnalyticByIDResponse],
) error {
	var name *string
	if req.Msg.Name != nil {
		name = req.Msg.Name
	}

	var analyticType *int32
	if req.Msg.Type != nil {
		t := int32(*req.Msg.Type)
		analyticType = &t
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

	var qr *int64
	if req.Msg.Qr != nil {
		v := req.Msg.GetQr()
		qr = &v
	}

	analytics, err := h.service.AnalyticFetch(ctx, name, analyticType, startDate, endDate, qr)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	for i := range analytics {
		if err := stream.Send(&pb.AnalyticByIDResponse{
			Entity: toProtoAnalytic(&analytics[i]),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *AnalyticHandler) AnalyticRatingCreate(
	ctx context.Context,
	req *connect.Request[pb.AnalyticRatingCreateRequest],
) (*connect.Response[pb.AnalyticRatingCreateResponse], error) {
	if req.Msg.GetAnalyticId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("analyticId is required"))
	}

	rating := &models.AnalyticRating{
		AnalyticID: req.Msg.GetAnalyticId(),
		Comment:    req.Msg.GetComment(),

		RespondentLastName:   req.Msg.GetRespondentLastName(),
		RespondentFirstName:  req.Msg.GetRespondentFirstName(),
		RespondentMiddleName: req.Msg.GetRespondentMiddleName(),
		RespondentOffice:     req.Msg.GetRespondentOffice(),
		RespondentDepartment: req.Msg.GetRespondentDepartment(),

		WorkplacePcPowerRating:         req.Msg.GetWorkplacePcPowerRating(),
		WorkplaceOsBootRating:          req.Msg.GetWorkplaceOsBootRating(),
		WorkplaceSoftwareStableRating:  req.Msg.GetWorkplaceSoftwareStableRating(),
		WorkplaceNetworkSpeedRating:    req.Msg.GetWorkplaceNetworkSpeedRating(),
		WorkplaceMonitorRating:         req.Msg.GetWorkplaceMonitorRating(),
		WorkplaceKeyboardMouseRating:   req.Msg.GetWorkplaceKeyboardMouseRating(),
		WorkplaceMediaDevicesRating:    req.Msg.GetWorkplaceMediaDevicesRating(),
		WorkplaceOfficeEquipmentRating: req.Msg.GetWorkplaceOfficeEquipmentRating(),
		WorkplaceFurnitureRating:       req.Msg.GetWorkplaceFurnitureRating(),
		WorkplaceSpaceOrgRating:        req.Msg.GetWorkplaceSpaceOrgRating(),
		WorkplaceEnvironmentRating:     req.Msg.GetWorkplaceEnvironmentRating(),
		WorkplaceHasNetwork:            req.Msg.GetWorkplaceHasNetwork(),

		PurityRating:   req.Msg.GetPurityRating(),
		SmellRating:    req.Msg.GetSmellRating(),
		HasToiletPaper: req.Msg.GetHasToiletPaper(),
		HasSoap:        req.Msg.GetHasSoap(),
		Comfort:        req.Msg.GetComfort(),
		Equipment:      req.Msg.GetEquipment(),
		Cleanliness:    req.Msg.GetCleanliness(),

		InformationSecurityPosition:                  req.Msg.GetInformationSecurityPosition(),
		InformationSecurityComputerProficiency:       req.Msg.GetInformationSecurityComputerProficiency(),
		InformationSecurityInfoType:                  int32(req.Msg.GetInformationSecurityInfoType()),
		InformationSecurityResources:                 infoSecurityResourcesToInt32(req.Msg.GetInformationSecurityResources()),
		InformationSecurityResourcesOther:            req.Msg.GetInformationSecurityResourcesOther(),
		InformationSecurityPdnPurpose:                req.Msg.GetInformationSecurityPdnPurpose(),
		InformationSecurityStorageForm:               req.Msg.GetInformationSecurityStorageForm(),
		InformationSecurityPdnActions:                req.Msg.GetInformationSecurityPdnActions(),
		InformationSecurityThirdPartyAgreements:      req.Msg.GetInformationSecurityThirdPartyAgreements(),
		InformationSecurityPdnDestroyedAfterTerm:     req.Msg.GetInformationSecurityPdnDestroyedAfterTerm(),
		InformationSecurityPdnToArchive:              req.Msg.GetInformationSecurityPdnToArchive(),
		InformationSecurityOs:                        int32(req.Msg.GetInformationSecurityOs()),
		InformationSecurityHasCorporateEmail:         req.Msg.GetInformationSecurityHasCorporateEmail(),
		InformationSecurityCorporateEmailPersonalUse: req.Msg.GetInformationSecurityCorporateEmailPersonalUse(),

		TechnicalSupplyHasInternet:       req.Msg.GetTechnicalSupplyHasInternet(),
		TechnicalSupplyHasHeadset:        req.Msg.GetTechnicalSupplyHasHeadset(),
		TechnicalSupplyHasWorkplace:      req.Msg.GetTechnicalSupplyHasWorkplace(),
		TechnicalSupplyHasCorporateEmail: req.Msg.GetTechnicalSupplyHasCorporateEmail(),
		TechnicalSupplyHasComputer:       req.Msg.GetTechnicalSupplyHasComputer(),
		TechnicalSupplyHasMonitor:        req.Msg.GetTechnicalSupplyHasMonitor(),
		TechnicalSupplyHasPhone:          req.Msg.GetTechnicalSupplyHasPhone(),
		TechnicalSupplyHasPrinterAccess:  req.Msg.GetTechnicalSupplyHasPrinterAccess(),
		TechnicalSupplyHasSoftware:       req.Msg.GetTechnicalSupplyHasSoftware(),
		TechnicalSupplyHasDomainAccount:  req.Msg.GetTechnicalSupplyHasDomainAccount(),
	}

	ip := models.ClientIP(req.Header(), req.Peer().Addr)

	id, err := h.service.AnalyticRatingCreate(ctx, rating, ip)
	if err != nil {
		var tooSoon models.ReevaluationTooSoonError
		if errors.As(err, &tooSoon) {
			return nil, connect.NewError(connect.CodeResourceExhausted, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.AnalyticRatingCreateResponse{
		Success: true,
		Message: "analytic rating created",
		Id:      id,
	}), nil
}

// infoSecurityResourcesToInt32 переводит выбранные ресурсы из proto-enum в
// int32 для хранения, сохраняя порядок выбора пользователя.
func infoSecurityResourcesToInt32(src []enum.InformationSecurityResource) []int32 {
	if len(src) == 0 {
		// analytic_ratings.information_security_resources is JSONB NOT NULL —
		// a nil slice serializes to SQL NULL and violates that constraint,
		// so an empty selection must stay a non-nil empty slice ("[]").
		return []int32{}
	}
	out := make([]int32, len(src))
	for i, r := range src {
		out[i] = int32(r)
	}
	return out
}

// infoSecurityResourcesToProto — обратное преобразование для ответа.
func infoSecurityResourcesToProto(src []int32) []enum.InformationSecurityResource {
	if len(src) == 0 {
		return nil
	}
	out := make([]enum.InformationSecurityResource, len(src))
	for i, r := range src {
		out[i] = enum.InformationSecurityResource(r)
	}
	return out
}

func toProtoAnalytic(analytic *models.Analytic) *entity.Analytic {
	ratings := make([]*entity.AnalyticRating, 0, len(analytic.Ratings))
	for i := range analytic.Ratings {
		ratings = append(ratings, toProtoAnalyticRating(&analytic.Ratings[i]))
	}

	return &entity.Analytic{
		Id:         analytic.ID,
		Qr:         analytic.QR,
		Name:       analytic.Name,
		Transcript: analytic.Transcript,
		Type:       enum.AnalyticType(analytic.Type),
		Ratings:    ratings,
		CreatedAt:  timestamppb.New(analytic.CreatedAt),
		UpdatedAt:  timestamppb.New(analytic.UpdatedAt),
	}
}

func toProtoAnalyticRating(rating *models.AnalyticRating) *entity.AnalyticRating {
	return &entity.AnalyticRating{
		Id:         rating.ID,
		AnalyticId: rating.AnalyticID,
		Comment:    rating.Comment,

		RespondentLastName:   rating.RespondentLastName,
		RespondentFirstName:  rating.RespondentFirstName,
		RespondentMiddleName: rating.RespondentMiddleName,
		RespondentOffice:     rating.RespondentOffice,
		RespondentDepartment: rating.RespondentDepartment,

		WorkplacePcPowerRating:         rating.WorkplacePcPowerRating,
		WorkplaceOsBootRating:          rating.WorkplaceOsBootRating,
		WorkplaceSoftwareStableRating:  rating.WorkplaceSoftwareStableRating,
		WorkplaceNetworkSpeedRating:    rating.WorkplaceNetworkSpeedRating,
		WorkplaceMonitorRating:         rating.WorkplaceMonitorRating,
		WorkplaceKeyboardMouseRating:   rating.WorkplaceKeyboardMouseRating,
		WorkplaceMediaDevicesRating:    rating.WorkplaceMediaDevicesRating,
		WorkplaceOfficeEquipmentRating: rating.WorkplaceOfficeEquipmentRating,
		WorkplaceFurnitureRating:       rating.WorkplaceFurnitureRating,
		WorkplaceSpaceOrgRating:        rating.WorkplaceSpaceOrgRating,
		WorkplaceEnvironmentRating:     rating.WorkplaceEnvironmentRating,
		WorkplaceHasNetwork:            rating.WorkplaceHasNetwork,

		PurityRating:   rating.PurityRating,
		SmellRating:    rating.SmellRating,
		HasToiletPaper: rating.HasToiletPaper,
		HasSoap:        rating.HasSoap,
		Comfort:        rating.Comfort,
		Equipment:      rating.Equipment,
		Cleanliness:    rating.Cleanliness,

		InformationSecurityPosition:                  rating.InformationSecurityPosition,
		InformationSecurityComputerProficiency:       rating.InformationSecurityComputerProficiency,
		InformationSecurityInfoType:                  enum.InformationSecurityInfoType(rating.InformationSecurityInfoType),
		InformationSecurityResources:                 infoSecurityResourcesToProto(rating.InformationSecurityResources),
		InformationSecurityResourcesOther:            rating.InformationSecurityResourcesOther,
		InformationSecurityPdnPurpose:                rating.InformationSecurityPdnPurpose,
		InformationSecurityStorageForm:               rating.InformationSecurityStorageForm,
		InformationSecurityPdnActions:                rating.InformationSecurityPdnActions,
		InformationSecurityThirdPartyAgreements:      rating.InformationSecurityThirdPartyAgreements,
		InformationSecurityPdnDestroyedAfterTerm:     rating.InformationSecurityPdnDestroyedAfterTerm,
		InformationSecurityPdnToArchive:              rating.InformationSecurityPdnToArchive,
		InformationSecurityOs:                        enum.InformationSecurityOs(rating.InformationSecurityOs),
		InformationSecurityHasCorporateEmail:         rating.InformationSecurityHasCorporateEmail,
		InformationSecurityCorporateEmailPersonalUse: rating.InformationSecurityCorporateEmailPersonalUse,

		TechnicalSupplyHasInternet:       rating.TechnicalSupplyHasInternet,
		TechnicalSupplyHasHeadset:        rating.TechnicalSupplyHasHeadset,
		TechnicalSupplyHasWorkplace:      rating.TechnicalSupplyHasWorkplace,
		TechnicalSupplyHasCorporateEmail: rating.TechnicalSupplyHasCorporateEmail,
		TechnicalSupplyHasComputer:       rating.TechnicalSupplyHasComputer,
		TechnicalSupplyHasMonitor:        rating.TechnicalSupplyHasMonitor,
		TechnicalSupplyHasPhone:          rating.TechnicalSupplyHasPhone,
		TechnicalSupplyHasPrinterAccess:  rating.TechnicalSupplyHasPrinterAccess,
		TechnicalSupplyHasSoftware:       rating.TechnicalSupplyHasSoftware,
		TechnicalSupplyHasDomainAccount:  rating.TechnicalSupplyHasDomainAccount,

		CreatedAt: timestamppb.New(rating.CreatedAt),
		UpdatedAt: timestamppb.New(rating.UpdatedAt),
	}
}
