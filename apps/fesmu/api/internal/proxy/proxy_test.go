package proxy_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dvgmu/api/internal/proxy"
)

// TestNewServicePassthrough_StripsUpstreamCORS guards against a real
// incident: the upstream (mdm) sets its own Access-Control-Allow-Origin,
// and httputil.ReverseProxy copies response headers with Header.Add, so
// without stripping, the browser sees two values on one header
// ("https://core.fesmu.ru, *") and rejects the response outright.
func TestNewServicePassthrough_StripsUpstreamCORS(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Vary", "Origin")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"users":[]}`))
	}))
	defer upstream.Close()

	mux := http.NewServeMux()
	mux.Handle("/", proxy.NewServicePassthrough(upstream.URL))

	// Mimic the api's own cors.Handler middleware, which wraps the mux in
	// production and sets Access-Control-Allow-Origin before the request
	// reaches the proxy.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://core.fesmu.ru")
		mux.ServeHTTP(w, r)
	})

	req := httptest.NewRequest(http.MethodPost, "/contract.service.UserService/UserFetch", strings.NewReader("{}"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	got := rec.Header().Values("Access-Control-Allow-Origin")
	if len(got) != 1 || got[0] != "https://core.fesmu.ru" {
		t.Fatalf("Access-Control-Allow-Origin = %v, want exactly [\"https://core.fesmu.ru\"]", got)
	}
	if v := rec.Header().Get("Vary"); v != "" {
		t.Fatalf("Vary = %q, want empty (upstream's should be stripped)", v)
	}
}

// TestWithBearer guards the auth passthrough: the internal token must reach
// only the listed procedures, and a caller's own Authorization never does.
func TestWithBearer(t *testing.T) {
	var got string
	next := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("Authorization")
	})
	h := proxy.WithBearer(next, "secret", "/svc/Read")

	for path, want := range map[string]string{"/svc/Read": "Bearer secret", "/svc/Write": ""} {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.Header.Set("Authorization", "Bearer user")
		h.ServeHTTP(httptest.NewRecorder(), req)
		if got != want {
			t.Errorf("%s: Authorization = %q, want %q", path, got, want)
		}
	}
}

func TestAllowProcedures(t *testing.T) {
	var hit bool
	next := http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) { hit = true })
	h := proxy.AllowProcedures(next, "/svc/Read")

	for path, want := range map[string]int{"/svc/Read": http.StatusOK, "/svc/Write": http.StatusNotFound} {
		hit = false
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, nil))
		if rec.Code != want || hit != (want == http.StatusOK) {
			t.Errorf("%s: code %d hit %v, want %d", path, rec.Code, hit, want)
		}
	}
}
