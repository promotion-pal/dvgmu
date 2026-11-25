package schedula

import (
	"net/http"

	"connectrpc.com/connect"

	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/proxy"
	"fesmu/contract/schedula/service/serviceconnect"
)

type Module struct {
	url   string
	token string
	auth  *auth.Interceptor
}

func New(url, token string, interceptor *auth.Interceptor) *Module {
	return &Module{url: url, token: token, auth: interceptor}
}

func (m *Module) Mount(mux *http.ServeMux, _ ...connect.HandlerOption) []string {
	if m.url == "" || m.token == "" {
		return nil
	}
	upstream := proxy.NewServicePassthrough(m.url)
	forward := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r = r.Clone(r.Context())
		r.Header.Del("X-Schedula-User")
		r.Header.Del("Cookie")
		r.Header.Set("Authorization", "Bearer "+m.token)
		if user, ok := auth.UserFromContext(r.Context()); ok {
			w.Header().Set("Cache-Control", "private, no-store")
			r.Header.Set("X-Schedula-User", user.UUID)
		}
		upstream.ServeHTTP(w, r)
	})

	mux.Handle(serviceconnect.SchedulaServicePublicScheduleFetchProcedure, forward)
	if m.auth != nil {
		mux.Handle("/"+serviceconnect.SchedulaServiceName+"/", m.auth.HTTPMiddleware(forward))
	}
	return []string{serviceconnect.SchedulaServiceName}
}
