package examv2

import (
	"bytes"
	"connectrpc.com/connect"
	"context"
	"encoding/json"
	"errors"
	pb "fesmu/contract/fesmu/exam/service/v2"
	"io"
	"net/http"
	"os"
	"time"
)

// Institution-supplied reviewer adapter. Never sends identities or exam results.
// Request: Bank protobuf JSON; response: {"notes":"..."}. Credentials stay server-side.
func (m *Module) AIReviewFetch(ctx context.Context, req *connect.Request[pb.AIReviewFetchRequest]) (*connect.Response[pb.AIReviewFetchResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	endpoint := os.Getenv("EXAM_V2_AI_REVIEW_URL")
	if endpoint == "" {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("ИИ-провайдер ещё не настроен; проверка структуры и согласование УМР доступны"))
	}
	var record BankRecord
	if err := m.db.WithContext(ctx).First(&record, req.Msg.BankId).Error; err != nil {
		return nil, dbError(err)
	}
	if record.Revision != req.Msg.Revision {
		return nil, connect.NewError(connect.CodeAborted, errors.New("сохраните актуальную редакцию банка"))
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(record.Payload))
	if err != nil {
		return nil, bad("неверный адрес ИИ-провайдера")
	}
	request.Header.Set("Content-Type", "application/json")
	if token := os.Getenv("EXAM_V2_AI_REVIEW_TOKEN"); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := (&http.Client{Timeout: 45 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}).Do(request)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("ИИ-проверка временно недоступна"))
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("ИИ-провайдер отклонил запрос"))
	}
	var result struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&result); err != nil || result.Notes == "" {
		return nil, bad("ИИ-провайдер не вернул заключение")
	}
	return connect.NewResponse(&pb.AIReviewFetchResponse{Notes: result.Notes}), nil
}
