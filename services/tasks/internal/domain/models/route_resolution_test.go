package models

import "testing"

func TestServiceRoutesResolve(t *testing.T) {
	fallback := ServiceRouteRule{QueueID: "main-it", Active: true}
	departmentRoute := ServiceRouteRule{ApplicantDepartmentID: "simulation", QueueID: "campus-it", Active: true}
	alternative := ServiceRouteRule{ApplicantDepartmentID: "simulation", QueueID: "other-it", Active: true}
	otherDefault := ServiceRouteRule{QueueID: "other-it", Active: true}

	tests := []struct {
		name       string
		department string
		rules      []ServiceRouteRule
		want       RouteResolution
	}{
		{"specific route wins", "simulation", []ServiceRouteRule{fallback, departmentRoute}, RouteResolution{RouteMatched, "campus-it"}},
		{"default fallback", "therapy", []ServiceRouteRule{departmentRoute, fallback}, RouteResolution{RouteMatched, "main-it"}},
		{"missing applicant department", "", []ServiceRouteRule{departmentRoute, fallback}, RouteResolution{RouteMatched, "main-it"}},
		{"missing route", "therapy", []ServiceRouteRule{departmentRoute}, RouteResolution{Outcome: RouteNotFound}},
		{"ambiguous exact route overrides fallback", "simulation", []ServiceRouteRule{fallback, departmentRoute, alternative}, RouteResolution{Outcome: RouteAmbiguous}},
		{"ambiguous default routes", "therapy", []ServiceRouteRule{fallback, otherDefault}, RouteResolution{Outcome: RouteAmbiguous}},
		{"exact route ignores ambiguous defaults", "simulation", []ServiceRouteRule{fallback, otherDefault, departmentRoute}, RouteResolution{RouteMatched, "campus-it"}},
		{"inactive exact route ignored", "simulation", []ServiceRouteRule{fallback, {ApplicantDepartmentID: "simulation", QueueID: "campus-it"}}, RouteResolution{RouteMatched, "main-it"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			routes := ServiceRoutes{Rules: tt.rules}
			if got := routes.Resolve(tt.department); got != tt.want {
				t.Errorf("Resolve(%q) = %+v, want %+v", tt.department, got, tt.want)
			}
		})
	}
}
