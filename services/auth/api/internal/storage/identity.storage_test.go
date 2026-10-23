package storage

import (
	"context"
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

func identityTestStore(t *testing.T) *IdentityStorage {
	t.Helper()
	dsn := os.Getenv("AUTH_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("set AUTH_TEST_DB_DSN to run identity storage tests")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	s := IdentityStorageNew(db, nil)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Exec("TRUNCATE identities").Error; err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return s
}

func TestIdentityStorage_LoginThenLinkMDMBatch(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	guid := "11111111-1111-1111-1111-111111111111"

	if err := s.IdentityUpsertLogin(ctx, guid, "ivanov", "ivanov@fesmu.ru"); err != nil {
		t.Fatalf("UpsertLogin: %v", err)
	}
	got, err := s.IdentityByGUID(ctx, guid)
	if err != nil || got.Email != "ivanov@fesmu.ru" || got.MDMID != 0 {
		t.Fatalf("after login: %+v err %v", got, err)
	}

	if err := s.IdentityLinkMDMBatch(ctx, []models.MDMLink{{MDMID: 501, ObjectGUID: guid}}); err != nil {
		t.Fatalf("LinkMDMBatch: %v", err)
	}
	got, _ = s.IdentityByGUID(ctx, guid)
	if got.MDMID != 501 {
		t.Fatalf("mdm_id not linked: %+v", got)
	}

	if err := s.IdentityUpsertLogin(ctx, guid, "ivanov", "i.ivanov@fesmu.ru"); err != nil {
		t.Fatalf("UpsertLogin 2: %v", err)
	}
	got, _ = s.IdentityByGUID(ctx, guid)
	if got.Email != "i.ivanov@fesmu.ru" || got.MDMID != 501 {
		t.Fatalf("login must refresh email but keep mdm_id: %+v", got)
	}
}

func TestIdentityStorage_LinkMDMBatch_WithoutPriorLogin_CreatesRow(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	guid := "44444444-4444-4444-4444-444444444444"

	if err := s.IdentityLinkMDMBatch(ctx, []models.MDMLink{{MDMID: 777, ObjectGUID: guid}}); err != nil {
		t.Fatalf("LinkMDMBatch without prior login: %v", err)
	}

	got, err := s.IdentityByGUID(ctx, guid)
	if err != nil {
		t.Fatalf("ByGUID after LinkMDMBatch: %v", err)
	}
	if got.MDMID != 777 {
		t.Fatalf("MDMID = %d, want 777", got.MDMID)
	}
	if got.Email != "" {
		t.Fatalf("Email = %q, want empty until real login happens", got.Email)
	}
}

func TestIdentityStorage_ByLogin(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	guid := "55555555-5555-5555-5555-555555555555"

	if err := s.IdentityUpsertLogin(ctx, guid, "ivanov", "ivanov@fesmu.ru"); err != nil {
		t.Fatalf("UpsertLogin: %v", err)
	}

	got, err := s.IdentityByLogin(ctx, "ivanov")
	if err != nil || got.ObjectGUID != guid {
		t.Fatalf("ByLogin: got %+v err %v", got, err)
	}

	if _, err := s.IdentityByLogin(ctx, "unknown"); err != utils.ErrIdentityNotFound {
		t.Fatalf("got %v, want ErrIdentityNotFound", err)
	}
}

func TestIdentityStorage_ByGUID_NotFound(t *testing.T) {
	s := identityTestStore(t)
	_, err := s.IdentityByGUID(context.Background(), "does-not-exist")
	if err != utils.ErrIdentityNotFound {
		t.Fatalf("got %v, want ErrIdentityNotFound", err)
	}
}

func TestIdentityStorage_LinkMDMBatch(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	g1 := "22222222-2222-2222-2222-222222222222"
	g2 := "33333333-3333-3333-3333-333333333333"

	if err := s.IdentityUpsertLogin(ctx, g1, "one", "one@fesmu.ru"); err != nil {
		t.Fatalf("seed: %v", err)
	}

	err := s.IdentityLinkMDMBatch(ctx, []models.MDMLink{
		{MDMID: 1, ObjectGUID: g1},
		{MDMID: 2, ObjectGUID: g2},
		{MDMID: 3, ObjectGUID: g2},
	})
	if err != nil {
		t.Fatalf("LinkMDMBatch: %v", err)
	}

	got1, err := s.IdentityByGUID(ctx, g1)
	if err != nil || got1.MDMID != 1 || got1.Email != "one@fesmu.ru" {
		t.Fatalf("g1 = %+v err %v, want mdm_id=1 and email preserved", got1, err)
	}
	got2, err := s.IdentityByGUID(ctx, g2)
	if err != nil || got2.MDMID != 3 {
		t.Fatalf("g2 = %+v err %v, want last duplicate to win (mdm_id=3)", got2, err)
	}
}

func TestIdentityStorage_LinkMDMBatch_InvalidRejectsWholeBatch(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	good := "22222222-2222-2222-2222-222222222222"

	err := s.IdentityLinkMDMBatch(ctx, []models.MDMLink{
		{MDMID: 1, ObjectGUID: good},
		{MDMID: 2, ObjectGUID: "not-a-guid"},
	})
	if err != utils.ErrInvalidLink {
		t.Fatalf("got %v, want ErrInvalidLink", err)
	}
	if _, err := s.IdentityByGUID(ctx, good); err != utils.ErrIdentityNotFound {
		t.Fatalf("valid row of a rejected batch must not be written, got err %v", err)
	}
}

func TestIdentityStorage_IdentityByID(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	guid := "66666666-6666-6666-6666-666666666666"

	if err := s.IdentityUpsertLogin(ctx, guid, "petrov", "petrov@fesmu.ru"); err != nil {
		t.Fatalf("seed: %v", err)
	}
	seeded, _ := s.IdentityByGUID(ctx, guid)

	got, err := s.IdentityByID(ctx, seeded.ID)
	if err != nil || got.ObjectGUID != guid {
		t.Fatalf("IdentityByID: got %+v err %v", got, err)
	}
	if _, err := s.IdentityByID(ctx, seeded.ID+1000); err != utils.ErrIdentityNotFound {
		t.Fatalf("got %v, want ErrIdentityNotFound", err)
	}
}

func TestIdentityStorage_IdentityFetch(t *testing.T) {
	s := identityTestStore(t)
	ctx := context.Background()
	seed := []struct{ guid, login, email string }{
		{"a0000000-0000-0000-0000-000000000001", "ivanov", "ivanov@fesmu.ru"},
		{"a0000000-0000-0000-0000-000000000002", "petrov", "petrov@fesmu.ru"},
		{"a0000000-0000-0000-0000-000000000003", "sidorov", "sidorov@mail.ru"},
		{"a0000000-0000-0000-0000-000000000004", "iv_anov", "x@fesmu.ru"},
	}
	for _, r := range seed {
		if err := s.IdentityUpsertLogin(ctx, r.guid, r.login, r.email); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	if err := s.IdentityLinkMDMBatch(ctx, []models.MDMLink{{MDMID: 42, ObjectGUID: seed[1].guid}}); err != nil {
		t.Fatalf("link: %v", err)
	}

	linked := true
	unlinked := false
	cases := []struct {
		name      string
		filter    models.IdentityFilter
		wantTotal int64
		wantRows  int
	}{
		{"all, first page", models.IdentityFilter{Page: 1, PageSize: 3}, 4, 3},
		{"all, second page", models.IdentityFilter{Page: 2, PageSize: 3}, 4, 1},
		{"email substring, case-insensitive", models.IdentityFilter{Email: "FESMU", Page: 1, PageSize: 50}, 3, 3},
		{"login underscore is literal", models.IdentityFilter{Login: "iv_", Page: 1, PageSize: 50}, 1, 1},
		{"mdm_id", models.IdentityFilter{MDMID: 42, Page: 1, PageSize: 50}, 1, 1},
		{"object_guid", models.IdentityFilter{ObjectGUID: seed[2].guid, Page: 1, PageSize: 50}, 1, 1},
		{"bad object_guid", models.IdentityFilter{ObjectGUID: "nope", Page: 1, PageSize: 50}, 0, 0},
		{"linked", models.IdentityFilter{Linked: &linked, Page: 1, PageSize: 50}, 1, 1},
		{"unlinked", models.IdentityFilter{Linked: &unlinked, Page: 1, PageSize: 50}, 3, 3},
	}
	for _, c := range cases {
		rows, total, err := s.IdentityFetch(ctx, c.filter)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if total != c.wantTotal || len(rows) != c.wantRows {
			t.Errorf("%s: total=%d rows=%d, want total=%d rows=%d", c.name, total, len(rows), c.wantTotal, c.wantRows)
		}
	}
}
