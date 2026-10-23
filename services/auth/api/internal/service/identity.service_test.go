package service

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

type fakeIdentityRepo struct {
	rows map[string]models.Identity

	lastFilter models.IdentityFilter
}

func newFakeIdentityRepo() *fakeIdentityRepo {
	return &fakeIdentityRepo{rows: map[string]models.Identity{}}
}

func (r *fakeIdentityRepo) IdentityUpsertLogin(_ context.Context, guid, login, email string) error {
	cur := r.rows[guid]
	cur.ObjectGUID, cur.Login, cur.Email = guid, login, email
	r.rows[guid] = cur
	return nil
}

func (r *fakeIdentityRepo) IdentityByGUID(_ context.Context, guid string) (*models.Identity, error) {
	if v, ok := r.rows[guid]; ok {
		return &v, nil
	}
	return nil, utils.ErrIdentityNotFound
}

func (r *fakeIdentityRepo) IdentityByLogin(_ context.Context, login string) (*models.Identity, error) {
	for _, v := range r.rows {
		if v.Login == login {
			cp := v
			return &cp, nil
		}
	}
	return nil, utils.ErrIdentityNotFound
}

func (r *fakeIdentityRepo) IdentityLinkMDMBatch(_ context.Context, links []models.MDMLink) error {
	for _, l := range links {
		cur := r.rows[l.ObjectGUID]
		cur.ObjectGUID, cur.MDMID = l.ObjectGUID, l.MDMID
		r.rows[l.ObjectGUID] = cur
	}
	return nil
}

func (r *fakeIdentityRepo) IdentityByID(_ context.Context, id int64) (*models.Identity, error) {
	for _, v := range r.rows {
		if v.ID == id {
			cp := v
			return &cp, nil
		}
	}
	return nil, utils.ErrIdentityNotFound
}

func (r *fakeIdentityRepo) IdentityFetch(_ context.Context, filter models.IdentityFilter) ([]*models.Identity, int64, error) {
	r.lastFilter = filter
	return nil, 0, nil
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func TestIdentity_RecordLoginKeepsMDMLink(t *testing.T) {
	repo := newFakeIdentityRepo()
	svc := NewIdentityService(quiet(), repo, repo)

	if err := svc.LinkMDMBatch(context.Background(), []models.MDMLink{{MDMID: 501, ObjectGUID: "g1"}}); err != nil {
		t.Fatalf("LinkMDMBatch: %v", err)
	}
	if err := svc.RecordLogin(context.Background(), "g1", "ivanov", "old@fesmu.ru"); err != nil {
		t.Fatalf("RecordLogin: %v", err)
	}
	if err := svc.RecordLogin(context.Background(), "g1", "ivanov", "new@fesmu.ru"); err != nil {
		t.Fatalf("RecordLogin 2: %v", err)
	}

	got, err := repo.IdentityByGUID(context.Background(), "g1")
	if err != nil {
		t.Fatalf("ByGUID: %v", err)
	}
	if got.Email != "new@fesmu.ru" {
		t.Errorf("email = %q, want refreshed value", got.Email)
	}
	if got.MDMID != 501 {
		t.Errorf("mdm_id = %d, want preserved 501 (login must not clobber MDM link)", got.MDMID)
	}
}

func TestIdentity_MDMIDFor(t *testing.T) {
	repo := newFakeIdentityRepo()
	repo.rows["linked"] = models.Identity{ObjectGUID: "linked", MDMID: 777}
	svc := NewIdentityService(quiet(), repo, repo)

	got, err := svc.MDMIDFor(context.Background(), "linked")
	if err != nil || got != 777 {
		t.Fatalf("linked: got %d, err %v", got, err)
	}

	got, err = svc.MDMIDFor(context.Background(), "never-seen")
	if err != nil || got != 0 {
		t.Fatalf("unlinked: got %d, err %v, want (0, nil)", got, err)
	}
}

func TestIdentity_LinkMDMBatch(t *testing.T) {
	repo := newFakeIdentityRepo()
	svc := NewIdentityService(quiet(), repo, repo)

	err := svc.LinkMDMBatch(context.Background(), []models.MDMLink{
		{MDMID: 1, ObjectGUID: " g1 "},
		{MDMID: 2, ObjectGUID: "g2"},
	})
	if err != nil {
		t.Fatalf("LinkMDMBatch: %v", err)
	}
	if repo.rows["g1"].MDMID != 1 || repo.rows["g2"].MDMID != 2 {
		t.Fatalf("rows = %+v", repo.rows)
	}
}

func TestIdentity_ByLogin(t *testing.T) {
	repo := newFakeIdentityRepo()
	svc := NewIdentityService(quiet(), repo, repo)

	if err := svc.RecordLogin(context.Background(), "g1", "ivanov", "ivanov@fesmu.ru"); err != nil {
		t.Fatalf("RecordLogin: %v", err)
	}

	got, err := svc.ByLogin(context.Background(), "ivanov")
	if err != nil || got.ObjectGUID != "g1" {
		t.Fatalf("got %+v err %v", got, err)
	}

	if _, err := svc.ByLogin(context.Background(), "  "); err != utils.ErrIdentityNotFound {
		t.Fatalf("blank login: got %v, want ErrIdentityNotFound", err)
	}
}

func TestIdentity_LinkMDMBatch_EmptyIsInvalid(t *testing.T) {
	repo := newFakeIdentityRepo()
	svc := NewIdentityService(quiet(), repo, repo)
	if err := svc.LinkMDMBatch(context.Background(), nil); err != utils.ErrInvalidLink {
		t.Fatalf("got %v, want ErrInvalidLink", err)
	}
}

func TestIdentity_FetchNormalizesPaging(t *testing.T) {
	repo := newFakeIdentityRepo()
	svc := NewIdentityService(quiet(), repo, repo)

	cases := []struct {
		in         models.IdentityFilter
		page, size int
	}{
		{models.IdentityFilter{}, 1, identityDefaultPageSize},
		{models.IdentityFilter{Page: -3, PageSize: 10}, 1, 10},
		{models.IdentityFilter{Page: 4, PageSize: 100000}, 4, identityMaxPageSize},
	}
	for _, c := range cases {
		if _, _, err := svc.Fetch(context.Background(), c.in); err != nil {
			t.Fatalf("Fetch: %v", err)
		}
		if repo.lastFilter.Page != c.page || repo.lastFilter.PageSize != c.size {
			t.Errorf("in %+v: got page=%d size=%d, want %d/%d", c.in, repo.lastFilter.Page, repo.lastFilter.PageSize, c.page, c.size)
		}
	}

	if _, _, err := svc.Fetch(context.Background(), models.IdentityFilter{Email: "  x@fesmu.ru "}); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if repo.lastFilter.Email != "x@fesmu.ru" {
		t.Errorf("email not trimmed: %q", repo.lastFilter.Email)
	}
}

func TestIdentity_ByID(t *testing.T) {
	repo := newFakeIdentityRepo()
	repo.rows["g1"] = models.Identity{ID: 7, ObjectGUID: "g1"}
	svc := NewIdentityService(quiet(), repo, repo)

	got, err := svc.ByID(context.Background(), 7)
	if err != nil || got.ObjectGUID != "g1" {
		t.Fatalf("got %+v err %v", got, err)
	}
	if _, err := svc.ByID(context.Background(), 0); err != utils.ErrIdentityNotFound {
		t.Fatalf("id=0: got %v, want ErrIdentityNotFound", err)
	}
}
