package grpc

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"connectrpc.com/connect"

	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

type memoryTestSessionStorage struct {
	nextID   int64
	sessions map[int64]*models.TestSession
	attempts map[int64]*models.TestAttempt
}

func (m *memoryTestSessionStorage) TestSessionFetch(_ context.Context, testID int64) ([]*models.TestSession, error) {
	out := []*models.TestSession{}
	for _, s := range m.sessions {
		if testID == 0 || (s.TestID != nil && *s.TestID == testID) {
			out = append(out, s)
		}
	}
	return out, nil
}

func (m *memoryTestSessionStorage) TestSessionByID(_ context.Context, id int64) (*models.TestSession, error) {
	if s, ok := m.sessions[id]; ok {
		return s, nil
	}
	return nil, models.ErrTestSessionNotFound
}

func (m *memoryTestSessionStorage) TestSessionByToken(_ context.Context, token string) (*models.TestSession, error) {
	for _, s := range m.sessions {
		if s.Token == token {
			return s, nil
		}
	}
	return nil, models.ErrTestSessionNotFound
}

func (m *memoryTestSessionStorage) TestSessionCreate(_ context.Context, s *models.TestSession) (int64, error) {
	m.nextID++
	s.ID = m.nextID
	m.sessions[s.ID] = s
	return s.ID, nil
}

func (m *memoryTestSessionStorage) TestSessionOpenUpdate(_ context.Context, id int64, open bool) error {
	s, ok := m.sessions[id]
	if !ok {
		return models.ErrTestSessionNotFound
	}
	s.IsOpen = open
	return nil
}

func (m *memoryTestSessionStorage) TestSessionDelete(_ context.Context, id int64) error {
	if _, ok := m.sessions[id]; !ok {
		return models.ErrTestSessionNotFound
	}
	delete(m.sessions, id)
	return nil
}

func (m *memoryTestSessionStorage) TestAttemptCreate(_ context.Context, a *models.TestAttempt) (int64, error) {
	m.nextID++
	a.ID = m.nextID
	m.attempts[a.ID] = a
	return a.ID, nil
}

func (m *memoryTestSessionStorage) TestAttemptFetch(_ context.Context, sessionID int64) ([]*models.TestAttempt, error) {
	out := []*models.TestAttempt{}
	for _, a := range m.attempts {
		if a.SessionID == sessionID {
			out = append(out, a)
		}
	}
	return out, nil
}

func (m *memoryTestSessionStorage) TestAttemptUpdate(
	_ context.Context,
	token string,
	change func(*models.TestAttempt, *models.TestSession) error,
) (*models.TestAttempt, *models.TestSession, error) {
	for _, a := range m.attempts {
		if a.Token != token {
			continue
		}
		copied := *a
		session := m.sessions[a.SessionID]
		if err := change(&copied, session); err != nil {
			return nil, nil, err
		}
		*a = copied
		return a, session, nil
	}
	return nil, nil, models.ErrTestAttemptNotFound
}

func (m *memoryTestSessionStorage) TestAttemptFinalize(_ context.Context, _ *models.TestAttempt) error {
	return nil
}

func (m *memoryTestSessionStorage) TestAttemptDelete(_ context.Context, id int64) error {
	if _, ok := m.attempts[id]; !ok {
		return models.ErrTestAttemptNotFound
	}
	delete(m.attempts, id)
	return nil
}

