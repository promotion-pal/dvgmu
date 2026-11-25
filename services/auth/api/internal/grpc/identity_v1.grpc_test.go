package grpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	authv1connect "fesmu/contract/auth/v1/v1connect"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/service"
	"dvgmu/auth/internal/utils"
)

// fakeRepo — упорядоченный список identities с постраничной выдачей,
// как у IdentityStorage.IdentityFetch.
type fakeRepo struct {
	rows []models.Identity
}

func (r *fakeRepo) IdentityUpsertLogin(context.Context, string, string, string) error { return nil }

func (r *fakeRepo) IdentityLinkMDMBatch(_ context.Context, links []models.MDMLink) error {
	for _, l := range links {
		r.rows = append(r.rows, models.Identity{ID: int64(len(r.rows) + 1), MDMID: l.MDMID, ObjectGUID: l.ObjectGUID})
	}
	return nil
}

func (r *fakeRepo) IdentityFetch(_ context.Context, f models.IdentityFilter) ([]*models.Identity, int64, error) {
	out := []*models.Identity{}
	for i := (f.Page - 1) * f.PageSize; i < len(r.rows) && len(out) < f.PageSize; i++ {
		row := r.rows[i]
		out = append(out, &row)
	}
	return out, int64(len(r.rows)), nil
}

func (r *fakeRepo) IdentityByID(context.Context, int64) (*models.Identity, error) {
	return nil, utils.ErrIdentityNotFound
}

func (r *fakeRepo) IdentityByGUID(_ context.Context, guid string) (*models.Identity, error) {
	for _, row := range r.rows {
		if row.ObjectGUID == guid {
			return &row, nil
		}
	}
	return nil, utils.ErrIdentityNotFound
}

func (r *fakeRepo) IdentityByLogin(context.Context, string) (*models.Identity, error) {
	return nil, utils.ErrIdentityNotFound
}

func newV1Server(t *testing.T, repo *fakeRepo) *httptest.Server {
	t.Helper()
	svc := service.NewIdentityService(slog.New(slog.NewTextHandler(io.Discard, nil)), repo, repo)
	path, h := authv1connect.NewIdentityServiceHandler(IdentityV1NewController(svc, "secret"))
	mux := http.NewServeMux()
	mux.Handle(path, h)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// post шлёт Connect JSON ровно так, как это делает services/sync/internal/authclient.
func post(t *testing.T, url string, body any) (int, map[string]any) {
	t.Helper()
	b, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func TestIdentityV1_ListWalksAllPages(t *testing.T) {
	repo := &fakeRepo{}
	for i := range 1200 {
		repo.rows = append(repo.rows, models.Identity{ID: int64(i + 1), MDMID: int64(i + 1), ObjectGUID: fmt.Sprintf("g%d", i)})
	}
	srv := newV1Server(t, repo)

	seen, pages, token := 0, 0, ""
	for {
		code, out := post(t, srv.URL+"/contract.auth.service.IdentityService/List",
			map[string]any{"pageSize": 1000, "pageToken": token})
		if code != http.StatusOK {
			t.Fatalf("status %d: %v", code, out)
		}
		ids, _ := out["identities"].([]any)
		seen += len(ids)
		pages++
		token, _ = out["nextPageToken"].(string)
		if token == "" {
			break
		}
		if pages > 10 {
			t.Fatal("pagination does not terminate")
		}
	}
	if seen != 1200 {
		t.Fatalf("seen %d identities, want 1200", seen)
	}
}

func TestIdentityV1_LinkMDMChecksBodyToken(t *testing.T) {
	repo := &fakeRepo{}
	srv := newV1Server(t, repo)
	url := srv.URL + "/contract.auth.service.IdentityService/LinkMDM"

	if code, _ := post(t, url, map[string]any{"objectGuid": "g1", "mdmId": "7", "internalToken": "wrong"}); code != http.StatusForbidden {
		t.Fatalf("wrong token: status %d, want 403", code)
	}
	if code, out := post(t, url, map[string]any{"objectGuid": "g1", "mdmId": "7", "internalToken": "secret"}); code != http.StatusOK {
		t.Fatalf("status %d: %v", code, out)
	}
	if len(repo.rows) != 1 || repo.rows[0].MDMID != 7 {
		t.Fatalf("link not saved: %+v", repo.rows)
	}
}
