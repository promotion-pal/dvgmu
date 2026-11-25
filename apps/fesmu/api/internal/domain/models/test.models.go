package models

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
)

var (
	ErrTestNotFound = errors.New("test not found")
	// ErrTestInvalid wraps every validation failure; the message says which rule broke.
	ErrTestInvalid = errors.New("invalid test")
	// ErrTestImportInvalid: the uploaded file couldn't be read as a test.
	ErrTestImportInvalid = errors.New("не удалось импортировать файл")
)

const (
	testMaxQuestions = 500
	testMinAnswers   = 2
	testMaxAnswers   = 30
)

// Test is a staff-built test: a topic and its questions. Lives in its own
// database (test_db), apart from the infrastructure tables.
type Test struct {
	ExamSettings ExamV2Settings `gorm:"type:jsonb;serializer:json;not null;default:'{}'"`
	ID           int64          `gorm:"primaryKey;autoIncrement"`

	Department   string                `gorm:"size:255;not null;default:'';index"`
	Discipline   string                `gorm:"size:255;not null;default:'';index"`
	Semester     int                   `gorm:"not null;default:0;index"`
	ExportStatus enum.TestExportStatus `gorm:"type:smallint;not null;default:1;index"`
	// V1 — a bank of questions; V2 — right and wrong answers mixed per student.
	Version     enum.TestVersion `gorm:"type:smallint;not null;default:1"`
	Topic       string           `gorm:"size:255;not null;index"`
	Description string           `gorm:"size:1024;not null;default:''"`

	Questions []TestQuestion `gorm:"foreignKey:TestID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

// TestQuestion belongs to one test; Position keeps the order it was entered in.
type TestQuestion struct {
	ID       int64  `gorm:"primaryKey;autoIncrement"`
	TestID   int64  `gorm:"not null;index"`
	Position int    `gorm:"not null"`
	Text     string `gorm:"type:text;not null"`
	// The picture's hash (TestImage), its size in pixels; empty — none.
	Image       string `gorm:"size:64;not null;default:''"`
	ImageWidth  int    `gorm:"not null;default:0"`
	ImageHeight int    `gorm:"not null;default:0"`

	// V1's options. A V2 test keeps its answers in AnswersV2 instead; in
	// memory both read as Answers (see LoadAnswers).
	Answers   []TestAnswer   `gorm:"foreignKey:QuestionID;constraint:OnDelete:CASCADE"`
	AnswersV2 []TestV2Answer `gorm:"foreignKey:QuestionID;constraint:OnDelete:CASCADE"`
}

// TestAnswer is one answer option of a question; at least one per question is correct.
type TestAnswer struct {
	ID         int64  `gorm:"primaryKey;autoIncrement"`
	QuestionID int64  `gorm:"not null;index"`
	Position   int    `gorm:"not null"`
	Text       string `gorm:"type:text;not null"`
	IsCorrect  bool   `gorm:"not null;default:false"`
}

// TestV2Answer: a right or wrong answer of a V2 test's question, in a table
// of its own (test_v2_answers), apart from V1's options; the question, its
// topic and picture are shared with V1 (test_questions).
type TestV2Answer struct {
	ID         int64  `gorm:"primaryKey;autoIncrement"`
	QuestionID int64  `gorm:"not null;index"`
	Position   int    `gorm:"not null"`
	Text       string `gorm:"type:text;not null"`
	IsCorrect  bool   `gorm:"not null;default:false"`
}

func (TestV2Answer) TableName() string { return "test_v2_answers" }

// StoreAnswers puts a V2 test's answers where they are kept, AnswersV2;
// a V1 test keeps them in Answers.
func (t *Test) StoreAnswers() {
	if t.Version != enum.TestVersion_TEST_VERSION_V2 {
		return
	}
	for i := range t.Questions {
		q := &t.Questions[i]
		q.AnswersV2 = make([]TestV2Answer, 0, len(q.Answers))
		for _, a := range q.Answers {
			q.AnswersV2 = append(q.AnswersV2, TestV2Answer{ID: a.ID, QuestionID: a.QuestionID, Position: a.Position, Text: a.Text, IsCorrect: a.IsCorrect})
		}
		q.Answers = nil
	}
}

// LoadAnswers: the reverse of StoreAnswers — a V2 test's answers read as
// Answers, so sessions, export and the API don't tell the versions apart.
func (t *Test) LoadAnswers() {
	if t.Version != enum.TestVersion_TEST_VERSION_V2 {
		return
	}
	for i := range t.Questions {
		q := &t.Questions[i]
		q.Answers = make([]TestAnswer, 0, len(q.AnswersV2))
		for _, a := range q.AnswersV2 {
			q.Answers = append(q.Answers, TestAnswer{ID: a.ID, QuestionID: a.QuestionID, Position: a.Position, Text: a.Text, IsCorrect: a.IsCorrect})
		}
		q.AnswersV2 = nil
	}
}

func (t *Test) ToProto() *entity.Test {
	questions := make([]*entity.TestQuestion, 0, len(t.Questions))
	for _, q := range t.Questions {
		answers := make([]*entity.TestAnswer, 0, len(q.Answers))
		for _, a := range q.Answers {
			answers = append(answers, &entity.TestAnswer{Id: a.ID, Text: a.Text, IsCorrect: a.IsCorrect})
		}
		questions = append(questions, &entity.TestQuestion{
			Id: q.ID, Text: q.Text, Answers: answers,
			Image: q.Image, ImageWidth: int32(q.ImageWidth), ImageHeight: int32(q.ImageHeight),
		})
	}

	return &entity.Test{
		Id:           t.ID,
		Department:   t.Department,
		Discipline:   t.Discipline,
		Semester:     int32(t.Semester),
		ExportStatus: t.ExportStatus,
		Version:      t.Version,
		Topic:        t.Topic,
		Description:  t.Description,
		Questions:    questions,
		CreatedAt:    timestamppb.New(t.CreatedAt),
		UpdatedAt:    timestamppb.New(t.UpdatedAt),
	}
}

// TestFilter narrows the list; an empty Topic means "any".
type TestFilter struct {
	Topic string
}

type TestParams struct {
	Department  string
	Discipline  string
	Semester    int
	Topic       string
	Description string
	// Unspecified — V1.
	Version   enum.TestVersion
	Questions []TestQuestionParams
}

type TestQuestionParams struct {
	// A TestImage hash; its size is filled in by SetImageSizes.
	Image   string
	Text    string
	Answers []TestAnswerParams
}

type TestAnswerParams struct {
	Text      string
	IsCorrect bool
}

// NewTest builds a valid test from params; positions follow the order given.
func NewTest(params TestParams, now time.Time) (*Test, error) {
	t := &Test{
		Department:   strings.Join(strings.Fields(params.Department), " "),
		Discipline:   strings.Join(strings.Fields(params.Discipline), " "),
		Semester:     params.Semester,
		ExportStatus: enum.TestExportStatus_TEST_EXPORT_STATUS_NOT_EXPORTED,
		Version:      params.Version,
		Topic:        strings.TrimSpace(params.Topic),
		Description:  strings.TrimSpace(params.Description),
		Questions:    make([]TestQuestion, 0, len(params.Questions)),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	for qi, qp := range params.Questions {
		q := TestQuestion{
			Position: qi + 1,
			Image:    strings.TrimSpace(qp.Image),
			Text:     strings.TrimSpace(qp.Text),
			Answers:  make([]TestAnswer, 0, len(qp.Answers)),
		}
		for ai, ap := range qp.Answers {
			q.Answers = append(q.Answers, TestAnswer{
				Position:  ai + 1,
				Text:      strings.TrimSpace(ap.Text),
				IsCorrect: ap.IsCorrect,
			})
		}
		t.Questions = append(t.Questions, q)
	}

	if err := t.Validate(); err != nil {
		return nil, err
	}
	return t, nil
}

func (t *Test) Validate() error {
	if t.Department == "" {
		return testInvalid("укажите кафедру")
	}
	if len([]rune(t.Department)) > 255 {
		return testInvalid("название кафедры длиннее 255 символов")
	}
	if t.Discipline == "" {
		return testInvalid("укажите дисциплину")
	}
	if len([]rune(t.Discipline)) > 255 {
		return testInvalid("название дисциплины длиннее 255 символов")
	}
	if t.Version == enum.TestVersion_TEST_VERSION_UNSPECIFIED {
		t.Version = enum.TestVersion_TEST_VERSION_V1
	}
	if t.Version != enum.TestVersion_TEST_VERSION_V1 && t.Version != enum.TestVersion_TEST_VERSION_V2 {
		return testInvalid("неизвестная версия теста")
	}
	if t.Topic == "" {
		return testInvalid("укажите тему теста")
	}
	if len([]rune(t.Topic)) > 255 {
		return testInvalid("тема теста длиннее 255 символов")
	}
	if len([]rune(t.Description)) > 1024 {
		return testInvalid("описание длиннее 1024 символов")
	}
	if len(t.Questions) == 0 {
		return testInvalid("добавьте хотя бы один вопрос")
	}
	if len(t.Questions) > testMaxQuestions {
		return testInvalid(fmt.Sprintf("не больше %d вопросов в одном тесте", testMaxQuestions))
	}

	for _, q := range t.Questions {
		if q.Text == "" {
			return testInvalid(fmt.Sprintf("вопрос %d: укажите текст вопроса", q.Position))
		}
		if len(q.Answers) < testMinAnswers {
			return testInvalid(fmt.Sprintf("вопрос %d: нужно хотя бы %d варианта ответа", q.Position, testMinAnswers))
		}
		if len(q.Answers) > testMaxAnswers {
			return testInvalid(fmt.Sprintf("вопрос %d: не больше %d вариантов ответа", q.Position, testMaxAnswers))
		}
		correct := 0
		for _, a := range q.Answers {
			if a.Text == "" {
				return testInvalid(fmt.Sprintf("вопрос %d, вариант %d: укажите текст ответа", q.Position, a.Position))
			}
			if a.IsCorrect {
				correct++
			}
		}
		if correct == 0 {
			return testInvalid(fmt.Sprintf("вопрос %d: отметьте верный вариант ответа", q.Position))
		}
	}
	return nil
}

func testInvalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrTestInvalid, msg)
}

// ValidTestExportStatus: only the named statuses may be set, not UNSPECIFIED.
func ValidTestExportStatus(status enum.TestExportStatus) error {
	switch status {
	case enum.TestExportStatus_TEST_EXPORT_STATUS_NOT_EXPORTED,
		enum.TestExportStatus_TEST_EXPORT_STATUS_READY,
		enum.TestExportStatus_TEST_EXPORT_STATUS_EXPORTED:
		return nil
	}
	return testInvalid("неизвестный статус выгрузки")
}

const testImageMaxBytes = 5 << 20

var testImageHash = regexp.MustCompile(`^[0-9a-f]{64}$`)

// TestImage registers a question's picture, stored once whatever number of
// questions show it: its key is the SHA-256 of the file. The file itself is
// kept by the files service (FILE_TYPE_TEST_IMAGE, folder tests/images).
type TestImage struct {
	Hash      string `gorm:"primaryKey;size:64"`
	FileID    int64  `gorm:"not null"`
	Mime      string `gorm:"size:32;not null"`
	Width     int    `gorm:"not null"`
	Height    int    `gorm:"not null"`
	CreatedAt time.Time

	// The file's bytes while it is being stored or served; not a column.
	Data []byte `gorm:"-"`
}

// FileName: the name the picture is stored under, e.g. "<hash>.jpg".
func (img *TestImage) FileName() string {
	if img.Mime == "image/png" {
		return img.Hash + ".png"
	}
	return img.Hash + ".jpg"
}

// NewTestImage checks a picture file: JPEG or PNG, up to 5 MB, readable.
func NewTestImage(data []byte, now time.Time) (*TestImage, error) {
	if len(data) == 0 {
		return nil, testInvalid("пустой файл картинки")
	}
	if len(data) > testImageMaxBytes {
		return nil, testInvalid("картинка больше 5 МБ")
	}
	mime := http.DetectContentType(data)
	if mime != "image/jpeg" && mime != "image/png" {
		return nil, testInvalid("картинка должна быть в формате JPEG или PNG")
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width == 0 || cfg.Height == 0 {
		return nil, testInvalid("не удалось прочитать картинку")
	}
	sum := sha256.Sum256(data)
	return &TestImage{Hash: hex.EncodeToString(sum[:]), Mime: mime, Width: cfg.Width, Height: cfg.Height, Data: data, CreatedAt: now}, nil
}

// SetImageSizes checks every question's picture is a stored one and copies
// its size onto the question; sizes holds the stored pictures by hash.
func (t *Test) SetImageSizes(sizes map[string]*TestImage) error {
	for i := range t.Questions {
		q := &t.Questions[i]
		if q.Image == "" {
			q.ImageWidth, q.ImageHeight = 0, 0
			continue
		}
		img, ok := sizes[q.Image]
		if !testImageHash.MatchString(q.Image) || !ok {
			return testInvalid(fmt.Sprintf("вопрос %d: картинка не найдена — загрузите её заново", q.Position))
		}
		q.ImageWidth, q.ImageHeight = img.Width, img.Height
	}
	return nil
}

// ImageHashes: the distinct pictures the test's questions show.
func (t *Test) ImageHashes() []string {
	var out []string
	for _, q := range t.Questions {
		if q.Image != "" && !slices.Contains(out, q.Image) {
			out = append(out, q.Image)
		}
	}
	return out
}
