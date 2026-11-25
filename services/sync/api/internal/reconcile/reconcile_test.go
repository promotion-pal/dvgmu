package reconcile

import (
	"testing"

	"dvgmu/sync/internal/adldap"
	"dvgmu/sync/internal/mdmclient"
)

func findKind(t *testing.T, r Report, kind FindingKind) Finding {
	t.Helper()
	for _, f := range r.Findings {
		if f.Kind == kind {
			return f
		}
	}
	t.Fatalf("no finding of kind %s in %+v", kind, r.Findings)
	return Finding{}
}

func TestRun_LinkedAndMatching_NoFindings(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 1, FirstName: "Иван", LastName: "Иванов", Email: "ivanov@fesmu.ru", Status: statusActive, ADObjectID: "11111111-1111-1111-1111-111111111111"},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "11111111-1111-1111-1111-111111111111", Email: "ivanov@fesmu.ru", DisplayName: "Иван Иванов"},
	}

	r := Run(mdmUsers, adEntries)
	if len(r.Findings) != 0 {
		t.Fatalf("expected no findings, got %+v", r.Findings)
	}
}

func TestRun_Drift_NameMismatch(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 1, FirstName: "Иван", LastName: "Петров", Email: "ivanov@fesmu.ru", Status: statusActive, ADObjectID: "11111111-1111-1111-1111-111111111111"},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "11111111-1111-1111-1111-111111111111", Email: "ivanov@fesmu.ru", DisplayName: "Иван Иванов"},
	}

	r := Run(mdmUsers, adEntries)
	f := findKind(t, r, KindDrift)
	if f.MDMID != 1 {
		t.Fatalf("MDMID = %d, want 1", f.MDMID)
	}
}

func TestRun_MissingInAD_ActiveUserNoAccount(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 2, FirstName: "Пётр", LastName: "Сидоров", Email: "sidorov@fesmu.ru", Status: statusActive},
	}

	r := Run(mdmUsers, nil)
	findKind(t, r, KindMissingInAD)
}

func TestRun_InactiveUser_NoADAccount_NotFlaggedMissing(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 3, Email: "left@fesmu.ru", Status: statusInactive},
	}

	r := Run(mdmUsers, nil)
	if len(r.Findings) != 0 {
		t.Fatalf("inactive user with no AD account should not be flagged, got %+v", r.Findings)
	}
}

func TestRun_UnlinkedButExists_FoundByEmail(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 4, FirstName: "Мария", LastName: "Кузнецова", Email: "kuznetsova@fesmu.ru", Status: statusActive},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "22222222-2222-2222-2222-222222222222", Email: "kuznetsova@fesmu.ru", DisplayName: "Мария Кузнецова"},
	}

	r := Run(mdmUsers, adEntries)
	f := findKind(t, r, KindUnlinkedButExists)
	if f.ObjectGUID != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("unexpected object guid: %s", f.ObjectGUID)
	}
}

func TestRun_ShouldBeDisabled_InactiveButADEnabled(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 5, Email: "fired@fesmu.ru", Status: statusInactive, ADObjectID: "33333333-3333-3333-3333-333333333333"},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "33333333-3333-3333-3333-333333333333", Email: "fired@fesmu.ru", Disabled: false},
	}

	r := Run(mdmUsers, adEntries)
	findKind(t, r, KindShouldBeDisabled)
}

func TestRun_ShouldBeDisabled_AlreadyDisabled_NoFinding(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 6, Email: "fired2@fesmu.ru", Status: statusInactive, ADObjectID: "44444444-4444-4444-4444-444444444444"},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "44444444-4444-4444-4444-444444444444", Email: "fired2@fesmu.ru", Disabled: true},
	}

	r := Run(mdmUsers, adEntries)
	if len(r.Findings) != 0 {
		t.Fatalf("already-disabled account should not be flagged, got %+v", r.Findings)
	}
}

func TestRun_NotInMDM_UnmatchedADEntry(t *testing.T) {
	adEntries := []adldap.Entry{
		{ObjectGUID: "55555555-5555-5555-5555-555555555555", Email: "svc-account@fesmu.ru", DisplayName: "Service Account"},
	}

	r := Run(nil, adEntries)
	f := findKind(t, r, KindNotInMDM)
	if f.Email != "svc-account@fesmu.ru" {
		t.Fatalf("unexpected email: %s", f.Email)
	}
}

func TestRun_LinkedButADEntryGone_MatchedByEmailInstead(t *testing.T) {
	// identity указывает на guid, которого больше нет в AD, но тот же
	// пользователь находится по email — считаем найденным (не MissingInAD),
	// расхождение в связке тут не главная забота dry-run'а.
	mdmUsers := []mdmclient.User{
		{ID: 7, FirstName: "Анна", LastName: "Смирнова", Email: "smirnova@fesmu.ru", Status: statusActive, ADObjectID: "00000000-0000-0000-0000-000000000000"},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "66666666-6666-6666-6666-666666666666", Email: "smirnova@fesmu.ru", DisplayName: "Анна Смирнова"},
	}

	r := Run(mdmUsers, adEntries)
	findKind(t, r, KindUnlinkedButExists)
}

// TestRun_UnlinkedButExists_FoundBySAM_NoEmail воспроизводит живой инцидент:
// AD-запись без mail (обычное дело), но sAMAccountName совпадает с логином,
// который мы бы вывели из email MDM — раньше в этом случае человек уходил в
// missing_in_ad, а реальная попытка Create в AD падала с Constraint
// Violation ("sAMAccountName уже занят").
func TestRun_UnlinkedButExists_FoundBySAM_NoEmail(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 9, FirstName: "Анна", LastName: "Абрамович", Email: "abramovich_aa@fesmu.ru", Status: statusActive},
	}
	adEntries := []adldap.Entry{
		{ObjectGUID: "77777777-7777-7777-7777-777777777777", SAMAccountName: "abramovich_aa", Email: ""},
	}

	r := Run(mdmUsers, adEntries)
	f := findKind(t, r, KindUnlinkedButExists)
	if f.ObjectGUID != "77777777-7777-7777-7777-777777777777" {
		t.Fatalf("unexpected object guid: %s", f.ObjectGUID)
	}
}

func TestSAMAccountNameFromEmail(t *testing.T) {
	cases := map[string]string{
		"ivanov@fesmu.ru": "ivanov",
		"IVANOV@FESMU.RU": "ivanov",
		"":                "",
		"no-at-sign":      "",
		"@fesmu.ru":       "",
		// живой инцидент: 21 символ до @ — AD жёстко режет sAMAccountName
		// на 20, иначе Create падает с "Invalid argument".
		"zaykovakhelimskaya_iv@fesmu.ru": "zaykovakhelimskaya_i",
	}
	for email, want := range cases {
		if got := SAMAccountNameFromEmail(email); got != want {
			t.Errorf("SAMAccountNameFromEmail(%q) = %q, want %q", email, got, want)
		}
	}
}

func TestRun_TrulyMissing_NoLinkNoEmailMatch(t *testing.T) {
	mdmUsers := []mdmclient.User{
		{ID: 8, FirstName: "Олег", LastName: "Новиков", Email: "novikov@fesmu.ru", Status: statusActive, ADObjectID: "00000000-0000-0000-0000-000000000000"},
	}

	r := Run(mdmUsers, nil)
	findKind(t, r, KindMissingInAD)
}