func newTestSessionHandlers() (*TestHandler, *TestSessionHandler) {
	tests := &memoryTestStorage{tests: map[int64]*models.Test{}}
	sessions := &memoryTestSessionStorage{sessions: map[int64]*models.TestSession{}, attempts: map[int64]*models.TestAttempt{}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return TestNewController(service.NewTestService(log, tests, tests, tests, &memoryFiles{})),
		TestSessionNewController(service.NewTestSessionService(log, sessions, tests))
}

func TestTestSessionTakeFlow(t *testing.T) {
	ctx := context.Background()
	testHandler, h := newTestSessionHandlers()

	created, err := testHandler.TestCreate(ctx, connect.NewRequest(anatomyTest()))
	if err != nil {
		t.Fatal(err)
	}
	// The memory test store hands out no question/answer ids; give them some.
	stored, _ := testHandler.service.TestByID(ctx, created.Msg.GetTestId())
	for qi := range stored.Questions {
		stored.Questions[qi].ID = int64(qi + 1)
		for ai := range stored.Questions[qi].Answers {
			stored.Questions[qi].Answers[ai].ID = int64((qi+1)*10 + ai)
		}
	}

	session, err := h.TestSessionCreate(ctx, connect.NewRequest(&pb.TestSessionCreateRequest{
		TestId: created.Msg.GetTestId(), DurationMinutes: 15, ShowResult: true, Note: "Л-101",
	}))
	if err != nil {
		t.Fatal(err)
	}
	token := session.Msg.GetSession().GetToken()
	if len(token) < 20 {
		t.Fatalf("expected a long random token, got %q", token)
	}

	info, err := h.TestTakeInfo(ctx, connect.NewRequest(&pb.TestTakeInfoRequest{Token: token}))
	if err != nil {
		t.Fatal(err)
	}
	if !info.Msg.GetIsOpen() || info.Msg.GetDurationMinutes() != 15 || info.Msg.GetQuestionCount() != 1 {
		t.Fatalf("unexpected info %v", info.Msg)
	}

	started, err := h.TestTakeStart(ctx, connect.NewRequest(&pb.TestTakeStartRequest{Token: token, FullName: "Иванов Иван", StudentGroup: "Л-101"}))
	if err != nil {
		t.Fatal(err)
	}
	attemptToken := started.Msg.GetAttemptToken()
	questions := started.Msg.GetQuestions()
	// Every question takes several picks, even with one right option.
	if len(questions) != 1 || len(questions[0].GetAnswers()) != 3 || !questions[0].GetMultiple() {
		t.Fatalf("expected the one question with 3 options taking several picks, got %v", questions)
	}

	// Editing the test after the session was made must not change the session.
	stored.Questions[0].Answers[0].IsCorrect = true

	// "8" (the second option) is the correct one.
	right := questions[0].GetAnswers()[1].GetId()
	if _, err := h.TestTakeAnswer(ctx, connect.NewRequest(&pb.TestTakeAnswerRequest{
		AttemptToken: attemptToken, QuestionId: questions[0].GetId(), AnswerIds: []int64{right},
	})); err != nil {
		t.Fatal(err)
	}

	resumed, err := h.TestTakeState(ctx, connect.NewRequest(&pb.TestTakeStateRequest{AttemptToken: attemptToken}))
	if err != nil {
		t.Fatal(err)
	}
	if saved := resumed.Msg.GetAnswers(); len(saved) != 1 || saved[0].GetAnswerIds()[0] != right || saved[0].GetIsCorrect() {
		t.Fatalf("expected the saved answer back without grading, got %v", saved)
	}

	finished, err := h.TestTakeFinish(ctx, connect.NewRequest(&pb.TestTakeFinishRequest{AttemptToken: attemptToken}))
	if err != nil {
		t.Fatal(err)
	}
	if finished.Msg.GetStatus() != enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED ||
		finished.Msg.GetScore() != 1 || finished.Msg.GetTotal() != 1 || len(finished.Msg.GetQuestions()) != 0 {
		t.Fatalf("expected finished 1/1 without questions, got %v", finished.Msg)
	}

	_, err = h.TestTakeAnswer(ctx, connect.NewRequest(&pb.TestTakeAnswerRequest{
		AttemptToken: attemptToken, QuestionId: questions[0].GetId(), AnswerIds: []int64{right},
	}))
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("expected FailedPrecondition answering a finished attempt, got %v", err)
	}

	results, err := h.TestAttemptFetch(ctx, connect.NewRequest(&pb.TestAttemptFetchRequest{SessionId: session.Msg.GetSession().GetId()}))
	if err != nil {
		t.Fatal(err)
	}
	list := results.Msg.GetList()
	if len(list) != 1 || list[0].GetFullName() != "Иванов Иван" || list[0].GetScore() != 1 || !list[0].GetAnswers()[0].GetIsCorrect() {
		t.Fatalf("expected the graded attempt in the results, got %v", list)
	}
	if results.Msg.GetSession().GetAttemptCount() != 1 || !results.Msg.GetQuestions()[0].GetAnswers()[1].GetIsCorrect() ||
		results.Msg.GetQuestions()[0].GetAnswers()[0].GetIsCorrect() {
		t.Fatalf("expected staff to see the frozen copy with its correct option, got %v", results.Msg.GetQuestions())
	}

	if _, err := h.TestSessionOpenUpdate(ctx, connect.NewRequest(&pb.TestSessionOpenUpdateRequest{Id: session.Msg.GetSession().GetId()})); err != nil {
		t.Fatal(err)
	}
	_, err = h.TestTakeStart(ctx, connect.NewRequest(&pb.TestTakeStartRequest{Token: token, FullName: "Петров", StudentGroup: "Л-101"}))
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("expected a closed session to refuse a new attempt, got %v", err)
	}
}

