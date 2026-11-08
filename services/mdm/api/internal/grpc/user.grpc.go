package grpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	pb "fesmu/contract/mdm/service"
)

type UserHandler struct {
	service              *service.UserService
	activation           *service.ActivationService
	userPermissionGroups *service.UserPermissionGroupService
}

func UserNewController(service *service.UserService, activation *service.ActivationService, userPermissionGroups *service.UserPermissionGroupService) *UserHandler {
	return &UserHandler{service: service, activation: activation, userPermissionGroups: userPermissionGroups}
}

func (h *UserHandler) UserFetch(
	ctx context.Context,
	req *connect.Request[pb.UserFetchRequest],
) (*connect.Response[pb.UserFetchResponse], error) {
	list, err := h.service.UserFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.UserFetchResponse{}
	for _, u := range list {
		resp.Users = append(resp.Users, u.ToProto())
	}

	return connect.NewResponse(resp), nil
}

func (h *UserHandler) UserCreate(
	ctx context.Context,
	req *connect.Request[pb.UserCreateRequest],
) (*connect.Response[pb.UserCreateResponse], error) {
	if req.Msg.GetFirstName() == "" || req.Msg.GetLastName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("first_name and last_name are required"))
	}

	params := models.UserCreateParams{
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		Phone:      req.Msg.Phone,
	}
	if req.Msg.GetBirthday() != nil {
		birthday := req.Msg.GetBirthday().AsTime()
		params.Birthday = &birthday
	}

	result, err := h.service.UserCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return connect.NewResponse(&pb.UserCreateResponse{
				Success: false,
				Message: err.Error(),
			}), nil
		}
		if errors.Is(err, models.ErrInvalidPhone) {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserCreateResponse{
		Success:           true,
		Message:           "user created",
		Id:                result.ID,
		Email:             result.Email,
		TemporaryPassword: result.TemporaryPassword,
	}), nil
}

func (h *UserHandler) UserFetchByID(
	ctx context.Context,
	req *connect.Request[pb.UserFetchByIDRequest],
) (*connect.Response[pb.UserFetchByIDResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	user, err := h.service.UserByID(ctx, req.Msg.GetId())
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserFetchByIDResponse{
		Profile: user.ToFullProto(),
	}), nil
}

func (h *UserHandler) UserFetchByUUID(
	ctx context.Context,
	req *connect.Request[pb.UserFetchByUUIDRequest],
) (*connect.Response[pb.UserFetchByUUIDResponse], error) {
	if req.Msg.GetUuid() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("uuid is required"))
	}

	user, err := h.service.UserByUUID(ctx, req.Msg.GetUuid())
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}
	return connect.NewResponse(&pb.UserFetchByUUIDResponse{
		User:                 user.ToProto(),
		Username:             username,
		EffectivePermissions: user.EffectivePermissions(),
		Departments:          user.DepartmentList(),
	}), nil
}

func (h *UserHandler) UserFetchByADObjectID(
	ctx context.Context,
	req *connect.Request[pb.UserFetchByADObjectIDRequest],
) (*connect.Response[pb.UserFetchByADObjectIDResponse], error) {
	if req.Msg.GetAdObjectId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("ad_object_id is required"))
	}

	user, err := h.service.UserByADObjectID(ctx, req.Msg.GetAdObjectId())
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}
	return connect.NewResponse(&pb.UserFetchByADObjectIDResponse{
		User:                 user.ToProto(),
		Username:             username,
		EffectivePermissions: user.EffectivePermissions(),
		Departments:          user.DepartmentList(),
	}), nil
}

