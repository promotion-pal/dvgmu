package examv2

import (
	"connectrpc.com/connect"
	"context"
	"dvgmu/api/internal/auth"
	pb "fesmu/contract/fesmu/exam/service/v2"
	"gorm.io/gorm"
	"testing"
)

func TestAIReviewIsDisabledEvenWhenProviderConfigured(t *testing.T) {
	t.Setenv("EXAM_V2_AI_REVIEW_URL", "http://127.0.0.1:1")
	// The disabled endpoint must neither query storage nor call a provider.
	m := New(&gorm.DB{}, nil)
	ctx := auth.WithUser(context.Background(), &auth.User{UUID: "admin", Roles: []string{auth.RoleAdmin}})
	_, err := m.AIReviewFetch(ctx, connect.NewRequest(&pb.AIReviewFetchRequest{BankId: 123}))
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("AI endpoint should be disabled: %v", err)
	}
	if _, err := m.AIReviewFetch(context.Background(), connect.NewRequest(&pb.AIReviewFetchRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatal("authentication guard changed", err)
	}
}
