package access

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

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
	identity, err := r.verifier.FromHeader(ctx, header)
	if err != nil {
		return Applicant{}, connect.NewError(connect.CodeUnauthenticated, err)
	}

	profile, err := r.mdm.UserFetchByUUID(ctx, connect.NewRequest(&mdm.UserFetchByUUIDRequest{Uuid: identity.UUID}))
	if err != nil {
		switch connect.CodeOf(err) {
		case connect.CodeNotFound:
			return Applicant{}, inactiveApplicant()
		case connect.CodeCanceled, connect.CodeDeadlineExceeded:
			if ctx.Err() != nil {
				return Applicant{}, ctx.Err()
			}
		}
		r.log.Warn("could not load applicant from MDM", "error", err)
		return Applicant{}, connect.NewError(connect.CodeUnavailable, errors.New("applicant profile is temporarily unavailable"))
	}
	user := profile.Msg.GetUser()
	if user.GetUuid() != identity.UUID || user.GetStatus() != mdmenum.UserStatus_USER_STATUS_ACTIVE {
		return Applicant{}, inactiveApplicant()
	}

	applicant := Applicant{ID: identity.UUID}
	departments := profile.Msg.GetDepartments()
	if len(departments) == 1 && departments[0] != mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_UNSPECIFIED {
		applicant.DepartmentID = departments[0].String()
	}
	return applicant, nil
}

func inactiveApplicant() error {
	return connect.NewError(connect.CodePermissionDenied, errors.New("active MDM profile required"))
}