func TestTestSessionUnknownTokens(t *testing.T) {
	ctx := context.Background()
	_, h := newTestSessionHandlers()

	_, err := h.TestTakeInfo(ctx, connect.NewRequest(&pb.TestTakeInfoRequest{Token: "nope"}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected NotFound for an unknown session, got %v", err)
	}
	_, err = h.TestTakeState(ctx, connect.NewRequest(&pb.TestTakeStateRequest{}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected NotFound for an empty attempt token, got %v", err)
	}
	_, err = h.TestSessionCreate(ctx, connect.NewRequest(&pb.TestSessionCreateRequest{TestId: 99, DurationMinutes: 10}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected NotFound for a session of an unknown test, got %v", err)
	}
}

// A question's picture: uploaded once (the same file again gives the same id,
// stored once), kept on the question with its size, copied into a session
// and shown to the student; served by GET /test-images/{hash}.
func TestTestImageFlow(t *testing.T) {
	ctx := context.Background()
	tests := &memoryTestStorage{tests: map[int64]*models.Test{}}
	files := &memoryFiles{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	testHandler := TestNewController(service.NewTestService(log, tests, tests, tests, files))
	sessionHandler := TestSessionNewController(service.NewTestSessionService(log,
		&memoryTestSessionStorage{sessions: map[int64]*models.TestSession{}, attempts: map[int64]*models.TestAttempt{}}, tests))

	var buf bytes.Buffer
	png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 40, 20)))
	up, err := testHandler.TestImageUpload(ctx, connect.NewRequest(&pb.TestImageUploadRequest{Content: buf.Bytes()}))
	if err != nil {
		t.Fatal(err)
	}
	again, _ := testHandler.TestImageUpload(ctx, connect.NewRequest(&pb.TestImageUploadRequest{Content: buf.Bytes()}))
	if up.Msg.GetImage() != again.Msg.GetImage() || len(files.files) != 1 || up.Msg.GetWidth() != 40 || up.Msg.GetHeight() != 20 {
		t.Fatalf("the same picture must be stored once with its size: %v, %d files", up.Msg, len(files.files))
	}
	if files.names[0] != up.Msg.GetImage()+".png" {
		t.Errorf("stored as %q", files.names[0])
	}
	if _, err := testHandler.TestImageUpload(ctx, connect.NewRequest(&pb.TestImageUploadRequest{Content: []byte("GIF89a....")})); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("a GIF must be refused, got %v", err)
	}

	question := func(img string) *pb.TestQuestionInput {
		return &pb.TestQuestionInput{Text: "Показания ДП-5В", Image: img, Answers: []*pb.TestAnswerInput{{Text: "норма", IsCorrect: true}, {Text: "опасно"}}}
	}
	if _, err := testHandler.TestCreate(ctx, connect.NewRequest(&pb.TestCreateRequest{
		Department: "К", Discipline: "Д", Topic: "Т", Questions: []*pb.TestQuestionInput{question(strings.Repeat("0", 64))},
	})); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("an unknown picture must be refused, got %v", err)
	}
	created, err := testHandler.TestCreate(ctx, connect.NewRequest(&pb.TestCreateRequest{
		Department: "К", Discipline: "Д", Topic: "Т", Questions: []*pb.TestQuestionInput{question(up.Msg.GetImage())},
	}))
	if err != nil {
		t.Fatal(err)
	}
	got, _ := testHandler.TestByID(ctx, connect.NewRequest(&pb.TestByIDRequest{Id: created.Msg.GetTestId()}))
	if q := got.Msg.GetTest().GetQuestions()[0]; q.GetImage() != up.Msg.GetImage() || q.GetImageWidth() != 40 || q.GetImageHeight() != 20 {
		t.Fatalf("the question must keep its picture and size, got %v", q)
	}

	session, err := sessionHandler.TestSessionCreate(ctx, connect.NewRequest(&pb.TestSessionCreateRequest{TestId: created.Msg.GetTestId(), DurationMinutes: 10}))
	if err != nil {
		t.Fatal(err)
	}
	started, err := sessionHandler.TestTakeStart(ctx, connect.NewRequest(&pb.TestTakeStartRequest{Token: session.Msg.GetSession().GetToken(), FullName: "Иванов", StudentGroup: "Л-1"}))
	if err != nil {
		t.Fatal(err)
	}
	if q := started.Msg.GetQuestions()[0]; q.GetImage() != up.Msg.GetImage() || q.GetImageWidth() != 40 {
		t.Fatalf("the student must see the picture, got %v", q)
	}

	mux := http.NewServeMux()
	mux.Handle("GET /test-images/{hash}", testHandler.ImageHTTP())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/test-images/"+up.Msg.GetImage(), nil))
	if rec.Code != 200 || rec.Header().Get("Content-Type") != "image/png" || !bytes.Equal(rec.Body.Bytes(), buf.Bytes()) {
		t.Fatalf("serving the picture: %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/test-images/"+strings.Repeat("a", 64), nil))
	if rec.Code != 404 {
		t.Errorf("an unknown picture must be 404, got %d", rec.Code)
	}

	exported, err := testHandler.TestExport(ctx, connect.NewRequest(&pb.TestExportRequest{Id: created.Msg.GetTestId()}))
	if err != nil || !strings.Contains(string(exported.Msg.GetContent()), `\pngblip\picw40\pich20`) {
		t.Fatalf("the RTF must carry the picture: %v", err)
	}
}
