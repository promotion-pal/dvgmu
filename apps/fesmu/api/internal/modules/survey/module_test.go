package survey_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/proto"

	analyticsentity "dvgmu/api/contract/gen/go/analytics/entity"
	analyticsenum "dvgmu/api/contract/gen/go/analytics/enum"
	analyticspb "dvgmu/api/contract/gen/go/analytics/service"
	analyticsconnect "dvgmu/api/contract/gen/go/analytics/service/serviceconnect"
	pb "dvgmu/api/contract/gen/go/service/v1"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
	"dvgmu/api/internal/modules/survey"
)

// fakeAnalytics — сервис аналитики в памяти: объекты, их номера QR, ответы.
type fakeAnalytics struct {
	analyticsconnect.UnimplementedAnalyticServiceHandler
	mu    sync.Mutex
	items []*analyticsentity.Analytic
}

func (f *fakeAnalytics) find(id int64) *analyticsentity.Analytic {
	for _, it := range f.items {
		if it.Id == id {
			return it
		}
	}
	return nil
}

func (f *fakeAnalytics) AnalyticFetch(_ context.Context, req *connect.Request[analyticspb.AnalyticFetchRequest], s *connect.ServerStream[analyticspb.AnalyticByIDResponse]) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, it := range f.items {
		if req.Msg.Qr != nil && it.Qr != req.Msg.GetQr() {
			continue
		}
		if err := s.Send(&analyticspb.AnalyticByIDResponse{Entity: it}); err != nil {
			return err
		}
	}
	return nil
}

func (f *fakeAnalytics) AnalyticByID(_ context.Context, req *connect.Request[analyticspb.AnalyticByIDRequest]) (*connect.Response[analyticspb.AnalyticByIDResponse], error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return connect.NewResponse(&analyticspb.AnalyticByIDResponse{Entity: f.find(req.Msg.GetId())}), nil
}

func (f *fakeAnalytics) AnalyticCreate(_ context.Context, req *connect.Request[analyticspb.AnalyticCreateRequest]) (*connect.Response[analyticspb.AnalyticCreateResponse], error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id := int64(len(f.items) + 1)
	f.items = append(f.items, &analyticsentity.Analytic{Id: id, Qr: req.Msg.GetQr(), Name: req.Msg.GetName(), Transcript: req.Msg.GetTranscript(), Type: req.Msg.GetType()})
	return connect.NewResponse(&analyticspb.AnalyticCreateResponse{Id: id, Success: true}), nil
}

func (f *fakeAnalytics) AnalyticUpdate(_ context.Context, req *connect.Request[analyticspb.AnalyticUpdateRequest]) (*connect.Response[analyticspb.AnalyticUpdateResponse], error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	it := f.find(req.Msg.GetId())
	if it == nil {
		return nil, connect.NewError(connect.CodeNotFound, nil)
	}
	if req.Msg.Name != nil {
		it.Name = req.Msg.GetName()
	}
	if req.Msg.Transcript != nil {
		it.Transcript = req.Msg.GetTranscript()
	}
	if req.Msg.Type != nil {
		it.Type = req.Msg.GetType()
	}
	if req.Msg.Qr != nil {
		it.Qr = req.Msg.GetQr()
	}
	return connect.NewResponse(&analyticspb.AnalyticUpdateResponse{Success: true, Entity: proto.Clone(it).(*analyticsentity.Analytic)}), nil
}

