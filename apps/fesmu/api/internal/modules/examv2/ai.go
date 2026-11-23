package examv2

import (
	"connectrpc.com/connect"
	"context"
	"errors"
	pb "fesmu/contract/fesmu/exam/service/v2"
)

// Keep the RPC compatible with cached clients, but do not query any provider.
func (m *Module) AIReviewFetch(ctx context.Context, _ *connect.Request[pb.AIReviewFetchRequest]) (*connect.Response[pb.AIReviewFetchResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("ИИ-проверка временно отключена"))
}
