package utils

import "testing"

func TestGenEmail_NoCollision(t *testing.T) {
	email, err := GenEmail("Коноплев", "Роман", "Романович", func(login string) (bool, error) {
		return false, nil
	})
	if err != nil {
		t.Fatalf("GenEmail: %v", err)
	}
	if email != "konoplev_rr@fesmu.ru" {
		t.Fatalf("unexpected email: %s", email)
	}
}

func TestGenEmail_EscalatesByLettersBeforeDigits(t *testing.T) {
	taken := map[string]bool{
		"konoplev_rr": true, // инициалы заняты
	}
	email, err := GenEmail("Коноплев", "Роман", "Романович", func(login string) (bool, error) {
		return taken[login], nil
	})
	if err != nil {
		t.Fatalf("GenEmail: %v", err)
	}
	if email != "konoplev_romanr@fesmu.ru" {
		t.Fatalf("expected escalation by letters, got: %s", email)
	}
}

func TestGenEmail_FallsBackToDigitsOnFullCollision(t *testing.T) {
	taken := map[string]bool{
		"konoplev_rr":               true,
		"konoplev_romanr":           true,
		"konoplev_rromanovich":      true,
		"konoplev_roman_romanovich": true,
	}
	email, err := GenEmail("Коноплев", "Роман", "Романович", func(login string) (bool, error) {
		return taken[login], nil
	})
	if err != nil {
		t.Fatalf("GenEmail: %v", err)
	}
	// Цифра дописывается к самому короткому (инициалы), а не к самому
	// длинному варианту — так короче и опрятнее.
	if email != "konoplev_rr2@fesmu.ru" {
		t.Fatalf("expected digit fallback, got: %s", email)
	}
}

func TestGenEmail_FullNamePatronymicHasUnderscore(t *testing.T) {
	taken := map[string]bool{
		"konoplev_rr":          true,
		"konoplev_romanr":      true,
		"konoplev_rromanovich": true,
	}
	email, err := GenEmail("Коноплев", "Роман", "Романович", func(login string) (bool, error) {
		return taken[login], nil
	})
	if err != nil {
		t.Fatalf("GenEmail: %v", err)
	}
	// Только в самом полном варианте (имя+отчество целиком) — подчёркивание
	// между ними, чтобы не сливались в одну нечитаемую строку.
	if email != "konoplev_roman_romanovich@fesmu.ru" {
		t.Fatalf("unexpected email: %s", email)
	}
}

func TestGenEmail_WithoutPatronymic(t *testing.T) {
	email, err := GenEmail("Иванов", "Иван", "", func(login string) (bool, error) {
		return false, nil
	})
	if err != nil {
		t.Fatalf("GenEmail: %v", err)
	}
	if email != "ivanov_i@fesmu.ru" {
		t.Fatalf("unexpected email: %s", email)
	}
}

func TestGenPassword(t *testing.T) {
	pass, err := GenPassword("Роман")
	if err != nil {
		t.Fatalf("GenPassword: %v", err)
	}
	if len(pass) != len("Roman")+passwordDigitsCount {
		t.Fatalf("unexpected password length: %s", pass)
	}
	if pass[:5] != "Roman" {
		t.Fatalf("expected password to start with capitalized translit name, got: %s", pass)
	}
}
