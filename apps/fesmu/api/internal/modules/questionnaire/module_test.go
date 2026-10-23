package questionnaire_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"

	analyticsentity "dvgmu/api/contract/gen/go/analytics/entity"
	analyticspb "dvgmu/api/contract/gen/go/analytics/service"
	analyticsconnect "dvgmu/api/contract/gen/go/analytics/service/serviceconnect"
	pb "dvgmu/api/contract/gen/go/service/v1"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
	"dvgmu/api/internal/modules/questionnaire"
)

// fakeAnalytics — сервис аналитики с одним опросом QR 101 и одним ответом.
type fakeAnalytics struct {
	analyticsconnect.UnimplementedAnalyticServiceHandler
	gotIP string
}

func (f *fakeAnalytics) AnalyticFetch(_ context.Context, req *connect.Request[analyticspb.AnalyticFetchRequest], s *connect.ServerStream[analyticspb.AnalyticByIDResponse]) error {
	if req.Msg.GetQr() != 101 {
		return nil
	}
	return s.Send(&analyticspb.AnalyticByIDResponse{Entity: &analyticsentity.Analytic{
		Id: 7, Qr: 101, Name: "Кабинет 214",
		Ratings: []*analyticsentity.AnalyticRating{{Id: 1, RespondentLastName: "Иванов"}},
	}})
}

func (f *fakeAnalytics) AnalyticRatingCreate(_ context.Context, req *connect.Request[analyticspb.AnalyticRatingCreateRequest]) (*connect.Response[analyticspb.AnalyticRatingCreateResponse], error) {
	f.gotIP = req.Header().Get("X-Forwarded-For")
	return connect.NewResponse(&analyticspb.AnalyticRatingCreateResponse{Id: 5, Success: true}), nil
}

func setup(t *testing.T) (serviceconnect.QuestionnaireServiceClient, *fakeAnalytics) {
	t.Helper()
	fake := &fakeAnalytics{}
	upMux := http.NewServeMux()
	upMux.Handle(analyticsconnect.NewAnalyticServiceHandler(fake))
	up := httptest.NewServer(upMux)
	t.Cleanup(up.Close)

	mod := questionnaire.New(slog.New(slog.NewTextHandler(io.Discard, nil)), up.URL)
	mux := http.NewServeMux()
	mod.Mount(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return serviceconnect.NewQuestionnaireServiceClient(http.DefaultClient, srv.URL), fake
}

func TestQuestionnaireFetch_NoRatings(t *testing.T) {
	client, _ := setup(t)
	res, err := client.QuestionnaireFetch(context.Background(), connect.NewRequest(&pb.QuestionnaireFetchRequest{Qr: 101}))
	if err != nil {
		t.Fatal(err)
	}
	a := res.Msg.GetAnalytic()
	if a.GetName() != "Кабинет 214" || len(a.GetRatings()) != 0 {
		t.Fatalf("want survey without ratings, got %+v", a)
	}
	if _, err := client.QuestionnaireFetch(context.Background(), connect.NewRequest(&pb.QuestionnaireFetchRequest{Qr: 999})); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("unknown qr: %v", err)
	}
}

func TestQuestionnaireSubmit_ForwardsIP(t *testing.T) {
	client, fake := setup(t)
	req := connect.NewRequest(&analyticspb.AnalyticRatingCreateRequest{AnalyticId: 7})
	req.Header().Set("X-Forwarded-For", "10.1.2.3")
	res, err := client.QuestionnaireSubmit(context.Background(), req)
	if err != nil || !res.Msg.GetSuccess() {
		t.Fatalf("submit: %v %v", res, err)
	}
	if fake.gotIP != "10.1.2.3" {
		t.Fatalf("respondent IP not forwarded: %q", fake.gotIP)
	}
}
