package purchase

import (
	"errors"
	"fmt"
)

var (
	// ErrUnavailable: purchase_db is not reachable, so the module is mounted
	// but cannot answer.
	ErrUnavailable = errors.New("база закупок недоступна")
	ErrNotFound    = errors.New("не найдено")
	// ErrInvalid: the request's fields are malformed; the message says how.
	ErrInvalid = errors.New("неверный запрос")
	// ErrForbidden: the acting role may not do this.
	ErrForbidden = errors.New("недостаточно прав")
	// ErrState: the record is at a stage where this is not possible.
	ErrState = errors.New("неподходящий этап")
)

// flowError is one of the kinds above with a message for the person on the
// page: Error() is the message alone, errors.Is matches the kind.
type flowError struct {
	kind error
	msg  string
}

func (e *flowError) Error() string        { return e.msg }
func (e *flowError) Is(target error) bool { return target == e.kind }

func newError(kind error, format string, args ...any) error {
	return &flowError{kind: kind, msg: fmt.Sprintf(format, args...)}
}

func invalid(format string, args ...any) error    { return newError(ErrInvalid, format, args...) }
func forbidden(format string, args ...any) error  { return newError(ErrForbidden, format, args...) }
func wrongState(format string, args ...any) error { return newError(ErrState, format, args...) }
func notFound(msg string) error                   { return newError(ErrNotFound, "%s", msg) }
