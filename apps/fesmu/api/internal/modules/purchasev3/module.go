package purchasev3

import (
	"log/slog"
	"net/http"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	serviceconnect "fesmu/contract/fesmu/service/v3/servicev3connect"
	"dvgmu/api/internal/modules/purchase"
)

// Module is the purchase v3 module's public face: build it with New and
// attach it to a mux with Mount.
type Module struct {
	service *Service
}

// New builds the module over purchase_db and MDM profiles (nil — users have
// no department). With db nil the module still mounts, but every call
// answers Unavailable.
func New(log *slog.Logger, db *gorm.DB, profiles purchase.Profiles) *Module {
	log = log.With(slog.String("module", "purchase_v3"))
	var store *storage
	if db != nil {
		store = &storage{db: db}
	}
	return &Module{service: newService(log, store, profiles)}
}

// Mount registers the RPC handler on mux and reports the service names it
// serves, so the host can list them for reflection.
func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewPurchaseServiceHandler(&handler{service: m.service}, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.PurchaseServiceName}
}
