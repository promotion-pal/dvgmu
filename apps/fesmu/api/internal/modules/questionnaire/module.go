// Package questionnaire — открытая страница анкеты по QR (без входа). Ходит в
// сервис аналитики от имени fesmu: опрос отдаёт без ответов (в них ФИО
// респондентов — их видит только панель «Аналитика» с правом на раздел), ответ
// передаёт с IP респондента — по нему сервис аналитики ловит повторы.
package questionnaire

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/proto"

	analyticsentity "dvgmu/api/contract/gen/go/analytics/entity"
	analyticspb "dvgmu/api/contract/gen/go/analytics/service"
	analyticsconnect "dvgmu/api/contract/gen/go/analytics/service/serviceconnect"
	pb "dvgmu/api/contract/gen/go/service/v1"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
	"dvgmu/api/internal/modules/survey"
)

// Upstream — часть клиента сервиса аналитики, нужная анкете.
type Upstream interface {
	AnalyticByID(context.Context, *connect.Request[analyticspb.AnalyticByIDRequest]) (*connect.Response[analyticspb.AnalyticByIDResponse], error)
	AnalyticFetch(context.Context, *connect.Request[analyticspb.AnalyticFetchRequest]) (*connect.ServerStreamForClient[analyticspb.AnalyticByIDResponse], error)
	AnalyticRatingCreate(context.Context, *connect.Request[analyticspb.AnalyticRatingCreateRequest]) (*connect.Response[analyticspb.AnalyticRatingCreateResponse], error)
}

type Module struct {
	log      *slog.Logger
	upstream Upstream // nil — сервис аналитики не настроен
}

// New: пустой url — анкета отвечает «недоступно», остальной api работает.
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

// Procedures — открытые процедуры (в Interceptor.Skip).
var Procedures = []string{
	serviceconnect.QuestionnaireServiceQuestionnaireFetchProcedure,
	serviceconnect.QuestionnaireServiceQuestionnaireSubmitProcedure,
}

func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewQuestionnaireServiceHandler(m, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.QuestionnaireServiceName}
}

var errUnavailable = connect.NewError(connect.CodeUnavailable, errors.New("сервис опросов недоступен"))
var errNotFound = connect.NewError(connect.CodeNotFound, errors.New("опрос не найден — проверьте QR-код"))

func (m *Module) QuestionnaireFetch(ctx context.Context, req *connect.Request[pb.QuestionnaireFetchRequest]) (*connect.Response[pb.QuestionnaireFetchResponse], error) {
	if m.upstream == nil {
		return nil, errUnavailable
	}
	qr, id := req.Msg.GetQr(), req.Msg.GetId()

	var found *analyticspb.AnalyticByIDResponse
	switch {
	case qr > 0:
		// Номер QR → объект: та же логика, что у модуля опросов.
		e, err := survey.FindByQR(ctx, m.upstream, qr)
		if err != nil {
			return nil, m.upstreamError("fetch by qr", err)
		}
		if e != nil {
			found = &analyticspb.AnalyticByIDResponse{Entity: e}
		}
	case id > 0:
		res, err := m.upstream.AnalyticByID(ctx, connect.NewRequest(&analyticspb.AnalyticByIDRequest{Id: id}))
		if connect.CodeOf(err) == connect.CodeNotFound {
			return nil, errNotFound
		}
		if err != nil {
			return nil, m.upstreamError("by id", err)
		}
		found = res.Msg
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("нужен номер QR или id опроса"))
	}
	if found.GetEntity() == nil {
		return nil, errNotFound
	}

	// Без ответов: их ФИО — не для открытой страницы.
	analytic := proto.Clone(found.GetEntity()).(*analyticsentity.Analytic)
	analytic.Ratings = nil
	return connect.NewResponse(&pb.QuestionnaireFetchResponse{Analytic: analytic}), nil
}

func (m *Module) QuestionnaireSubmit(ctx context.Context, req *connect.Request[analyticspb.AnalyticRatingCreateRequest]) (*connect.Response[analyticspb.AnalyticRatingCreateResponse], error) {
	if m.upstream == nil {
		return nil, errUnavailable
	}
	up := connect.NewRequest(req.Msg)
	up.Header().Set("X-Forwarded-For", clientIP(req.Header(), req.Peer().Addr))
	res, err := m.upstream.AnalyticRatingCreate(ctx, up)
	if err != nil {
		// Отказ сервиса аналитики (повтор, нет опроса) — как есть, с его текстом.
		var ce *connect.Error
		if errors.As(err, &ce) && ce.Code() != connect.CodeUnavailable && ce.Code() != connect.CodeUnknown {
			return nil, connect.NewError(ce.Code(), errors.New(ce.Message()))
		}
		return nil, m.upstreamError("rating create", err)
	}
	return res, nil
}

func (m *Module) upstreamError(op string, err error) error {
	m.log.Error("questionnaire: analytics "+op+" failed", slog.String("error", err.Error()))
	return errUnavailable
}

// clientIP — адрес респондента: из X-Forwarded-For (его ставит Traefik), иначе
// адрес соединения.
func clientIP(header http.Header, peer string) string {
	if xff := header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	if host, _, err := net.SplitHostPort(peer); err == nil {
		return host
	}
	return peer
}
