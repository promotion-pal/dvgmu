package debtor

import (
	"errors"
	"fmt"
)

var (
	// ErrNotConfigured: the 1C credentials (ONEC_*) are not set, so the module
	// is mounted but cannot answer.
	ErrNotConfigured = errors.New("debtor: 1С не настроена (ONEC_*)")
	// ErrInvalid: the request's period is malformed; the message says how.
	ErrInvalid = errors.New("debtor: invalid request")
)

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, args...))
}
