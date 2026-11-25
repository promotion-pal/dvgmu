package models

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"
)

var (
	// ErrActivationInvalid — нет действующего кода, он истёк или не совпал.
	// Для auth один ответ на все случаи: не подсказываем, что именно не так.
	ErrActivationInvalid = errors.New("activation code is invalid or expired")
	// ErrActivationLocked — исчерпаны попытки, нужен новый код.
	ErrActivationLocked = errors.New("too many attempts, ask for a new activation code")
	// ErrNoUsername — без логина AD активировать нечего.
	ErrNoUsername = errors.New("user has no username")
)

const (
	ActivationTTL         = 14 * 24 * time.Hour
	ActivationMaxAttempts = 5

	// Без похожих 0/O, 1/I/L, 5/S, 8/B: код диктуют и переписывают с бумаги.
	activationAlphabet = "2345679ACDEFGHJKMNPQRTUVWXYZ"
	activationLen      = 8
)

type ActivationCode struct {
	ID        int64 `gorm:"primaryKey;autoIncrement"`
	UserID    int64 `gorm:"not null"`
	CodeHash  string
	ExpiresAt time.Time
	Attempts  int16
	UsedAt    *time.Time
	CreatedAt time.Time
}

func (ActivationCode) TableName() string { return "activation_codes" }

// GenActivationCode — "XXXX-XXXX" из activationAlphabet (~38 бит).
func GenActivationCode() (string, error) {
	var b strings.Builder
	for i := range activationLen {
		if i == activationLen/2 {
			b.WriteByte('-')
		}
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(activationAlphabet))))
		if err != nil {
			return "", err
		}
		b.WriteByte(activationAlphabet[n.Int64()])
	}
	return b.String(), nil
}

// NormalizeActivationCode — регистр, пробелы и дефисы не важны.
func NormalizeActivationCode(code string) string {
	code = strings.ToUpper(code)
	return strings.Map(func(r rune) rune {
		if r == '-' || r == ' ' || r == '\t' {
			return -1
		}
		return r
	}, code)
}
