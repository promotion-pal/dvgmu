package library

import (
	"log/slog"
	"net/http"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	serviceconnect "dvgmu/api/contract/gen/go/service/v2/servicev2connect"
)

// Module is the library module's public face: build it with New and attach
// it to a mux with Mount.
type Module struct {
	service *Service
}

// New builds the module over library_db and the files service. With db nil
// (the database is unreachable) the module still mounts, but every call
// answers Unavailable — the rest of the api keeps working.
func New(log *slog.Logger, db *gorm.DB, files Files) *Module {
	log = log.With(slog.String("module", "library"))
	var store *storage
	if db != nil {
		store = &storage{db: db}
	}
	return &Module{service: newService(log, store, files)}
}

// Mount registers the RPC handler on mux and reports the service names it
// serves, so the host can list them for reflection.
func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewLibraryServiceHandler(&handler{service: m.service}, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.LibraryServiceName}
}
