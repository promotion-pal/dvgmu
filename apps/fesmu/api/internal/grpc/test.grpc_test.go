package grpc

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"connectrpc.com/connect"

	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type memoryTestStorage struct {
	nextID int64
	tests  map[int64]*models.Test
	images map[string]*models.TestImage
}

func (m *memoryTestStorage) TestImageSave(_ context.Context, img *models.TestImage) error {
	if m.images == nil {
		m.images = map[string]*models.TestImage{}
	}
	if _, ok := m.images[img.Hash]; !ok {
		saved := *img
		saved.Data = nil // the registry keeps no bytes
		m.images[img.Hash] = &saved
	}
	return nil
}

func (m *memoryTestStorage) TestImages(_ context.Context, hashes []string) (map[string]*models.TestImage, error) {
	out := map[string]*models.TestImage{}
	for _, h := range hashes {
		if img, ok := m.images[h]; ok {
			copied := *img
			out[h] = &copied
		}
	}
	return out, nil
}

// memoryFiles stands in for the files service.
type memoryFiles struct {
	files [][]byte
	names []string
}

func (f *memoryFiles) Store(_ context.Context, name string, content []byte) (int64, error) {
	f.files = append(f.files, content)
	f.names = append(f.names, name)
	return int64(len(f.files)), nil
}

func (f *memoryFiles) Load(_ context.Context, id int64) ([]byte, error) {
	return f.files[id-1], nil
}

func (m *memoryTestStorage) TestFetch(_ context.Context, _ models.TestFilter) ([]*models.Test, error) {
	out := make([]*models.Test, 0, len(m.tests))
	for _, t := range m.tests {
		out = append(out, t)
	}
	return out, nil
}

func (m *memoryTestStorage) TestByID(_ context.Context, id int64) (*models.Test, error) {
	t, ok := m.tests[id]
	if !ok {
		return nil, models.ErrTestNotFound
	}
	return t, nil
}

func (m *memoryTestStorage) TestCreate(_ context.Context, t *models.Test) (int64, error) {
	m.nextID++
	t.ID = m.nextID
	m.tests[t.ID] = t
	return t.ID, nil
}

func (m *memoryTestStorage) TestUpdate(_ context.Context, t *models.Test) error {
	if _, ok := m.tests[t.ID]; !ok {
		return models.ErrTestNotFound
	}
	m.tests[t.ID] = t
	return nil
}

func (m *memoryTestStorage) TestExportStatusUpdate(_ context.Context, id int64, status enum.TestExportStatus) error {
	t, ok := m.tests[id]
	if !ok {
		return models.ErrTestNotFound
	}
	t.ExportStatus = status
	return nil
}

func (m *memoryTestStorage) TestDelete(_ context.Context, id int64) error {
	if _, ok := m.tests[id]; !ok {
		return models.ErrTestNotFound
	}
	delete(m.tests, id)
	return nil
}

func newTestTestHandler() *TestHandler {
	store := &memoryTestStorage{tests: map[int64]*models.Test{}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return TestNewController(service.NewTestService(log, store, store, store, &memoryFiles{}))
}

func anatomyTest() *pb.TestCreateRequest {
	return &pb.TestCreateRequest{
		Department: "Кафедра анатомии",
		Discipline: "Анатомия человека",
		Topic:      "Анатомия: кости черепа",
		Questions: []*pb.TestQuestionInput{
			{
				Text: "Сколько костей в мозговом отделе черепа?",
				Answers: []*pb.TestAnswerInput{
					{Text: "6"},
					{Text: "8", IsCorrect: true},
					{Text: "12"},
				},
			},
		},
	}
}

func TestTestLifecycle(t *testing.T) {
	ctx := context.Background()
	h := newTestTestHandler()

	created, err := h.TestCreate(ctx, connect.NewRequest(anatomyTest()))
	if err != nil {
		t.Fatal(err)
	}
	id := created.Msg.GetTestId()

	got, err := h.TestByID(ctx, connect.NewRequest(&pb.TestByIDRequest{Id: id}))
	if err != nil {
		t.Fatal(err)
	}
	q := got.Msg.GetTest().GetQuestions()
	if len(q) != 1 || len(q[0].GetAnswers()) != 3 || !q[0].GetAnswers()[1].GetIsCorrect() {
		t.Fatalf("expected the question with its answers in order, got %v", q)
	}

	update := anatomyTest()
	update.Questions = append(update.Questions, &pb.TestQuestionInput{
		Text:    "Какая кость непарная?",
		Answers: []*pb.TestAnswerInput{{Text: "Лобная", IsCorrect: true}, {Text: "Теменная"}},
	})
	_, err = h.TestUpdate(ctx, connect.NewRequest(&pb.TestUpdateRequest{
		Id: id, Department: "Кафедра  нормальной   физиологии", Discipline: " Нормальная  физиология ", Topic: update.Topic, Questions: update.Questions,
	}))
	if err != nil {
		t.Fatal(err)
	}
	list, _ := h.TestFetch(ctx, connect.NewRequest(&pb.TestFetchRequest{}))
	if len(list.Msg.GetList()) != 1 || len(list.Msg.GetList()[0].GetQuestions()) != 2 || list.Msg.GetList()[0].GetDepartment() != "Кафедра нормальной физиологии" || list.Msg.GetList()[0].GetDiscipline() != "Нормальная физиология" {
		t.Fatalf("expected one test with two questions, got %v", list.Msg.GetList())
	}

	if _, err := h.TestDelete(ctx, connect.NewRequest(&pb.TestDeleteRequest{Id: id})); err != nil {
		t.Fatal(err)
	}
	_, err = h.TestDelete(ctx, connect.NewRequest(&pb.TestDeleteRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound on a second delete, got %v", err)
	}
	_, err = h.TestByID(ctx, connect.NewRequest(&pb.TestByIDRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound for a deleted test, got %v", err)
	}
}

func TestTestRules(t *testing.T) {
	ctx := context.Background()
	h := newTestTestHandler()

	cases := map[string]func(*pb.TestCreateRequest){
		"no department":    func(r *pb.TestCreateRequest) { r.Department = " " },
		"no discipline":    func(r *pb.TestCreateRequest) { r.Discipline = " " },
		"no topic":         func(r *pb.TestCreateRequest) { r.Topic = " " },
		"no questions":     func(r *pb.TestCreateRequest) { r.Questions = nil },
		"no question text": func(r *pb.TestCreateRequest) { r.Questions[0].Text = "" },
		"one answer":       func(r *pb.TestCreateRequest) { r.Questions[0].Answers = r.Questions[0].Answers[1:2] },
		"empty answer":     func(r *pb.TestCreateRequest) { r.Questions[0].Answers[0].Text = "  " },
		"nothing correct":  func(r *pb.TestCreateRequest) { r.Questions[0].Answers[1].IsCorrect = false },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			req := anatomyTest()
			mutate(req)
			_, err := h.TestCreate(ctx, connect.NewRequest(req))
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("expected InvalidArgument, got %v", err)
			}
		})
	}

	// Several correct answers are allowed.
	req := anatomyTest()
	req.Questions[0].Answers[0].IsCorrect = true
	if _, err := h.TestCreate(ctx, connect.NewRequest(req)); err != nil {
		t.Fatal(err)
	}
}

