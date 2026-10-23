// Package proxy provides a transparent, codec-agnostic passthrough for
// Connect/gRPC-JSON packages this api module doesn't implement itself
// (mdm, tasks, ...). It forwards requests to the upstream service
// byte-for-byte instead of decoding/re-encoding each RPC through a
// generated Go client and a hand-written handler.
//
// This trades type safety and a place to hook business logic for far
// less code: adding a method to the upstream service needs no change
// here at all. If a specific route ever needs validation, caching, or
// aggregation, register a typed Connect handler for just that path
// ahead of the passthrough instead of routing it through here.
package proxy

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// NewServicePassthrough forwards every request under a Connect service's
// path prefix straight to upstreamBaseURL, unmodified. If upstreamBaseURL
// is empty (the package isn't configured) or invalid, it returns a stub
// that always answers with a Connect-shaped "unavailable" error instead —
// same response contract either way, so callers (and the frontend's
// error UI) don't need to know whether a given package is wired up.
func NewServicePassthrough(upstreamBaseURL string) http.Handler {
	if upstreamBaseURL == "" {
		return unavailableHandler(errors.New("package is not configured: base URL is empty"))
	}

	target, err := url.Parse(upstreamBaseURL)
	if err != nil {
		return unavailableHandler(err)
	}

	rp := httputil.NewSingleHostReverseProxy(target)
	rp.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		writeUnavailable(w, err)
	}
	rp.ModifyResponse = stripUpstreamCORSHeaders
	return rp
}

// stripUpstreamCORSHeaders removes any CORS headers the upstream service
// set on its own response. This api's cors.Handler middleware (see
// internal/app/grpc) already sets these for every request it serves,
// proxied or not; ReverseProxy copies response headers with Header.Add,
// so an upstream that also sets Access-Control-Allow-Origin ends up with
// two values on the wire (e.g. "https://core.fesmu.ru, *"), which
// browsers reject outright as an invalid header.
func stripUpstreamCORSHeaders(resp *http.Response) error {
	for _, h := range []string{
		"Access-Control-Allow-Origin",
		"Access-Control-Allow-Credentials",
		"Access-Control-Allow-Methods",
		"Access-Control-Allow-Headers",
		"Access-Control-Expose-Headers",
		"Vary",
	} {
		resp.Header.Del(h)
	}
	return nil
}

func unavailableHandler(err error) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeUnavailable(w, err)
	}
}

// writeUnavailable mimics connect.NewError(connect.CodeUnavailable, err)'s
// wire shape closely enough for existing frontend error handling
// (ConnectError parsing / CommonServiceError) to keep working unchanged.
func writeUnavailable(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusServiceUnavailable)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":    "unavailable",
		"message": "unavailable: " + err.Error(),
	})
}

// WithBearer replaces the caller's Authorization with "Bearer token" on the
// listed procedures and drops it on every other one, so an upstream that
// trusts its internal token only grants what is listed here.
func WithBearer(next http.Handler, token string, procedures ...string) http.Handler {
	allowed := make(map[string]bool, len(procedures))
	for _, p := range procedures {
		allowed[p] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r = r.Clone(r.Context())
		r.Header.Del("Authorization")
		if token != "" && allowed[r.URL.Path] {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		next.ServeHTTP(w, r)
	})
}

// AllowProcedures passes only the listed procedures to next; anything else
// under the service path gets Connect's "unimplemented" (HTTP 404), so a
// write the upstream supports can't bypass the module that owns its rules.
func AllowProcedures(next http.Handler, procedures ...string) http.Handler {
	allowed := make(map[string]bool, len(procedures))
	for _, p := range procedures {
		allowed[p] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowed[r.URL.Path] {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "unimplemented",
				"message": "procedure is not exposed: " + r.URL.Path,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}
