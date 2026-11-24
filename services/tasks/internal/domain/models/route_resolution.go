package models

type RouteOutcome string

const (
	RouteMatched   RouteOutcome = "matched"
	RouteNotFound  RouteOutcome = "no_match"
	RouteAmbiguous RouteOutcome = "ambiguous"
)

type RouteResolution struct {
	Outcome RouteOutcome
	QueueID string
}

// Resolve uses the applicant's department from the server-side identity.
// Either unresolved outcome sends the request to triage.
func (routes ServiceRoutes) Resolve(applicantDepartmentID string) RouteResolution {
	if applicantDepartmentID != "" {
		exact := routes.resolveTier(applicantDepartmentID)
		if exact.Outcome != RouteNotFound {
			return exact
		}
	}
	return routes.resolveTier("")
}

func (routes ServiceRoutes) resolveTier(departmentID string) RouteResolution {
	result := RouteResolution{Outcome: RouteNotFound}
	for _, rule := range routes.Rules {
		if !rule.Active || rule.ApplicantDepartmentID != departmentID {
			continue
		}
		if result.Outcome == RouteMatched && result.QueueID != rule.QueueID {
			return RouteResolution{Outcome: RouteAmbiguous}
		}
		result = RouteResolution{Outcome: RouteMatched, QueueID: rule.QueueID}
	}
	return result
}