func (h *UserHandler) ActivationIssue(
	ctx context.Context,
	req *connect.Request[pb.ActivationIssueRequest],
) (*connect.Response[pb.ActivationIssueResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	code, expiresAt, err := h.activation.Issue(ctx, req.Msg.GetId())
	if err != nil {
		switch {
		case errors.Is(err, models.ErrUserNotFound):
			return nil, connect.NewError(connect.CodeNotFound, err)
		case errors.Is(err, models.ErrNoUsername):
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("у пользователя нет логина AD — код выдать нельзя"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.ActivationIssueResponse{Code: code, ExpiresAt: timestamppb.New(expiresAt)}), nil
}

func (h *UserHandler) UserPermissionsSet(
	ctx context.Context,
	req *connect.Request[pb.UserPermissionsSetRequest],
) (*connect.Response[pb.UserPermissionsSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	user, err := h.service.UserPermissionsSet(ctx, req.Msg.GetId(), req.Msg.GetPermissions())
	if err != nil {
		switch {
		case errors.Is(err, models.ErrInvalidPermission):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		case errors.Is(err, models.ErrUserNotFound):
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserPermissionsSetResponse{User: user.ToProto()}), nil
}

func (h *UserHandler) UserRolesSet(
	ctx context.Context,
	req *connect.Request[pb.UserRolesSetRequest],
) (*connect.Response[pb.UserRolesSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	user, err := h.service.UserRolesSet(ctx, req.Msg.GetId(), req.Msg.GetRoles())
	if err != nil {
		switch {
		case errors.Is(err, models.ErrInvalidRole):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		case errors.Is(err, models.ErrUserNotFound):
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserRolesSetResponse{User: user.ToProto()}), nil
}

func (h *UserHandler) UserUpdate(
	ctx context.Context,
	req *connect.Request[pb.UserUpdateRequest],
) (*connect.Response[pb.UserUpdateResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if req.Msg.GetFirstName() == "" || req.Msg.GetLastName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("first_name and last_name are required"))
	}

	params := models.UserCreateParams{
		FirstName:  req.Msg.GetFirstName(),
		LastName:   req.Msg.GetLastName(),
		Patronymic: req.Msg.GetPatronymic(),
		Email:      req.Msg.GetEmail(),
		Phone:      req.Msg.Phone,
	}
	if req.Msg.GetBirthday() != nil {
		birthday := req.Msg.GetBirthday().AsTime()
		params.Birthday = &birthday
	}

	if err := h.service.UserUpdate(ctx, req.Msg.GetId(), params); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		if errors.Is(err, models.ErrInvalidPhone) {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserUpdateResponse{
		Success: true,
		Message: "user updated",
	}), nil
}

func (h *UserHandler) UserDelete(
	ctx context.Context,
	req *connect.Request[pb.UserDeleteRequest],
) (*connect.Response[pb.UserDeleteResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}

	if err := h.service.UserDelete(ctx, req.Msg.GetId()); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserDeleteResponse{
		Success: true,
		Message: "user deleted",
	}), nil
}

func (h *UserHandler) UserDeleteBatch(
	ctx context.Context,
	req *connect.Request[pb.UserDeleteBatchRequest],
) (*connect.Response[pb.UserDeleteBatchResponse], error) {
	if len(req.Msg.GetIds()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("ids are required"))
	}

	deleted, err := h.service.UserDeleteBatch(ctx, req.Msg.GetIds())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UserDeleteBatchResponse{
		Success:      true,
		Message:      "users deleted",
		DeletedCount: deleted,
	}), nil
}

func (h *UserHandler) UserCreateBatch(
	ctx context.Context,
	req *connect.Request[pb.UserCreateBatchRequest],
) (*connect.Response[pb.UserCreateBatchResponse], error) {
	items := make([]models.UserCreateBatchItemParams, 0, len(req.Msg.GetUsers()))
	for _, u := range req.Msg.GetUsers() {
		item := models.UserCreateBatchItemParams{
			FirstName:  u.GetFirstName(),
			LastName:   u.GetLastName(),
			Patronymic: u.GetPatronymic(),
			Email:      u.GetEmail(),
			Phone:      u.Phone,
		}
		if u.GetBirthday() != nil {
			birthday := u.GetBirthday().AsTime()
			item.Birthday = &birthday
		}

		if p := u.GetPassport(); p != nil {
			item.Passport = &models.PassportCreateParams{
				Series:              p.GetSeries(),
				Number:              p.GetNumber(),
				Authority:           p.GetAuthority(),
				IssueDate:           p.GetIssueDate(),
				ExpiryDate:          p.GetExpiryDate(),
				DepartmentCode:      p.GetDepartmentCode(),
				Snils:               p.GetSnils(),
				BirthPlace:          p.GetBirthPlace(),
				Gender:              p.GetGender(),
				Nationality:         p.GetNationality(),
				RegistrationDate:    p.GetRegistrationDate(),
				ResidentialAddress:  p.GetResidentialAddress(),
				RegistrationAddress: p.GetRegistrationAddress(),
			}
		}

		for _, e := range u.GetEducations() {
			edu := models.EducationCreateParams{
				Type:                   e.GetType(),
				Status:                 e.GetStatus(),
				Series:                 e.GetSeries(),
				Number:                 e.GetNumber(),
				RegistrationNumber:     e.GetRegistrationNumber(),
				InstitutionInn:         e.GetInstitutionInn(),
				InstitutionName:        e.GetInstitutionName(),
				InstitutionCity:        e.GetInstitutionCity(),
				InstitutionRegion:      e.GetInstitutionRegion(),
				InstitutionCountryCode: e.GetInstitutionCountryCode(),
				SpecialtyCode:          e.GetSpecialtyCode(),
				SpecialtyName:          e.GetSpecialtyName(),
				Qualification:          e.GetQualification(),
				Honors:                 e.GetHonors(),
				SupplementSeries:       e.GetSupplementSeries(),
				SupplementNumber:       e.GetSupplementNumber(),
				IsOriginal:             e.GetIsOriginal(),
				IsVerifiedViaFrdo:      e.GetIsVerifiedViaFrdo(),
			}
			if e.GetIssueDate() != nil {
				edu.IssueDate = e.GetIssueDate().AsTime()
			}
			item.Educations = append(item.Educations, edu)
		}

		if m := u.GetMilitary(); m != nil {
			military := &models.MilitaryCreateParams{
				Commissariat: m.GetCommissariat(),
				VusCode:      m.GetVusCode(),
				Rank:         m.GetRank(),
				Document:     m.GetDocument(),
				Validity:     m.GetValidity(),
				HasDeferment: m.GetHasDeferment(),
			}
			if m.GetDefermentExpiresAt() != nil {
				military.DefermentExpiresAt = m.GetDefermentExpiresAt().AsTime()
			}
			item.Military = military
		}

		items = append(items, item)
	}

	results := h.service.UserCreateBatch(ctx, items)

	resp := &pb.UserCreateBatchResponse{}
	for _, r := range results {
		resp.Results = append(resp.Results, &pb.UserCreateBatchResult{
			Index:             int32(r.Index),
			Success:           r.Success,
			Message:           r.Message,
			UserId:            r.UserID,
			Email:             r.Email,
			TemporaryPassword: r.TemporaryPassword,
		})
	}

	return connect.NewResponse(resp), nil
}

func (h *UserHandler) PassportCreate(
	ctx context.Context,
	req *connect.Request[pb.PassportCreateRequest],
) (*connect.Response[pb.PassportCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}
	if req.Msg.GetSeries() == "" || req.Msg.GetNumber() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("series and number are required"))
	}

	params := models.PassportCreateParams{
		UserID:              req.Msg.GetUserId(),
		Series:              req.Msg.GetSeries(),
		Number:              req.Msg.GetNumber(),
		Authority:           req.Msg.GetAuthority(),
		IssueDate:           req.Msg.GetIssueDate(),
		ExpiryDate:          req.Msg.GetExpiryDate(),
		DepartmentCode:      req.Msg.GetDepartmentCode(),
		Snils:               req.Msg.GetSnils(),
		BirthPlace:          req.Msg.GetBirthPlace(),
		Gender:              req.Msg.GetGender(),
		Nationality:         req.Msg.GetNationality(),
		RegistrationDate:    req.Msg.GetRegistrationDate(),
		ResidentialAddress:  req.Msg.GetResidentialAddress(),
		RegistrationAddress: req.Msg.GetRegistrationAddress(),
	}

	id, err := h.service.PassportCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.PassportCreateResponse{
		Success:    true,
		Message:    "passport created",
		PassportId: id,
	}), nil
}

