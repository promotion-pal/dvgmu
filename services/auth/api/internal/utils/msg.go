package utils

import "errors"

var (
	ErrIdentityNotFound  = errors.New("identity not found in directory")
	ErrDirectoryDisabled = errors.New("identity directory is not configured")
	ErrInvalidLink       = errors.New("invalid mdm/ad link")

	ErrInvalidCredentials = errors.New("invalid login or password")
	ErrInvalidToken       = errors.New("invalid or expired token")
	// ErrNotLinked — вход через AD прошёл, но учётка не связана с MDM:
	// Yandex 360 пускаем, токенов fesmu не выдаём.
	ErrNotLinked = errors.New("account is not linked to MDM")
)
