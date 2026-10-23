package survey

import (
	"context"

	"connectrpc.com/connect"

	analyticsentity "dvgmu/api/contract/gen/go/packages/analytics/entity"
	analyticspb "dvgmu/api/contract/gen/go/packages/analytics/service"
)

// Reader — чтение объектов из сервиса аналитики (его клиент подходит как есть).
type Reader interface {
	AnalyticByID(context.Context, *connect.Request[analyticspb.AnalyticByIDRequest]) (*connect.Response[analyticspb.AnalyticByIDResponse], error)
	AnalyticFetch(context.Context, *connect.Request[analyticspb.AnalyticFetchRequest]) (*connect.ServerStreamForClient[analyticspb.AnalyticByIDResponse], error)
}

// FindByQR — объект с номером QR (как в печатных кодах); nil — такого нет.
// Если номер по ошибке у нескольких (старые данные), берётся первый по id —
// тот же, что открывала анкета раньше.
func FindByQR(ctx context.Context, r Reader, qr int64) (*analyticsentity.Analytic, error) {
	stream, err := r.AnalyticFetch(ctx, connect.NewRequest(&analyticspb.AnalyticFetchRequest{Qr: &qr}))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	var found *analyticsentity.Analytic
	for stream.Receive() {
		if e := stream.Msg().GetEntity(); e != nil && e.GetQr() == qr && (found == nil || e.GetId() < found.GetId()) {
			found = e
		}
	}
	if err := stream.Err(); err != nil {
		return nil, err
	}
	return found, nil
}

// qrIndex — кто какой номер занимает; строится по всем объектам.
type qrIndex struct {
	byQR map[int64]*analyticsentity.Analytic
	max  int64
}

func loadQRIndex(ctx context.Context, r Reader) (*qrIndex, error) {
	stream, err := r.AnalyticFetch(ctx, connect.NewRequest(&analyticspb.AnalyticFetchRequest{}))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	idx := &qrIndex{byQR: map[int64]*analyticsentity.Analytic{}}
	for stream.Receive() {
		e := stream.Msg().GetEntity()
		if e == nil || e.GetQr() <= 0 {
			continue
		}
		if prev, ok := idx.byQR[e.GetQr()]; !ok || e.GetId() < prev.GetId() {
			idx.byQR[e.GetQr()] = e
		}
		idx.max = max(idx.max, e.GetQr())
	}
	if err := stream.Err(); err != nil {
		return nil, err
	}
	return idx, nil
}

// next — новый номер: на один больше самого большого. Дыры не занимаем:
// номер удалённого объекта мог остаться на распечатанной табличке.
func (idx *qrIndex) next() int64 { return idx.max + 1 }

// takenBy — объект с номером qr, кроме самого excludeID; nil — номер свободен.
func (idx *qrIndex) takenBy(qr, excludeID int64) *analyticsentity.Analytic {
	if e := idx.byQR[qr]; e != nil && e.GetId() != excludeID {
		return e
	}
	return nil
}