func (h *UserHandler) EducationCreate(
	ctx context.Context,
	req *connect.Request[pb.EducationCreateRequest],
) (*connect.Response[pb.EducationCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}

	params := models.EducationCreateParams{
		UserID:                 req.Msg.GetUserId(),
		Type:                   req.Msg.GetType(),
		Status:                 req.Msg.GetStatus(),
		Series:                 req.Msg.GetSeries(),
		Number:                 req.Msg.GetNumber(),
		RegistrationNumber:     req.Msg.GetRegistrationNumber(),
		InstitutionInn:         req.Msg.GetInstitutionInn(),
		InstitutionName:        req.Msg.GetInstitutionName(),
		InstitutionCity:        req.Msg.GetInstitutionCity(),
		InstitutionRegion:      req.Msg.GetInstitutionRegion(),
		InstitutionCountryCode: req.Msg.GetInstitutionCountryCode(),
		SpecialtyCode:          req.Msg.GetSpecialtyCode(),
		SpecialtyName:          req.Msg.GetSpecialtyName(),
		Qualification:          req.Msg.GetQualification(),
		Honors:                 req.Msg.GetHonors(),
		SupplementSeries:       req.Msg.GetSupplementSeries(),
		SupplementNumber:       req.Msg.GetSupplementNumber(),
		IsOriginal:             req.Msg.GetIsOriginal(),
		IsVerifiedViaFrdo:      req.Msg.GetIsVerifiedViaFrdo(),
	}
	if req.Msg.GetIssueDate() != nil {
		params.IssueDate = req.Msg.GetIssueDate().AsTime()
	}

	id, err := h.service.EducationCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.EducationCreateResponse{
		Success:     true,
		Message:     "education created",
		EducationId: id,
	}), nil
}

