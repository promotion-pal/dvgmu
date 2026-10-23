package purchase

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"slices"
	"testing"

	"connectrpc.com/connect"

	entity "dvgmu/api/contract/gen/go/entity/v2"
	enum "dvgmu/api/contract/gen/go/enum/v2"
	pb "dvgmu/api/contract/gen/go/service/v2"
	"dvgmu/api/internal/auth"
)

// Each role of the flow has its own access section, and they are exactly
// the purchase sections the auth interceptor opens the service with.
func TestRoleSectionTable(t *testing.T) {
	var sections []auth.Section
	for role := range roleLabel {
		section, ok := roleSection[role]
		if !ok {
			t.Fatalf("role %v has no access section", role)
		}
		if slices.Contains(sections, section) {
			t.Fatalf("section %v is used by two roles", section)
		}
		sections = append(sections, section)
	}
	if len(sections) != len(auth.PurchaseSections) {
		t.Fatalf("roles cover %d sections, auth knows %d", len(sections), len(auth.PurchaseSections))
	}
	for _, s := range auth.PurchaseSections {
		if !slices.Contains(sections, s) {
			t.Fatalf("section %v belongs to no role", s)
		}
	}
	if got := auth.Perm(roleSection[roleEmployee], auth.ActionPost); got != "purchase_request.post" {
		t.Fatalf("employee acts with %q", got)
	}
}

// codeOf is the Connect code of err, or 0 for no error.
func codeOf(err error) connect.Code {
	if err == nil {
		return 0
	}
	if ce := new(connect.Error); errors.As(err, &ce) {
		return ce.Code()
	}
	return connect.CodeUnknown
}

// The check runs in the handler, before the service: with no database behind
// it, a call that got past the check answers Unavailable.
func TestHandlerChecksRole(t *testing.T) {
	h := &handler{service: newService(slog.New(slog.NewTextHandler(io.Discard, nil)), nil, nil)}
	as := func(roles []string, perms ...string) context.Context {
		return auth.WithUser(context.Background(), &auth.User{UUID: "u", Roles: roles, Permissions: perms})
	}
	post := func(s auth.Section) string { return auth.Perm(s, auth.ActionPost) }
	fetch := func(s auth.Section) string { return auth.Perm(s, auth.ActionFetch) }
	create := func(ctx context.Context, role enum.PurchaseActorRole) error {
		_, err := h.PurchaseRequestCreate(ctx, connect.NewRequest(&pb.PurchaseRequestCreateRequest{
			Actor: &entity.PurchaseActor{Role: role}, Title: "Ноутбук", Quantity: 1, Department: "Кафедра",
		}))
		return err
	}
	decide := func(ctx context.Context) error {
		_, err := h.PurchaseLotAction(ctx, connect.NewRequest(&pb.PurchaseLotActionRequest{
			Actor: &entity.PurchaseActor{Role: roleCommission}, Id: 1,
			Action: enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_APPROVE,
		}))
		return err
	}

	vrAct := func(ctx context.Context) error {
		_, err := h.PurchaseLotAction(ctx, connect.NewRequest(&pb.PurchaseLotActionRequest{
			Actor: &entity.PurchaseActor{Role: roleViceRector}, Id: 1,
			Action: enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST,
		}))
		return err
	}
	cases := []struct {
		name string
		err  error
		want connect.Code
	}{
		{"not signed in", create(context.Background(), roleEmployee), connect.CodeUnauthenticated},
		{"no rights", create(as(nil), roleEmployee), connect.CodePermissionDenied},
		{"view only", create(as(nil, fetch(auth.SectionPurchaseRequest)), roleEmployee), connect.CodePermissionDenied},
		{"another role's right", create(as(nil, post(auth.SectionPurchaseHead)), roleEmployee), connect.CodePermissionDenied},
		{"own role's right", create(as(nil, post(auth.SectionPurchaseRequest)), roleEmployee), connect.CodeUnavailable},
		{"commission without right", decide(as(nil, post(auth.SectionPurchaseEconomist))), connect.CodePermissionDenied},
		{"commission with right", decide(as(nil, post(auth.SectionPurchaseCommission))), connect.CodeUnavailable},
		{"admin acts as anyone", decide(as([]string{auth.RoleAdmin})), connect.CodeUnavailable},
		{"vice-rector not bound in the directory", vrAct(as(nil, post(auth.SectionPurchaseViceRector))), connect.CodePermissionDenied},
		{"unknown role", create(as([]string{auth.RoleAdmin}), enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_UNSPECIFIED), connect.CodeInvalidArgument},
	}
	for _, tc := range cases {
		if got := codeOf(tc.err); got != tc.want {
			t.Errorf("%s: code %v (%v), want %v", tc.name, got, tc.err, tc.want)
		}
	}

	// Reads take no role: viewing is the interceptor's check.
	viewer := as(nil, fetch(auth.SectionPurchaseCommission))
	if _, err := h.PurchaseOverview(viewer, connect.NewRequest(&pb.PurchaseOverviewRequest{})); codeOf(err) != connect.CodeUnavailable {
		t.Errorf("overview: %v", err)
	}
	if _, err := h.PurchaseQuotationFile(viewer, connect.NewRequest(&pb.PurchaseQuotationFileRequest{Id: 1})); codeOf(err) != connect.CodeUnavailable {
		t.Errorf("quotation file: %v", err)
	}
	if _, err := h.PurchaseCodeSuggest(viewer, connect.NewRequest(&pb.PurchaseCodeSuggestRequest{Title: "Ноутбук"})); err != nil {
		t.Errorf("code suggest: %v", err)
	}
}
