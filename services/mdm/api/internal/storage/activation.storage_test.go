package storage

import (
	"context"
	"errors"
	"testing"
	"time"

	"dvgmu/api/contract/gen/go/enum"
	"dvgmu/api/internal/domain/models"
)

func TestActivationCheck(t *testing.T) {
	db := testDB(t)
	users := UserStorageNew(db)
	s := ActivationStorageNew(db)
	ctx := context.Background()

	login := "Petrov_II"
	id, err := users.UserCreate(ctx, &models.User{FirstName: "Иван", LastName: "Петров", Email: "petrov_ii@fesmu.ru", Username: &login, Status: enum.UserStatus_USER_STATUS_ACTIVE})
	if err != nil {
		t.Fatal(err)
	}
	right := func(h string) bool { return h == "hash-1" }
	wrong := func(string) bool { return false }

	if err := s.ActivationIssue(ctx, id, "hash-1", time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	// Логин без учёта регистра; Verify код не гасит.
	if u, err := s.ActivationCheck(ctx, "petrov_ii", right, false); err != nil || u.ID != id {
		t.Fatalf("verify: %v %v", u, err)
	}
	if _, err := s.ActivationCheck(ctx, "nobody", right, false); !errors.Is(err, models.ErrActivationInvalid) {
		t.Fatalf("unknown login: %v", err)
	}

	// Неверные попытки копятся, на пятой — блок, даже для верного кода.
	for range models.ActivationMaxAttempts {
		if _, err := s.ActivationCheck(ctx, login, wrong, false); !errors.Is(err, models.ErrActivationInvalid) {
			t.Fatalf("wrong code: %v", err)
		}
	}
	if _, err := s.ActivationCheck(ctx, login, right, true); !errors.Is(err, models.ErrActivationLocked) {
		t.Fatalf("after %d misses: %v", models.ActivationMaxAttempts, err)
	}

	// Новый код заменяет заблокированный; погашенный второй раз не работает.
	if err := s.ActivationIssue(ctx, id, "hash-1", time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ActivationCheck(ctx, login, right, true); err != nil {
		t.Fatalf("consume: %v", err)
	}
	if _, err := s.ActivationCheck(ctx, login, right, true); !errors.Is(err, models.ErrActivationInvalid) {
		t.Fatalf("reuse after consume: %v", err)
	}

	// Истёкший.
	if err := s.ActivationIssue(ctx, id, "hash-1", time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ActivationCheck(ctx, login, right, true); !errors.Is(err, models.ErrActivationInvalid) {
		t.Fatalf("expired: %v", err)
	}
}