func TestTestUnavailableWithoutDatabase(t *testing.T) {
	h := TestNewController(nil)
	_, err := h.TestFetch(context.Background(), connect.NewRequest(&pb.TestFetchRequest{}))
	if connect.CodeOf(err) != connect.CodeUnavailable {
		t.Fatalf("expected Unavailable without a test database, got %v", err)
	}
}

func TestTestExport(t *testing.T) {
	ctx := context.Background()
	h := newTestTestHandler()

	created, err := h.TestCreate(ctx, connect.NewRequest(anatomyTest()))
	if err != nil {
		t.Fatal(err)
	}
	file, err := h.TestExport(ctx, connect.NewRequest(&pb.TestExportRequest{Id: created.Msg.GetTestId()}))
	if err != nil {
		t.Fatal(err)
	}
	if file.Msg.GetFileName() != "Анатомия_ кости черепа.rtf" || !strings.HasPrefix(string(file.Msg.GetContent()), `{\rtf1`) {
		t.Fatalf("unexpected file %q", file.Msg.GetFileName())
	}

	_, err = h.TestExport(ctx, connect.NewRequest(&pb.TestExportRequest{Id: 999}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound, got %v", err)
	}
}

func TestTestImportParseRejects(t *testing.T) {
	h := newTestTestHandler()
	for name, req := range map[string]*pb.TestImportParseRequest{
		"not docx ext": {FileName: "Т-1.doc", Content: []byte("x")},
		"not a zip":    {FileName: "Т-1.docx", Content: []byte("x")},
	} {
		if _, err := h.TestImportParse(context.Background(), connect.NewRequest(req)); connect.CodeOf(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: expected InvalidArgument, got %v", name, err)
		}
	}
}

func TestTestExportStatus(t *testing.T) {
	ctx := context.Background()
	h := newTestTestHandler()

	created, err := h.TestCreate(ctx, connect.NewRequest(anatomyTest()))
	if err != nil {
		t.Fatal(err)
	}
	id := created.Msg.GetTestId()
	status := func() enum.TestExportStatus {
		got, _ := h.TestByID(ctx, connect.NewRequest(&pb.TestByIDRequest{Id: id}))
		return got.Msg.GetTest().GetExportStatus()
	}
	if status() != enum.TestExportStatus_TEST_EXPORT_STATUS_NOT_EXPORTED {
		t.Fatalf("a new test must be NOT_EXPORTED, got %v", status())
	}

	if _, err := h.TestExportStatusUpdate(ctx, connect.NewRequest(&pb.TestExportStatusUpdateRequest{
		Id: id, ExportStatus: enum.TestExportStatus_TEST_EXPORT_STATUS_EXPORTED,
	})); err != nil {
		t.Fatal(err)
	}
	if status() != enum.TestExportStatus_TEST_EXPORT_STATUS_EXPORTED {
		t.Fatalf("expected EXPORTED, got %v", status())
	}

	_, err = h.TestExportStatusUpdate(ctx, connect.NewRequest(&pb.TestExportStatusUpdateRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("UNSPECIFIED must be InvalidArgument, got %v", err)
	}
	_, err = h.TestExportStatusUpdate(ctx, connect.NewRequest(&pb.TestExportStatusUpdateRequest{
		Id: 999, ExportStatus: enum.TestExportStatus_TEST_EXPORT_STATUS_READY,
	}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound, got %v", err)
	}
}
