package access

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"connectrpc.com/connect"
	"fesmu/authsession"
	mdmenum "fesmu/contract/mdm/enum"
	mdm "fesmu/contract/mdm/service"
	"fesmu/contract/mdm/service/serviceconnect"
)

type Applicant struct {
	ID           string
	DepartmentID string
}

type ApplicantResolver struct {
	verifier *authsession.Verifier
	mdm      serviceconnect.UserServiceClient
	log      *slog.Logger
}

func NewApplicantResolver(verifier *authsession.Verifier, mdm serviceconnect.UserServiceClient, log *slog.Logger) *ApplicantResolver {
	return &ApplicantResolver{verifier: verifier, mdm: mdm, log: log}
}

func (r *ApplicantResolver) Resolve(ctx context.Context, header http.Header) (Applicant, error) {
	profile, err := r.resolveActiveProfile(ctx, header)
	if err != nil {
		return Applicant{}, err
	}
	applicant := Applicant{ID: profile.GetUser().GetUuid()}
	departments := profile.GetDepartments()
	if len(departments) == 1 && departments[0] != mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_UNSPECIFIED {
		applicant.DepartmentID = departments[0].String()
	}
	return applicant, nil
}

func (r *ApplicantResolver) RequireAdmin(ctx context.Context, header http.Header) error {
	profile, err := r.resolveActiveProfile(ctx, header)
	if err != nil {
		return err
	}
	if !slices.Contains(profile.GetUser().GetRoles(), mdmenum.UserRole_USER_ROLE_ADMIN) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("FESMU administrator required"))
	}
	return nil
}

func (r *ApplicantResolver) RequireActiveUser(ctx context.Context, uuid string) error {
	_, err := r.fetchActiveProfile(ctx, uuid)
	if errors.Is(err, errActiveProfileRequired) {
		return connect.NewError(connect.CodeNotFound, errors.New("active FESMU user not found"))
	}
	return err
}

func (r *ApplicantResolver) resolveActiveProfile(ctx context.Context, header http.Header) (*mdm.UserFetchByUUIDResponse, error) {
	identity, err := r.verifier.FromHeader(ctx, header)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	profile, err := r.fetchActiveProfile(ctx, identity.UUID)
	if errors.Is(err, errActiveProfileRequired) {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}
	return profile, err
}

var errActiveProfileRequired = errors.New("active MDM profile required")

func (r *ApplicantResolver) fetchActiveProfile(ctx context.Context, uuid string) (*mdm.UserFetchByUUIDResponse, error) {
	profile, err := r.mdm.UserFetchByUUID(ctx, connect.NewRequest(&mdm.UserFetchByUUIDRequest{Uuid: uuid}))
	if err != nil {
		switch connect.CodeOf(err) {
		case connect.CodeNotFound:
			return nil, errActiveProfileRequired
		case connect.CodeCanceled, connect.CodeDeadlineExceeded:
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
		}
		r.log.Warn("could not load user from MDM", "error", err)
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("user profile is temporarily unavailable"))
	}
	user := profile.Msg.GetUser()
	if user.GetUuid() != uuid || user.GetStatus() != mdmenum.UserStatus_USER_STATUS_ACTIVE {
		return nil, errActiveProfileRequired
	}
	return profile.Msg, nil
}
