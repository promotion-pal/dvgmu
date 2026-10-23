package debtor

import (
	"log/slog"
	"net/http"

	"connectrpc.com/connect"

	serviceconnect "fesmu/contract/fesmu/service/v1/servicev1connect"
	onec "dvgmu/api/internal/utils/1c"
)

// Module is the debtor module's public face: build it with New and attach it
// to a mux with Mount.
type Module struct {
	log     *slog.Logger
	service *Service
}

// New builds the module over a 1C config. Without 1C credentials the module
// still mounts, but every call answers FailedPrecondition — the rest of the
// api keeps working.
func New(log *slog.Logger, cfg onec.Config) *Module {
	log = log.With(slog.String("module", "debtor"))

	var source Source
	if s, err := newSource(cfg); err != nil {
		log.Warn("debtor module disabled: 1C is not configured", "error", err.Error())
	} else {
		source = s
		// Без самих секретов: только что именно пришло из ENV, для диагностики входа.
		log.Info("debtor module reads 1C", "host", cfg.HostAddr, "host_user", cfg.HostUser,
			"sql_server", cfg.SQLServer, "sql_user", cfg.SQLUser, "sql_password_len", len([]rune(cfg.SQLPass)), "db", cfg.DB)
	}

	return &Module{log: log, service: newService(log, source, cfg.DB)}
}

// Mount registers the RPC handler on mux and reports the service names it
// serves, so the host can list them for reflection.
func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewDebtorServiceHandler(&handler{service: m.service}, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.DebtorServiceName}
}

// Service exposes the use cases for callers in the same process.
func (m *Module) Service() *Service { return m.service }

func newSource(cfg onec.Config) (Source, error) {
	schema, err := onec.SchemaFor(cfg.DB)
	if err != nil {
		return nil, err
	}
	c, err := onec.New(cfg)
	if err != nil {
		return nil, err
	}
	return onec.NewAccounting(c, schema), nil
}
