package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"connectrpc.com/connect"

	enum "dvgmu/api/contract/gen/go/enum/v1"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
	"dvgmu/api/contract/gen/go/service/v2/servicev2connect"
)

// Разделы и действия — enum контракта (contract/enum/v1/permission.enum.proto),
// общий с фронтом. Право — строка "раздел.действие" (так оно в MDM и в
// токене); изменение (post) включает просмотр (fetch). У ADMIN есть всё.
type (
	Section = enum.PermissionSection
	Action  = enum.PermissionAction
)

// Короткие имена для кода api.
const (
	ActionFetch = enum.PermissionAction_PERMISSION_ACTION_FETCH
	ActionPost  = enum.PermissionAction_PERMISSION_ACTION_POST

	SectionInfrastructure  = enum.PermissionSection_PERMISSION_SECTION_INFRASTRUCTURE
	SectionInventory       = enum.PermissionSection_PERMISSION_SECTION_INVENTORY
	SectionTickets         = enum.PermissionSection_PERMISSION_SECTION_TICKETS
	SectionSchedule        = enum.PermissionSection_PERMISSION_SECTION_SCHEDULE
	SectionHalls           = enum.PermissionSection_PERMISSION_SECTION_HALLS
	SectionComputerClasses = enum.PermissionSection_PERMISSION_SECTION_COMPUTER_CLASSES
	SectionVaccination     = enum.PermissionSection_PERMISSION_SECTION_VACCINATION
	SectionCertificate     = enum.PermissionSection_PERMISSION_SECTION_CERTIFICATE
	SectionTests           = enum.PermissionSection_PERMISSION_SECTION_TESTS
	SectionLibrary         = enum.PermissionSection_PERMISSION_SECTION_LIBRARY
	SectionManuals         = enum.PermissionSection_PERMISSION_SECTION_MANUALS
	SectionAnalytics       = enum.PermissionSection_PERMISSION_SECTION_ANALYTICS

	// Закупки v2: по разделу на роль в процессе.
	SectionPurchaseRequest    = enum.PermissionSection_PERMISSION_SECTION_PURCHASE_REQUEST
	SectionPurchaseHead       = enum.PermissionSection_PERMISSION_SECTION_PURCHASE_HEAD
	SectionPurchaseViceRector = enum.PermissionSection_PERMISSION_SECTION_PURCHASE_VICE_RECTOR
	SectionPurchaseEconomist  = enum.PermissionSection_PERMISSION_SECTION_PURCHASE_ECONOMIST
	SectionPurchaseCommission = enum.PermissionSection_PERMISSION_SECTION_PURCHASE_COMMISSION
)

// PurchaseSections — все разделы закупок v2; просмотр любого открывает сервис.
var PurchaseSections = []Section{
	SectionPurchaseRequest,
	SectionPurchaseHead,
	SectionPurchaseViceRector,
	SectionPurchaseEconomist,
	SectionPurchaseCommission,
}

// Perm — право action на раздел: Perm(SectionSchedule, ActionPost) =
// "schedule.post" (имя значения enum без префикса, в нижнем регистре).
func Perm(section Section, action Action) string {
	return strings.ToLower(strings.TrimPrefix(section.String(), "PERMISSION_SECTION_")) + "." +
		strings.ToLower(strings.TrimPrefix(action.String(), "PERMISSION_ACTION_"))
}

// HasPermission: право perm или роль ADMIN (у администратора все права).
func (u *User) HasPermission(perm string) bool {
	if u.isAdmin() {
		return true
	}
	for _, p := range u.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

// Can — может ли action в разделе: просмотр даёт fetch или post, изменение — post.
func (u *User) Can(section Section, action Action) bool {
	if action == ActionFetch && u.HasPermission(Perm(section, ActionFetch)) {
		return true
	}
	return u.HasPermission(Perm(section, ActionPost))
}

func (u *User) isAdmin() bool {
	for _, r := range u.Roles {
		if r == RoleAdmin {
			return true
		}
	}
	return false
}

// RequireCan пропускает только с правом action на раздел (или ADMIN).
func RequireCan(ctx context.Context, section Section, action Action) error {
	u, ok := UserFromContext(ctx)
	if !ok {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}
	if !u.Can(section, action) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("нет доступа: "+Perm(section, action)))
	}
	return nil
}

// readProcedures — процедуры, которые только читают, но названы не по
// правилу ...Fetch/...ByID (переименовать — сломать контракт).
var readProcedures = map[string]bool{
	servicev2connect.PurchaseServicePurchaseOverviewProcedure:      true,
	servicev2connect.PurchaseServicePurchaseQuotationFileProcedure: true,
	servicev2connect.PurchaseServicePurchaseCodeSuggestProcedure:   true,
	servicev2connect.PurchaseServicePurchaseEmployeeFetchProcedure: true,
	// Выгрузка теста в .rtf только читает.
	serviceconnect.TestServiceTestExportProcedure: true,
}

// ActionOf — какое действие у процедуры "/pkg.Service/Method": методы
// ...Fetch и ...ByID и процедуры из readProcedures только читают, остальные меняют.
func ActionOf(procedure string) Action {
	if readProcedures[procedure] {
		return ActionFetch
	}
	method := procedure[strings.LastIndex(procedure, "/")+1:]
	if strings.HasSuffix(method, "Fetch") || strings.HasSuffix(method, "ByID") {
		return ActionFetch
	}
	return ActionPost
}

// RequireSectionHTTP — для прокси: раздел целиком, действие по методу в пути.
func RequireSectionHTTP(next http.Handler, section Section) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if !u.Can(section, ActionOf(r.URL.Path)) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
