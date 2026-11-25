package service

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"dvgmu/api/internal/domain/models"
)

type ActivationStore interface {
	ActivationIssue(ctx context.Context, userID int64, codeHash string, expiresAt time.Time) error
	ActivationCheck(ctx context.Context, username string, match func(codeHash string) bool, consume bool) (*models.User, error)
}

// ActivationService — коды активации новых учёток (выдаёт админ в fesmu,
// проверяет и гасит auth при задании пароля).
type ActivationService struct {
	log   *slog.Logger
	users UserProvider
	store ActivationStore
}

func NewActivationService(log *slog.Logger, users UserProvider, store ActivationStore) *ActivationService {
	return &ActivationService{log: log, users: users, store: store}
}

// Issue выдаёт новый код (прежний перестаёт действовать). Открытый код
// возвращается один раз — в БД только хеш.
func (s *ActivationService) Issue(ctx context.Context, userID int64) (string, time.Time, error) {
	user, err := s.users.UserByID(ctx, userID)
	if err != nil {
		return "", time.Time{}, err
	}
	if user.Username == nil || strings.TrimSpace(*user.Username) == "" {
		return "", time.Time{}, models.ErrNoUsername
	}

	code, err := models.GenActivationCode()
	if err != nil {
		return "", time.Time{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(models.NormalizeActivationCode(code)), bcrypt.DefaultCost)
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().Add(models.ActivationTTL)
	if err := s.store.ActivationIssue(ctx, userID, string(hash), expiresAt); err != nil {
		return "", time.Time{}, err
	}

	s.log.Info("activation code issued", slog.Int64("user_id", userID))
	return code, expiresAt, nil
}

// Verify — код верен (не гасит); Consume — верен и погашен.
func (s *ActivationService) Verify(ctx context.Context, username, code string) (*models.User, error) {
	return s.check(ctx, username, code, false)
}

func (s *ActivationService) Consume(ctx context.Context, username, code string) (*models.User, error) {
	return s.check(ctx, username, code, true)
}

func (s *ActivationService) check(ctx context.Context, username, code string, consume bool) (*models.User, error) {
	normalized := []byte(models.NormalizeActivationCode(code))
	return s.store.ActivationCheck(ctx, username, func(hash string) bool {
		return bcrypt.CompareHashAndPassword([]byte(hash), normalized) == nil
	}, consume)
}
