package mdmclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchAll_ParsesQuotedInt64(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/contract.service.UserService/UserFetch" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"users":[
			{"id":"501","firstName":"Иван","lastName":"Иванов","email":"ivanov@fesmu.ru","status":"USER_STATUS_ACTIVE"},
			{"id":"502","firstName":"Пётр","lastName":"Петров","email":"petrov@fesmu.ru","status":"USER_STATUS_INACTIVE"}
		]}`))
	}))
	defer srv.Close()

	users, err := NewClient(srv.URL, "").FetchAll(context.Background())
	if err != nil {
		t.Fatalf("FetchAll: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("got %d users, want 2", len(users))
	}
	if users[0].ID != 501 || users[0].Status != "USER_STATUS_ACTIVE" {
		t.Fatalf("unexpected user[0]: %+v", users[0])
	}
	if users[1].ID != 502 || users[1].Status != "USER_STATUS_INACTIVE" {
		t.Fatalf("unexpected user[1]: %+v", users[1])
	}
}

func TestLinkAD(t *testing.T) {
	var gotAuth string
	var gotBody map[string][]map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/contract.service.UserLinkService/UserADLinkBatch" {
			t.Errorf("path = %s", r.URL.Path)
		}
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"linked":"1","skipped":[{"id":"8","adObjectId":"g2"}]}`))
	}))
	defer srv.Close()

	linked, skipped, err := NewClient(srv.URL, "secret").LinkAD(context.Background(), []ADLink{
		{MDMID: 7, ObjectGUID: "g1"},
		{MDMID: 8, ObjectGUID: "g2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bearer secret" {
		t.Fatalf("Authorization = %q", gotAuth)
	}
	if len(gotBody["links"]) != 2 || gotBody["links"][0]["id"] != "7" || gotBody["links"][0]["adObjectId"] != "g1" {
		t.Fatalf("body = %v", gotBody)
	}
	if linked != 1 || len(skipped) != 1 || skipped[0].MDMID != 8 {
		t.Fatalf("linked=%d skipped=%v", linked, skipped)
	}
}
