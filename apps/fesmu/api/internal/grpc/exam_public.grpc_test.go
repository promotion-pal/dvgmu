package grpc

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	pb "fesmu/contract/fesmu/exam/service/v1"
	rpc "fesmu/contract/fesmu/exam/service/v1/servicev1connect"
	staffpb "fesmu/contract/fesmu/service/v1"
	mdmpb "fesmu/contract/mdm/service"
)

type publicExamMemoryStore struct{ memoryTestSessionStorage }

func (s *publicExamMemoryStore) ExamPublicFetch(context.Context, time.Time, string) ([]models.ExamPublicTest, error) {
	return []models.ExamPublicTest{{TestID: 7, Token: "public-session", Faculty: "Педиатрия", Semester: 6, Subject: "Фармакология", Title: "Экзамен", DurationMinutes: 45}}, nil
}

func TestExamCatalogueIsPublicButStaffDataIsPrivate(t *testing.T) {
	store := &publicExamMemoryStore{}
	handler := TestSessionNewController(service.NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), store, nil).WithExamDirectory(&publicExamTestDirectory{}))
	guard := auth.NewInterceptor(nil, "auth-service", "fesmu", "fesmu_at")
	guard.Skip[rpc.ExamTestSessionServiceExamPublicFetchProcedure] = true
	guard.Sections = map[string][]auth.Section{rpc.ExamTestSessionServiceName: {auth.SectionExamTests}}
	_, mux := rpc.NewExamTestSessionServiceHandler(handler, connect.WithInterceptors(guard))
	server := httptest.NewServer(mux)
	defer server.Close()
	client := rpc.NewExamTestSessionServiceClient(http.DefaultClient, server.URL)
	response, err := client.ExamPublicFetch(context.Background(), connect.NewRequest(&pb.ExamPublicFetchRequest{RecordBook: "2025001"}))
	if err != nil {
		t.Fatal(err)
	}
	if len(response.Msg.List) != 1 || response.Msg.List[0].Semester != 6 || response.Msg.List[0].Token != "public-session" {
		t.Fatalf("unexpected public catalogue: %v", response.Msg)
	}
	if response.Msg.Student == nil || response.Msg.Student.FullName != "Иванов Иван" || response.Msg.Student.StudentGroup != "201" {
		t.Fatalf("missing student identity: %v", response.Msg.Student)
	}
	// Keep the anonymous projection constrained to the catalogue even when the
	// private session/test models gain more sensitive fields in the future.
	allowed := map[string]bool{"test_id": true, "token": true, "faculty": true, "semester": true, "subject": true, "title": true, "duration_minutes": true}
	fields := response.Msg.List[0].ProtoReflect().Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		if !allowed[string(fields.Get(i).Name())] {
			t.Fatalf("unexpected public field: %s", fields.Get(i).Name())
		}
	}
	_, err = client.TestSessionFetch(context.Background(), connect.NewRequest(&staffpb.TestSessionFetchRequest{}))
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("anonymous staff access must be rejected: %v", err)
	}
}

func TestExamCatalogueUnavailableDatabase(t *testing.T) {
	_, err := TestSessionNewController(nil).ExamPublicFetch(context.Background(), connect.NewRequest(&pb.ExamPublicFetchRequest{RecordBook: "2025001"}))
	if connect.CodeOf(err) != connect.CodeUnavailable {
		t.Fatalf("expected unavailable, got %v", err)
	}
}

type publicExamTestDirectory struct{}

func (*publicExamTestDirectory) Fetch(context.Context, *mdmpb.UserDirectoryFetchRequest) (*mdmpb.UserDirectoryFetchResponse, error) {
	return &mdmpb.UserDirectoryFetchResponse{ProfileKind: "student", Total: 1, Users: []*mdmpb.UserDirectoryEntry{{Uuid: "11111111-1111-4111-8111-111111111111", FullName: "Иванов Иван", Students: []*mdmpb.UserDirectoryStudent{{Group: "201", FacultyName: "Педиатрический ф.", Course: 2}}}}}, nil
}

func TestExamAudienceDirectoryNeedsEditPermission(t *testing.T) {
	handler := TestSessionNewController(service.NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), &publicExamMemoryStore{}, nil).WithExamDirectory(&publicExamTestDirectory{}))
	viewer := auth.WithUser(context.Background(), &auth.User{Permissions: []string{"exam_tests.fetch"}})
	if _, err := handler.ExamAudienceFetch(viewer, connect.NewRequest(&mdmpb.UserDirectoryFetchRequest{})); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("read-only user can enumerate recipients: %v", err)
	}
	editor := auth.WithUser(context.Background(), &auth.User{Permissions: []string{"exam_tests.post"}})
	if _, err := handler.ExamAudienceFetch(editor, connect.NewRequest(&mdmpb.UserDirectoryFetchRequest{})); err != nil {
		t.Fatalf("editor cannot select students: %v", err)
	}
}
