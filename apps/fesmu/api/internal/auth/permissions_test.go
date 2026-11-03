package auth

import (
	"regexp"
	"testing"

	enum "fesmu/contract/fesmu/enum/v1"
	serviceconnect "fesmu/contract/fesmu/service/v1/servicev1connect"
	"fesmu/contract/fesmu/service/v2/servicev2connect"
)

// Строки прав — те же, что хранит MDM (формат "раздел.действие") и что
// строит фронт из того же enum.
func TestPerm(t *testing.T) {
	if got := Perm(SectionComputerClasses, ActionPost); got != "computer_classes.post" {
		t.Fatalf("Perm = %q", got)
	}
	format := regexp.MustCompile(`^[a-z][a-z_]*\.[a-z][a-z_]*$`)
	for v := range enum.PermissionSection_name {
		section := Section(v)
		if section == enum.PermissionSection_PERMISSION_SECTION_UNSPECIFIED {
			continue
		}
		for _, action := range []Action{ActionFetch, ActionPost} {
			if p := Perm(section, action); !format.MatchString(p) || len(p) > 64 {
				t.Errorf("%v/%v → %q: not a valid MDM permission", section, action, p)
			}
		}
	}
}

func TestHallAccessUsesSingleManagePermission(t *testing.T) {
	viewer := &User{Permissions: []string{Perm(SectionHalls, ActionFetch)}}
	if viewer.Can(SectionHalls, ActionFetch) || viewer.Can(SectionHalls, ActionPost) {
		t.Fatal("halls.fetch must not grant access to the common schedule or moderation")
	}
	manager := &User{Permissions: []string{Perm(SectionHalls, ActionPost)}}
	if !manager.Can(SectionHalls, ActionFetch) || !manager.Can(SectionHalls, ActionPost) {
		t.Fatal("halls.post must grant both schedule viewing and moderation")
	}
}

// Чтения закупок названы не по правилу ...Fetch/...ByID — их знает readProcedures;
// всё остальное в сервисе закупок — изменение.
func TestActionOf(t *testing.T) {
	cases := map[string]Action{
		"/contract.service.v1.InventoryService/InventoryFetch":         ActionFetch,
		"/contract.service.v1.InventoryService/InventoryByID":          ActionFetch,
		"/contract.service.v1.InventoryService/InventoryUpdate":        ActionPost,
		servicev2connect.PurchaseServicePurchaseOverviewProcedure:      ActionFetch,
		servicev2connect.PurchaseServicePurchaseQuotationFileProcedure: ActionFetch,
		servicev2connect.PurchaseServicePurchaseCodeSuggestProcedure:   ActionFetch,
		serviceconnect.TestServiceTestExportProcedure:                  ActionFetch,
		serviceconnect.TestServiceTestImportParseProcedure:             ActionPost,
		servicev2connect.PurchaseServicePurchaseLotRequestsProcedure:   ActionPost,
		servicev2connect.PurchaseServicePurchaseLotActionProcedure:     ActionPost,
	}
	for procedure, want := range cases {
		if got := ActionOf(procedure); got != want {
			t.Errorf("ActionOf(%s) = %v, want %v", procedure, got, want)
		}
	}
}
