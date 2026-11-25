package auth

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"

	"connectrpc.com/connect"
	"fesmu/authsession"
)

type contextKey string

const userKey contextKey = "auth_user"

// Role names as auth puts them in the access token (set in MDM).
const (
	RoleAdmin   = "ADMIN"
	RoleStaff   = "STAFF"
	RoleTeacher = "TEACHER"
	RoleStudent = "STUDENT"
)

// User is the signed-in person behind the access token: the MDM user.
type User authsession.User

// HasRole: one of roles, or ADMIN, which passes every check.
func (u *User) HasRole(roles ...string) bool {
	for _, r := range u.Roles {
		if r == RoleAdmin || slices.Contains(roles, r) {
			return true
		}
	}
	return false
}

// Interceptor lets a Connect call through only with a valid auth access
// token in the cookie. The token is checked here, against auth's public key
// (JWKS) — no call to auth per request.
type Interceptor struct {
	verifier *authsession.Verifier
	// Skip — открытые процедуры (публичные страницы): без входа.
	Skip map[string]bool
	// Optional — открытые процедуры, которым важно, кто вошёл: сессию
	// проверяют, если она есть, но без неё (или с просроченной) пускают
	// анонимно. Что показать каждому, процедура решает сама.
	Optional map[string]bool
	// Access — какие роли пускать в сервис (ключ — полное имя сервиса).
	// nil — любого, кто вошёл; сервиса нет в карте — только ADMIN (новый
	// сервис не окажется открытым всем по забывчивости). ADMIN — везде.
	Access map[string][]string
	// Sections — разделы портала, которым принадлежит сервис: пускает роль
	// из Access ИЛИ право на любой из разделов (из доступов): чтения
	// (ActionOf) — fetch или post, остальные методы — post. Обычно раздел
	// один; несколько — когда сервис делят роли (закупки: по разделу на роль,
	// какую роль можно играть, сервис проверяет сам).
	Sections map[string][]Section
}

func NewInterceptor(keys *authsession.JWKS, issuer, audience, cookieName string) *Interceptor {
	return &Interceptor{
		verifier: authsession.NewVerifier(keys, issuer, audience, cookieName),
		Skip:     map[string]bool{},
		Optional: map[string]bool{},
		Access:   map[string][]string{},
		Sections: map[string][]Section{},
	}
}

func (i *Interceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if i.Skip[req.Spec().Procedure] {
			return next(ctx, req)
		}
		if i.Optional[req.Spec().Procedure] {
			return next(i.maybeAuthenticate(ctx, req.Header()), req)
		}
		ctx, err := i.authenticate(ctx, req.Header())
		if err != nil {
			return nil, err
		}
		if err := i.authorize(ctx, req.Spec().Procedure); err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (i *Interceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		if i.Skip[conn.Spec().Procedure] {
			return next(ctx, conn)
		}
		if i.Optional[conn.Spec().Procedure] {
			return next(i.maybeAuthenticate(ctx, conn.RequestHeader()), conn)
		}
		ctx, err := i.authenticate(ctx, conn.RequestHeader())
		if err != nil {
			return err
		}
		if err := i.authorize(ctx, conn.Spec().Procedure); err != nil {
			return err
		}
		return next(ctx, conn)
	}
}

// authorize — роль для сервиса процедуры ("/pkg.Service/Method") по Access.
func (i *Interceptor) authorize(ctx context.Context, procedure string) error {
	service, _, _ := strings.Cut(strings.TrimPrefix(procedure, "/"), "/")
	if u, ok := UserFromContext(ctx); ok {
		action := ActionOf(procedure)
		for _, section := range i.Sections[service] {
			if u.Can(section, action) {
				return nil
			}
		}
	}
	roles, listed := i.Access[service]
	if listed && roles == nil {
		return nil
	}
	if !listed {
		roles = []string{RoleAdmin}
	}
	return RequireRole(ctx, roles...)
}

func (i *Interceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		return next(ctx, spec)
	}
}

func (i *Interceptor) authenticate(ctx context.Context, header http.Header) (context.Context, error) {
	user, err := i.verifier.FromHeader(ctx, header)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	return context.WithValue(ctx, userKey, (*User)(user)), nil
}

// maybeAuthenticate adds the user to ctx when the session is valid and
// leaves ctx anonymous otherwise.
func (i *Interceptor) maybeAuthenticate(ctx context.Context, header http.Header) context.Context {
	if authed, err := i.authenticate(ctx, header); err == nil {
		return authed
	}
	return ctx
}

// Verify checks the access token: EdDSA signature by auth's key, issuer,
// audience, expiry.
func (i *Interceptor) Verify(ctx context.Context, raw string) (*User, error) {
	user, err := i.verifier.Verify(ctx, raw)
	return (*User)(user), err
}

func UserFromContext(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(userKey).(*User)
	return u, ok
}

// RequireRole lets the call through only for a user holding one of roles
// (an admin holds them all).
func RequireRole(ctx context.Context, roles ...string) error {
	u, ok := UserFromContext(ctx)
	if !ok {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}
	if !u.HasRole(roles...) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("недостаточно прав"))
	}
	return nil
}

// HTTPMiddleware applies the same cookie-based authentication as
// WrapUnary, for handlers that aren't Connect-typed (e.g. a raw
// reverse-proxy passthrough to an external package service).
func (i *Interceptor) HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, err := i.authenticate(r.Context(), r.Header)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRoleHTTP wraps a handler that sits behind HTTPMiddleware: the
// listed procedures (URL paths) need one of roles, everything else passes.
func RequireRoleHTTP(next http.Handler, procedures []string, roles ...string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if slices.Contains(procedures, r.URL.Path) {
			u, ok := UserFromContext(r.Context())
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			if !u.HasRole(roles...) {
				w.WriteHeader(http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAnyRoleHTTP — как RequireRoleHTTP, но для всех путей обработчика.
func RequireAnyRoleHTTP(next http.Handler, roles ...string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if !u.HasRole(roles...) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// WithUser кладёт пользователя в контекст так же, как интерцептор (для
// тестов и внутренних вызовов).
func WithUser(ctx context.Context, u *User) context.Context {
	return context.WithValue(ctx, userKey, u)
}
