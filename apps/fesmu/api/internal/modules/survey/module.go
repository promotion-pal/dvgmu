// Package survey — объекты опросов (QR-точки) в панели «Аналитика»: заведение,
// правка и правила номеров QR. Данные хранит сервис аналитики; модуль — его
// единственная дорога на запись из fesmu (прокси аналитики только читает),
// поэтому номера QR не повторяются и не уходят в ноль.
//
// Права: SurveyQrFetch — просмотр раздела «Аналитика», создание и правка —
// analytics.post (интерцептор, Sections).
package survey

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/proto"

	analyticsentity "dvgmu/api/contract/gen/go/analytics/entity"
	analyticspb "dvgmu/api/contract/gen/go/analytics/service"
	analyticsconnect "dvgmu/api/contract/gen/go/analytics/service/serviceconnect"
	pb "dvgmu/api/contract/gen/go/service/v1"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
)

// Upstream — часть клиента сервиса аналитики, нужная модулю.
type Upstream interface {
	Reader
	AnalyticCreate(context.Context, *connect.Request[analyticspb.AnalyticCreateRequest]) (*connect.Response[analyticspb.AnalyticCreateResponse], error)
	AnalyticUpdate(context.Context, *connect.Request[analyticspb.AnalyticUpdateRequest]) (*connect.Response[analyticspb.AnalyticUpdateResponse], error)
}

type Module struct {
	log      *slog.Logger
	upstream Upstream // nil — сервис аналитики не настроен
}

// New: пустой url — модуль отвечает «недоступно», остальной api работает.
func New(log *slog.Logger, analyticsURL string) *Module {
	m := &Module{log: log}
	if analyticsURL != "" {
		m.upstream = analyticsconnect.NewAnalyticServiceClient(http.DefaultClient, analyticsURL)
	}
	return m
}

// NewWithUpstream — для тестов.
func NewWithUpstream(log *slog.Logger, upstream Upstream) *Module {
	return &Module{log: log, upstream: upstream}
}

func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewSurveyServiceHandler(m, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.SurveyServiceName}
}

var errUnavailable = connect.NewError(connect.CodeUnavailable, errors.New("сервис опросов недоступен"))

func qrTaken(qr int64, by *analyticsentity.Analytic) error {
	return connect.NewError(connect.CodeAlreadyExists,
		fmt.Errorf("QR %d уже у объекта «%s» — выберите другой номер", qr, by.GetName()))
}

func (m *Module) SurveyQrFetch(ctx context.Context, req *connect.Request[pb.SurveyQrFetchRequest]) (*connect.Response[pb.SurveyQrFetchResponse], error) {
	if m.upstream == nil {
		return nil, errUnavailable
	}
	idx, err := loadQRIndex(ctx, m.upstream)
	if err != nil {
		return nil, m.upstreamError("list", err)
	}
	res := &pb.SurveyQrFetchResponse{Next: idx.next()}
	if c := req.Msg.GetCheck(); c > 0 {
		if by := idx.takenBy(c, req.Msg.GetExcludeId()); by != nil {
			res.TakenBy = by.GetName()
		}
	}
	return connect.NewResponse(res), nil
}

func (m *Module) SurveyCreate(ctx context.Context, req *connect.Request[pb.SurveyCreateRequest]) (*connect.Response[pb.SurveyResponse], error) {
	if m.upstream == nil {
		return nil, errUnavailable
	}
	msg := req.Msg
	name := strings.TrimSpace(msg.GetName())
	if name == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("укажите название объекта"))
	}
	if msg.GetType() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("выберите вид опроса"))
	}
	if msg.GetQr() < 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("номер QR должен быть положительным"))
	}

	idx, err := loadQRIndex(ctx, m.upstream)
	if err != nil {
		return nil, m.upstreamError("list", err)
	}
	qr := msg.GetQr()
	if qr == 0 {
		qr = idx.next()
	} else if by := idx.takenBy(qr, 0); by != nil {
		return nil, qrTaken(qr, by)
	}

	created, err := m.upstream.AnalyticCreate(ctx, connect.NewRequest(&analyticspb.AnalyticCreateRequest{
		Name:       name,
		Transcript: strings.TrimSpace(msg.GetTranscript()),
		Type:       msg.GetType(),
		Qr:         qr,
	}))
	if err != nil {
		return nil, m.upstreamError("create", err)
	}
	return m.respondByID(ctx, created.Msg.GetId())
}

func (m *Module) SurveyUpdate(ctx context.Context, req *connect.Request[pb.SurveyUpdateRequest]) (*connect.Response[pb.SurveyResponse], error) {
	if m.upstream == nil {
		return nil, errUnavailable
	}
	msg := req.Msg
	if msg.GetId() <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("не указан объект"))
	}
	up := &analyticspb.AnalyticUpdateRequest{Id: msg.GetId(), Type: msg.Type}
	if msg.Name != nil {
		name := strings.TrimSpace(msg.GetName())
		if name == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("укажите название объекта"))
		}
		up.Name = &name
	}
	if msg.Transcript != nil {
		t := strings.TrimSpace(msg.GetTranscript())
		up.Transcript = &t
	}
	if msg.Type != nil && msg.GetType() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("выберите вид опроса"))
	}
	if msg.Qr != nil {
		qr := msg.GetQr()
		if qr <= 0 {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("номер QR должен быть положительным"))
		}
		idx, err := loadQRIndex(ctx, m.upstream)
		if err != nil {
			return nil, m.upstreamError("list", err)
		}
		if by := idx.takenBy(qr, msg.GetId()); by != nil {
			return nil, qrTaken(qr, by)
		}
		up.Qr = &qr
	}

	res, err := m.upstream.AnalyticUpdate(ctx, connect.NewRequest(up))
	switch connect.CodeOf(err) {
	case connect.CodeNotFound:
		return nil, connect.NewError(connect.CodeNotFound, errors.New("объект не найден"))
	case connect.CodeAlreadyExists:
		// Номер заняли между проверкой и записью.
		return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("этот номер QR только что заняли — выберите другой"))
	}
	if err != nil {
		return nil, m.upstreamError("update", err)
	}
	return connect.NewResponse(&pb.SurveyResponse{Survey: withoutRatings(res.Msg.GetEntity())}), nil
}

func (m *Module) respondByID(ctx context.Context, id int64) (*connect.Response[pb.SurveyResponse], error) {
	res, err := m.upstream.AnalyticByID(ctx, connect.NewRequest(&analyticspb.AnalyticByIDRequest{Id: id}))
	if err != nil {
		return nil, m.upstreamError("by id", err)
	}
	return connect.NewResponse(&pb.SurveyResponse{Survey: withoutRatings(res.Msg.GetEntity())}), nil
}

// withoutRatings — ответы (с ФИО) панель читает отдельно, через прокси.
func withoutRatings(e *analyticsentity.Analytic) *analyticsentity.Analytic {
	if e == nil {
		return nil
	}
	out := proto.Clone(e).(*analyticsentity.Analytic)
	out.Ratings = nil
	return out
}

func (m *Module) upstreamError(op string, err error) error {
	m.log.Error("survey: analytics "+op+" failed", slog.String("error", err.Error()))
	return errUnavailable
}
