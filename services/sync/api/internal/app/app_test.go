package app

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"dvgmu/sync/internal/mdmclient"
	"dvgmu/sync/internal/reconcile"
)

// Учётка AD, подошедшая двум пользователям MDM, не привязывается никому;
// остальные уходят в mdm одним пакетом.
func TestLinkUnlinked_SkipsAmbiguousGUID(t *testing.T) {
	var sent []map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string][]map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		sent = body["links"]
		_, _ = w.Write([]byte(`{"linked":"1"}`))
	}))
	defer srv.Close()

	a := &App{
		log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		mdm: mdmclient.NewClient(srv.URL, "t"),
	}
	a.linkUnlinked(context.Background(), reconcile.Report{Findings: []reconcile.Finding{
		{Kind: reconcile.KindUnlinkedButExists, MDMID: 1, ObjectGUID: "AAA"},
		{Kind: reconcile.KindUnlinkedButExists, MDMID: 2, ObjectGUID: "shared"},
		{Kind: reconcile.KindUnlinkedButExists, MDMID: 3, ObjectGUID: "SHARED"},
		{Kind: reconcile.KindMissingInAD, MDMID: 4},
	}})

	if len(sent) != 1 || sent[0]["id"] != "1" || sent[0]["adObjectId"] != "AAA" {
		t.Fatalf("sent = %v, want only mdm 1", sent)
	}
}
