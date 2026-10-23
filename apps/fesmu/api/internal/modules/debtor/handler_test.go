package debtor

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
	serviceconnect "fesmu/contract/fesmu/service/v1/servicev1connect"
	onec "dvgmu/api/internal/utils/1c"
)

func serve(t *testing.T, m *Module) serviceconnect.DebtorServiceClient {
	mux := http.NewServeMux()
	m.Mount(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return serviceconnect.NewDebtorServiceClient(srv.Client(), srv.URL)
}

func TestHandlerNotConfigured(t *testing.T) {
	client := serve(t, New(testLog(), onec.Config{DB: "bgu2"}))
	_, err := client.DebtorFetch(context.Background(), connect.NewRequest(&pb.DebtorFetchRequest{}))
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("want FailedPrecondition, got %v", err)
	}
}

func TestHandlerSourceDown(t *testing.T) {
	m := &Module{log: testLog(), service: testService(&fakeSource{err: errors.New("winrm down")})}
	_, err := serve(t, m).DebtorFetch(context.Background(), connect.NewRequest(&pb.DebtorFetchRequest{}))
	if connect.CodeOf(err) != connect.CodeUnavailable {
		t.Fatalf("want Unavailable, got %v", err)
	}
}

func TestHandlerOK(t *testing.T) {
	src := &fakeSource{rows: []onec.ContractTurnover{{Kontragent: "Иванов И.И.", Dogovor: "Д-1", Closing: 100}}}
	m := &Module{log: testLog(), service: testService(src)}
	resp, err := serve(t, m).DebtorFetch(context.Background(), connect.NewRequest(&pb.DebtorFetchRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Msg.Debtors) != 1 || resp.Msg.Debtors[0].Closing != 100 {
		t.Fatalf("unexpected response: %+v", resp.Msg)
	}
}

func TestHandlerInvalidPeriod(t *testing.T) {
	m := &Module{log: testLog(), service: testService(&fakeSource{})}
	_, err := serve(t, m).DebtorFetch(context.Background(), connect.NewRequest(&pb.DebtorFetchRequest{DateFrom: "2026-05-01", DateTo: "2026-01-01"}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("want InvalidArgument, got %v", err)
	}
}