func setup(t *testing.T) (serviceconnect.SurveyServiceClient, *fakeAnalytics) {
	t.Helper()
	fake := &fakeAnalytics{items: []*analyticsentity.Analytic{
		{Id: 1, Qr: 11, Name: "1 лекционный зал", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_LECTURE,
			Ratings: []*analyticsentity.AnalyticRating{{Id: 1, RespondentLastName: "Иванов"}}},
		{Id: 2, Qr: 66, Name: "Рабочее место", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_WORKPLACE},
	}}
	upMux := http.NewServeMux()
	upMux.Handle(analyticsconnect.NewAnalyticServiceHandler(fake))
	up := httptest.NewServer(upMux)
	t.Cleanup(up.Close)

	mux := http.NewServeMux()
	survey.New(slog.New(slog.NewTextHandler(io.Discard, nil)), up.URL).Mount(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return serviceconnect.NewSurveyServiceClient(http.DefaultClient, srv.URL), fake
}

func TestQrFetch_NextAndTaken(t *testing.T) {
	client, _ := setup(t)
	ctx := context.Background()

	res, err := client.SurveyQrFetch(ctx, connect.NewRequest(&pb.SurveyQrFetchRequest{Check: 11}))
	if err != nil {
		t.Fatal(err)
	}
	if res.Msg.GetNext() != 67 || res.Msg.GetTakenBy() != "1 лекционный зал" {
		t.Fatalf("next=%d takenBy=%q", res.Msg.GetNext(), res.Msg.GetTakenBy())
	}
	// Свой номер при правке занятым не считается.
	res, _ = client.SurveyQrFetch(ctx, connect.NewRequest(&pb.SurveyQrFetchRequest{Check: 11, ExcludeId: 1}))
	if res.Msg.GetTakenBy() != "" {
		t.Fatalf("own qr reported taken by %q", res.Msg.GetTakenBy())
	}
}

func TestCreate_AutoQR(t *testing.T) {
	client, _ := setup(t)
	res, err := client.SurveyCreate(context.Background(), connect.NewRequest(&pb.SurveyCreateRequest{
		Name: "  Санузел 2 этаж ", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_TOILET,
	}))
	if err != nil {
		t.Fatal(err)
	}
	if s := res.Msg.GetSurvey(); s.GetQr() != 67 || s.GetName() != "Санузел 2 этаж" {
		t.Fatalf("got qr=%d name=%q", s.GetQr(), s.GetName())
	}
}

func TestCreate_TakenQR(t *testing.T) {
	client, fake := setup(t)
	_, err := client.SurveyCreate(context.Background(), connect.NewRequest(&pb.SurveyCreateRequest{
		Name: "Дубль", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_LECTURE, Qr: 66,
	}))
	if connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("want AlreadyExists, got %v", err)
	}
	if len(fake.items) != 2 {
		t.Fatal("duplicate was created")
	}
}

func TestCreate_Validation(t *testing.T) {
	client, _ := setup(t)
	for _, req := range []*pb.SurveyCreateRequest{
		{Name: " ", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_LECTURE},
		{Name: "Без вида"},
		{Name: "Минус", Type: analyticsenum.AnalyticType_ANALYTIC_TYPE_LECTURE, Qr: -1},
	} {
		if _, err := client.SurveyCreate(context.Background(), connect.NewRequest(req)); connect.CodeOf(err) != connect.CodeInvalidArgument {
			t.Fatalf("%v: want InvalidArgument, got %v", req, err)
		}
	}
}

func TestUpdate_FieldsAndQR(t *testing.T) {
	client, fake := setup(t)
	ctx := context.Background()
	name, qr := "Лекционный зал №1", int64(12)
	res, err := client.SurveyUpdate(ctx, connect.NewRequest(&pb.SurveyUpdateRequest{Id: 1, Name: &name, Qr: &qr}))
	if err != nil {
		t.Fatal(err)
	}
	s := res.Msg.GetSurvey()
	if s.GetName() != name || s.GetQr() != 12 || s.GetType() != analyticsenum.AnalyticType_ANALYTIC_TYPE_LECTURE {
		t.Fatalf("got %+v", s)
	}
	if len(s.GetRatings()) != 0 {
		t.Fatal("ratings leaked into response")
	}
	if len(fake.items[0].Ratings) != 1 {
		t.Fatal("ratings lost in storage")
	}

	// Свой же номер — можно, чужой — нет.
	same := int64(12)
	if _, err := client.SurveyUpdate(ctx, connect.NewRequest(&pb.SurveyUpdateRequest{Id: 1, Qr: &same})); err != nil {
		t.Fatalf("own qr rejected: %v", err)
	}
	taken := int64(66)
	if _, err := client.SurveyUpdate(ctx, connect.NewRequest(&pb.SurveyUpdateRequest{Id: 1, Qr: &taken})); connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("want AlreadyExists, got %v", err)
	}
	empty := " "
	if _, err := client.SurveyUpdate(ctx, connect.NewRequest(&pb.SurveyUpdateRequest{Id: 1, Name: &empty})); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("want InvalidArgument, got %v", err)
	}
	if _, err := client.SurveyUpdate(ctx, connect.NewRequest(&pb.SurveyUpdateRequest{Id: 99, Name: &name})); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("want NotFound, got %v", err)
	}
}

func TestFindByQR(t *testing.T) {
	fake := &fakeAnalytics{items: []*analyticsentity.Analytic{{Id: 5, Qr: 3, Name: "старый"}, {Id: 2, Qr: 3, Name: "первый"}}}
	upMux := http.NewServeMux()
	upMux.Handle(analyticsconnect.NewAnalyticServiceHandler(fake))
	up := httptest.NewServer(upMux)
	defer up.Close()
	client := analyticsconnect.NewAnalyticServiceClient(http.DefaultClient, up.URL)

	got, err := survey.FindByQR(context.Background(), client, 3)
	if err != nil || got.GetId() != 2 {
		t.Fatalf("got %v, %v — want the lowest id among duplicates", got, err)
	}
	if got, _ := survey.FindByQR(context.Background(), client, 404); got != nil {
		t.Fatalf("want nil for unknown qr, got %v", got)
	}
}