func (h *UserHandler) MilitaryCreate(
	ctx context.Context,
	req *connect.Request[pb.MilitaryCreateRequest],
) (*connect.Response[pb.MilitaryCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}

	params := models.MilitaryCreateParams{
		UserID:       req.Msg.GetUserId(),
		Commissariat: req.Msg.GetCommissariat(),
		VusCode:      req.Msg.GetVusCode(),
		Rank:         req.Msg.GetRank(),
		Document:     req.Msg.GetDocument(),
		Validity:     req.Msg.GetValidity(),
		HasDeferment: req.Msg.GetHasDeferment(),
	}
	if req.Msg.GetDefermentExpiresAt() != nil {
		params.DefermentExpiresAt = req.Msg.GetDefermentExpiresAt().AsTime()
	}

	id, err := h.service.MilitaryCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.MilitaryCreateResponse{
		Success:    true,
		Message:    "military record created",
		MilitaryId: id,
	}), nil
}

func (h *UserHandler) StudentCreate(
	ctx context.Context,
	req *connect.Request[pb.StudentCreateRequest],
) (*connect.Response[pb.StudentCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}

	params := models.StudentCreateParams{
		UserID:         req.Msg.GetUserId(),
		Group:          req.Msg.GetGroup(),
		RecordBook:     req.Msg.GetRecordBook(),
		Status:         req.Msg.GetStatus(),
		EducationForm:  req.Msg.GetEducationForm(),
		NeedsDormitory: req.Msg.GetNeedsDormitory(),
	}

	id, err := h.service.StudentCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.StudentCreateResponse{
		Success:   true,
		Message:   "student record created",
		StudentId: id,
	}), nil
}

func (h *UserHandler) EmployeeCreate(
	ctx context.Context,
	req *connect.Request[pb.EmployeeCreateRequest],
) (*connect.Response[pb.EmployeeCreateResponse], error) {
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}

	params := models.EmployeeCreateParams{
		UserID:     req.Msg.GetUserId(),
		Department: req.Msg.GetDepartment(),
		Status:     req.Msg.GetStatus(),
		Position:   req.Msg.GetPosition(),
	}

	id, err := h.service.EmployeeCreate(ctx, params)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.EmployeeCreateResponse{
		Success:    true,
		Message:    "employee record created",
		EmployeeId: id,
	}), nil
}

func (h *UserHandler) StudentFetch(
	ctx context.Context,
	_ *connect.Request[pb.StudentFetchRequest],
) (*connect.Response[pb.StudentFetchResponse], error) {
	list, err := h.service.StudentFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.StudentFetchResponse{}
	for _, st := range list {
		resp.Students = append(resp.Students, &pb.StudentWithUser{
			Student: st.ToProto(),
			User:    st.User.ToProto(),
		})
	}

	return connect.NewResponse(resp), nil
}

func (h *UserHandler) EmployeeFetch(
	ctx context.Context,
	_ *connect.Request[pb.EmployeeFetchRequest],
) (*connect.Response[pb.EmployeeFetchResponse], error) {
	list, err := h.service.EmployeeFetch(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	resp := &pb.EmployeeFetchResponse{}
	for _, em := range list {
		resp.Employees = append(resp.Employees, &pb.EmployeeWithUser{
			Employee: em.ToProto(),
			User:     em.User.ToProto(),
		})
	}

	return connect.NewResponse(resp), nil
}

func (h *UserHandler) UserPositionSet(
	ctx context.Context,
	req *connect.Request[pb.UserPositionSetRequest],
) (*connect.Response[pb.UserPositionSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	user, err := h.service.UserPositionSet(ctx, req.Msg.GetId(), req.Msg.GetPosition())
	if err != nil {
		switch {
		case errors.Is(err, models.ErrUserNotFound):
			return nil, connect.NewError(connect.CodeNotFound, err)
		case errors.Is(err, models.ErrPositionTooLong):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&pb.UserPositionSetResponse{User: user.ToProto()}), nil
}

func (h *UserHandler) UserDepartmentsSet(
	ctx context.Context,
	req *connect.Request[pb.UserDepartmentsSetRequest],
) (*connect.Response[pb.UserDepartmentsSetResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	user, err := h.service.UserDepartmentsSet(ctx, req.Msg.GetId(), req.Msg.GetDepartments())
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&pb.UserDepartmentsSetResponse{User: user.ToProto()}), nil
}
