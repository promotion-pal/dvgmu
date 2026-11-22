package gateway

import (
	"errors"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"fesmu/contract/auth/token"
)

type Config struct {
	Port           string
	AuthURL        string
	MDMURL         string
	TicketsURL     string
	JWTSecret      string
	JWTIssuer      string
	AllowedOrigins []string
	SharedSecret   string
}

type Gateway struct {
	config  Config
	log     *slog.Logger
	Port    string
	proxies map[string]http.Handler
}

func New(config Config, log *slog.Logger) (*Gateway, error) {
	if len(config.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET must contain at least 32 bytes")
	}
	if len(config.SharedSecret) < 32 {
		return nil, errors.New("GATEWAY_SHARED_SECRET must contain at least 32 bytes")
	}
	if config.JWTIssuer == "" {
		return nil, errors.New("JWT_ISSUER is required")
	}
	proxies := map[string]http.Handler{}
	for prefix, target := range map[string]string{
		"/auth/":        config.AuthURL,
		"/api/mdm/":     config.MDMURL,
		"/api/tickets/": config.TicketsURL,
	} {
		proxy, err := newProxy(prefix, target)
		if err != nil {
			return nil, err
		}
		proxies[prefix] = proxy
	}
	return &Gateway{config: config, log: log, Port: config.Port, proxies: proxies}, nil
}

func (g *Gateway) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	for prefix, proxy := range g.proxies {
		mux.Handle(prefix, g.authenticate(prefix, proxy))
	}
	return g.cors(mux)
}

func (g *Gateway) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && !slices.Contains(g.config.AllowedOrigins, origin) {
			http.Error(w, "origin is not allowed", http.StatusForbidden)
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, Grpc-Timeout, X-Grpc-Web, X-User-Agent")
			w.Header().Set("Access-Control-Expose-Headers", "Grpc-Status, Grpc-Message, Grpc-Status-Details-Bin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (g *Gateway) authenticate(prefix string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if prefix == "/auth/" && isPublicAuthRoute(r) {
			next.ServeHTTP(w, r)
			return
		}
		cookie, err := r.Cookie(token.AccessTokenCookieName)
		if err != nil {
			http.Error(w, "authentication cookie is required", http.StatusUnauthorized)
			return
		}
		claims, err := token.Verify(cookie.Value, []byte(g.config.JWTSecret), g.config.JWTIssuer, time.Now())
		if err != nil {
			http.Error(w, "invalid or expired authentication cookie", http.StatusUnauthorized)
			return
		}
		for _, key := range []string{"X-Authenticated-User-ID", "X-Authenticated-User-UUID", "X-Authenticated-Roles", "X-Authenticated-Permissions", "X-Gateway-Secret"} {
			r.Header.Del(key)
		}
		r.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(claims.UserID, 10))
		r.Header.Set("X-Authenticated-User-UUID", claims.Subject)
		r.Header.Set("X-Authenticated-Roles", strings.Join(claims.Roles, ","))
		r.Header.Set("X-Authenticated-Permissions", strings.Join(claims.Permissions, ","))
		r.Header.Set("X-Gateway-Secret", g.config.SharedSecret)
		r.Header.Del("Authorization")
		if prefix != "/auth/" {
			r.Header.Del("Cookie")
		}
		next.ServeHTTP(w, r)
	})
}

func isPublicAuthRoute(r *http.Request) bool {
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/auth/v1/auth/token":
		return true
	case r.Method == http.MethodGet && r.URL.Path == "/auth/v1/auth/session":
		return true
	case r.Method == http.MethodPost && r.URL.Path == "/auth/v1/auth/logout":
		return true
	default:
		return false
	}
}

func newProxy(prefix, rawTarget string) (http.Handler, error) {
	target, err := url.Parse(rawTarget)
	if err != nil || target.Scheme == "" || target.Host == "" {
		return nil, errors.New("invalid upstream URL for " + prefix)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.URL.Path = "/" + strings.TrimPrefix(strings.TrimPrefix(request.URL.Path, prefix), "/")
		request.URL.RawPath = ""
		request.Host = target.Host
	}
	return proxy, nil
}
