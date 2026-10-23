package library

import (
	"errors"
	"fmt"
)

var (
	// ErrUnavailable: library_db is not reachable, so the module is mounted
	// but cannot answer.
	ErrUnavailable = errors.New("база библиотеки недоступна")
	ErrNotFound    = errors.New("не найдено")
	// ErrInvalid: the request's fields are malformed; the message says how.
	ErrInvalid   = errors.New("неверный запрос")
	ErrForbidden = errors.New("недостаточно прав")
	// ErrFiles: the files service did not store or return a file.
	ErrFiles = errors.New("сервис файлов недоступен")
)

// libError is one of the kinds above with a message for the person on the
// page: Error() is the message alone, errors.Is matches the kind.
type libError struct {
	kind error
	msg  string
}

func (e *libError) Error() string        { return e.msg }
func (e *libError) Is(target error) bool { return target == e.kind }

func newError(kind error, format string, args ...any) error {
	return &libError{kind: kind, msg: fmt.Sprintf(format, args...)}
}

func invalid(format string, args ...any) error   { return newError(ErrInvalid, format, args...) }
func forbidden(format string, args ...any) error { return newError(ErrForbidden, format, args...) }
func notFound(msg string) error                  { return newError(ErrNotFound, "%s", msg) }
