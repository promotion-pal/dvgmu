package models

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
)

var (
	ErrTestSessionNotFound = errors.New("сессия тестирования не найдена")
	// ErrTestSessionClosed: the link takes no new attempts.
	ErrTestSessionClosed = errors.New("приём ответов по этой ссылке закрыт")
	// ErrTestSessionNotOpenYet: the session's opening time is still ahead.
	ErrTestSessionNotOpenYet = errors.New("тест ещё не открыт — начать можно со времени открытия")
	ErrTestAttemptNotFound   = errors.New("попытка не найдена")
	// ErrTestAttemptOver: the attempt is finished or its time is up.
	ErrTestAttemptOver = errors.New("время на тест истекло")
)

const (
	testSessionMaxMinutes = 600
	testSessionMaxNote    = 255
	testSessionMaxOptions = 30

	// testSessionPickVersion is how attempts of new sessions pick questions
	// (see AttemptQuestions). Sessions keep the version they were made with,
	// so attempts already started or graded never change their questions.
	//   0 — every question of the test separately;
	//   1 — questions with the same text are variants of one question: an
	//       attempt asks it once, with one random variant; OptionCount
	//       mixes a random set of options per student;
	//   2 — as 1, but texts compare by letters and digits only, so variants
	//       typed with another dash, colon or quotes ("- это:", "— это:",
	//       "это:") are still one question;
	//   3 — as 2 for V2 tests; a V1 test asks every question it has, each
	//       on its own, however alike their texts.
	testSessionPickVersion = 3
	testAttemptMaxName     = 255
	testAttemptMaxGroup    = 64
	// TestAttemptGrace covers the network: an answer sent at the last second
	// still counts.
	TestAttemptGrace = 30 * time.Second
)

// TestSession hands a test out to students by a link (Token). It keeps a
// frozen copy of the questions, so editing or deleting the test later
// doesn't change what the students were asked or how they were graded.
type TestSession struct {
	ExamSettings ExamV2Settings `gorm:"type:jsonb;serializer:json;not null;default:'{}'"`
	ID           int64          `gorm:"primaryKey;autoIncrement"`

	// nil once the test was deleted.
	TestID *int64 `gorm:"index"`
	Test   *Test  `gorm:"foreignKey:TestID;constraint:OnDelete:SET NULL"`

	Token       string `gorm:"size:64;not null;uniqueIndex"`
	Topic       string `gorm:"size:255;not null"`
	Department  string `gorm:"size:255;not null;default:''"`
	Description string `gorm:"size:1024;not null;default:''"`
	Note        string `gorm:"size:255;not null;default:''"`

	DurationMinutes int  `gorm:"not null"`
	QuestionCount   int  `gorm:"not null;default:0"`
	Shuffle         bool `gorm:"not null;default:false"`
	ShowResult      bool `gorm:"not null;default:false"`
	IsOpen          bool `gorm:"not null;default:true"`
	// Options shown per question, V2 only; 0 = all.
	OptionCount int `gorm:"not null;default:0"`
	PickVersion int `gorm:"not null;default:0"`
	// The test's version when the session was made (see AttemptQuestions).
	Version enum.TestVersion `gorm:"type:smallint;not null;default:1"`
	// Distinct questions (variants counted once), stored for the list.
	DistinctQuestions int        `gorm:"not null;default:0"`
	OpensAt           *time.Time `gorm:""`
	ClosesAt          *time.Time `gorm:""`

	Questions     []TestSnapshotQuestion `gorm:"type:jsonb;serializer:json;not null"`
	Audience      ExamAudience           `gorm:"type:jsonb;serializer:json;not null;default:'{}'"`
	Assignments   []ExamAssignment       `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE"`
	AssignedCount int                    `gorm:"->;-:migration"`
	Attempts      []TestAttempt          `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE"`

	// Counted by the list query, not stored.
	AttemptCount   int `gorm:"->;-:migration"`
	TotalQuestions int `gorm:"->;-:migration"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

type TestSnapshotQuestion struct {
	ID          int64                `json:"id"`
	Text        string               `json:"text"`
	Image       string               `json:"image,omitempty"`
	ImageWidth  int                  `json:"image_width,omitempty"`
	ImageHeight int                  `json:"image_height,omitempty"`
	Answers     []TestSnapshotAnswer `json:"answers"`
	// Set per attempt, never stored: since pick version 1 every question
	// takes several picks (checkboxes), so their number gives nothing away.
	Multiple bool `json:"-"`
}

type TestSnapshotAnswer struct {
	ID        int64  `json:"id"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

// TestAttempt is one student's run through a session. Seed fixes which
// questions they got and in what order, so it never has to be stored.
type TestAttempt struct {
	InstructionAcceptedAt *time.Time
	Events                []TestAttemptEvent `gorm:"type:jsonb;serializer:json"`
	ID                    int64              `gorm:"primaryKey;autoIncrement"`
	SessionID             int64              `gorm:"not null;index"`

	// The student's key to the attempt; no login is involved.
	Token        string `gorm:"size:64;not null;uniqueIndex"`
	FullName     string `gorm:"size:255;not null"`
	StudentGroup string `gorm:"size:64;not null;default:''"`
	MDMUserUUID  string `gorm:"size:36;not null;default:''"`
	Seed         int64  `gorm:"not null"`

	Status  enum.TestAttemptStatus `gorm:"type:smallint;not null;default:1"`
	Answers []TestAttemptAnswer    `gorm:"type:jsonb;serializer:json;not null"`
	Score   int                    `gorm:"not null;default:0"`
	Total   int                    `gorm:"not null;default:0"`

	StartedAt  time.Time `gorm:"not null"`
	Deadline   time.Time `gorm:"not null"`
	FinishedAt *time.Time
}

type TestAttemptAnswer struct {
	QuestionID int64   `json:"question_id"`
	AnswerIDs  []int64 `json:"answer_ids"`
}

type TestSessionParams struct {
	Audience        ExamAudience
	DurationMinutes int
	QuestionCount   int
	Shuffle         bool
	ShowResult      bool
	Note            string
	// Options shown per question, a random mix of right and wrong; 0 = all.
	// V2 tests only; a V1 test always shows every option.
	OptionCount int
	OpensAt     *time.Time
	ClosesAt    *time.Time
}

// NewTestSession freezes test into a session reachable by token.
func NewTestSession(test *Test, params TestSessionParams, token string, now time.Time) (*TestSession, error) {
	if test.ExamSettings.Enabled && params.QuestionCount != 0 && params.QuestionCount != len(test.Questions) {
		return nil, testInvalid("экзамен V2 выдаётся целиком по структуре разделов; измените квоты и сформируйте новый вариант")
	}

	s := &TestSession{
		TestID:          &test.ID,
		ExamSettings:    test.ExamSettings,
		Audience:        params.Audience,
		Token:           token,
		Topic:           test.Topic,
		Department:      test.Department,
		Description:     test.Description,
		Note:            strings.Join(strings.Fields(params.Note), " "),
		DurationMinutes: params.DurationMinutes,
		QuestionCount:   params.QuestionCount,
		Shuffle:         params.Shuffle,
		ShowResult:      params.ShowResult,
		IsOpen:          true,
		OptionCount:     params.OptionCount,
		PickVersion:     testSessionPickVersion,
		Version:         test.Version,
		OpensAt:         params.OpensAt,
		ClosesAt:        params.ClosesAt,
		Questions:       make([]TestSnapshotQuestion, 0, len(test.Questions)),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	for _, q := range test.Questions {
		answers := make([]TestSnapshotAnswer, 0, len(q.Answers))
		for _, a := range q.Answers {
			answers = append(answers, TestSnapshotAnswer{ID: a.ID, Text: a.Text, IsCorrect: a.IsCorrect})
		}
		s.Questions = append(s.Questions, TestSnapshotQuestion{
			ID: q.ID, Text: q.Text, Answers: answers,
			Image: q.Image, ImageWidth: q.ImageWidth, ImageHeight: q.ImageHeight,
		})
	}
	if s.Version != enum.TestVersion_TEST_VERSION_V2 {
		s.Version = enum.TestVersion_TEST_VERSION_V1
		s.OptionCount = 0
	}
	s.DistinctQuestions = len(s.questionGroups())
	s.TotalQuestions = s.QuestionTotal()

	if s.DurationMinutes < 1 || s.DurationMinutes > testSessionMaxMinutes {
		return nil, testInvalid(fmt.Sprintf("время на прохождение — от 1 до %d минут", testSessionMaxMinutes))
	}
	if len(s.Questions) == 0 {
		return nil, testInvalid("в тесте нет вопросов")
	}
	if s.QuestionCount < 0 || s.QuestionCount > s.TotalQuestions {
		return nil, testInvalid(fmt.Sprintf("число вопросов — от 1 до %d (0 — все)", s.TotalQuestions))
	}
	if s.QuestionCount == s.TotalQuestions {
		s.QuestionCount = 0
	}
	if s.OptionCount != 0 && (s.OptionCount < 2 || s.OptionCount > testSessionMaxOptions) {
		return nil, testInvalid(fmt.Sprintf("вариантов ответа в вопросе — от 2 до %d (0 — все)", testSessionMaxOptions))
	}
	if len([]rune(s.Note)) > testSessionMaxNote {
		return nil, testInvalid(fmt.Sprintf("комментарий длиннее %d символов", testSessionMaxNote))
	}
	if s.ClosesAt != nil && !s.ClosesAt.After(now) {
		return nil, testInvalid("дата закрытия уже прошла")
	}
	if s.OpensAt != nil && s.ClosesAt != nil && !s.ClosesAt.After(*s.OpensAt) {
		return nil, testInvalid("закрытие должно быть позже открытия")
	}
	return s, nil
}

// Open: the link takes new attempts — opened, not closed by hand or by time.
func (s *TestSession) Open(now time.Time) bool {
	return s.IsOpen && !s.NotOpenYet(now) && (s.ClosesAt == nil || now.Before(*s.ClosesAt))
}

// NotOpenYet: the opening time is still ahead.
func (s *TestSession) NotOpenYet(now time.Time) bool {
	return s.OpensAt != nil && now.Before(*s.OpensAt)
}

// AskedCount is how many questions one attempt gets.
func (s *TestSession) AskedCount() int {
	if s.QuestionCount > 0 {
		return s.QuestionCount
	}
	return s.TotalQuestions
}

// QuestionTotal is how many questions the session can ask: since version 1
// variants of one question (the same text) count once.
func (s *TestSession) QuestionTotal() int {
	if s.PickVersion >= 1 {
		if s.DistinctQuestions > 0 || len(s.Questions) == 0 {
			return s.DistinctQuestions
		}
		return len(s.questionGroups())
	}
	return len(s.Questions)
}

// questionGroups: indexes of the frozen questions, variants of one question
// (see QuestionKey) together, in the order first seen. Since pick version 3
// a V1 test's questions are each a group of one: it asks what was added.
func (s *TestSession) questionGroups() [][]int {
	var groups [][]int
	if s.PickVersion >= 3 && !s.mixes() {
		for i := range s.Questions {
			groups = append(groups, []int{i})
		}
		return groups
	}
	byText := map[string]int{}
	for i, q := range s.Questions {
		key := strings.ToLower(strings.Join(strings.Fields(q.Text), " "))
		if s.PickVersion >= 2 {
			key = QuestionKey(q.Text)
		}
		g, ok := byText[key]
		if !ok {
			g = len(groups)
			byText[key] = g
			groups = append(groups, nil)
		}
		groups[g] = append(groups[g], i)
	}
	return groups
}

// QuestionKey: what makes two questions variants of one — their letters and
// digits, case and "ё/е" aside. Punctuation, dashes, quotes and spacing don't
// count; a word more or less does ("…интоксикацию — это" ≠ "…гибель — это").
func QuestionKey(text string) string {
	var b strings.Builder
	space := false
	for _, r := range strings.ToLower(text) {
		if r == 'ё' {
			r = 'е'
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if space && b.Len() > 0 {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			space = false
		} else {
			space = true
		}
	}
	return b.String()
}

// AttemptQuestions picks the questions an attempt with seed gets. The same
// seed always gives the same list, so it is recomputed, never stored.
//
// Version 0: a random QuestionCount of the questions (all when 0), with
// Shuffle the questions and their options in random order.
//
// Version 1: as version 0, but over distinct questions — one with several
// variants (same text) is asked once, as a random one of them. Then by the
// test's version:
//   - V1, a bank of questions: every option shown, as written;
//   - V2, right and wrong answers: with OptionCount each question shows a
//     random mix of that many of its options.
//
// Either way every question takes several picks (checkboxes).
func (s *TestSession) AttemptQuestions(seed int64) []TestSnapshotQuestion {
	rng := rand.New(rand.NewPCG(uint64(seed), 0))
	if s.PickVersion < 1 {
		return s.attemptQuestionsV0(rng)
	}

	groups := s.questionGroups()
	order := make([]int, len(groups))
	for i := range order {
		order[i] = i
	}
	limited := s.QuestionCount > 0 && s.QuestionCount < len(order)
	if s.Shuffle || limited {
		rng.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
	}
	if limited {
		order = order[:s.QuestionCount]
	}
	if !s.Shuffle {
		slices.Sort(order)
	}

	out := make([]TestSnapshotQuestion, 0, len(order))
	for _, g := range order {
		variants := groups[g]
		q := s.Questions[variants[rng.IntN(len(variants))]]
		q.Answers = slices.Clone(q.Answers)
		// Every question, V1 and V2, takes several picks: whether one option
		// or more is right is not given away by radio buttons.
		q.Multiple = true
		mixed := false
		if s.mixes() && s.OptionCount > 0 {
			q.Answers, mixed = mixOptions(rng, q.Answers, s.OptionCount)
		}
		if s.Shuffle || mixed {
			rng.Shuffle(len(q.Answers), func(i, j int) { q.Answers[i], q.Answers[j] = q.Answers[j], q.Answers[i] })
		}
		out = append(out, q)
	}
	return out
}

// mixes: right and wrong answers are mixed per student — a V2 test's session.
// Sessions made before versions (pick version 1 and 2) were all mixed so.
func (s *TestSession) mixes() bool {
	return s.Version == enum.TestVersion_TEST_VERSION_V2
}

func (s *TestSession) attemptQuestionsV0(rng *rand.Rand) []TestSnapshotQuestion {
	order := make([]int, len(s.Questions))
	for i := range order {
		order[i] = i
	}
	if s.Shuffle || (s.QuestionCount > 0 && s.QuestionCount < len(order)) {
		rng.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
	}
	if s.QuestionCount > 0 && s.QuestionCount < len(order) {
		order = order[:s.QuestionCount]
	}
	if !s.Shuffle {
		slices.Sort(order)
	}

	out := make([]TestSnapshotQuestion, 0, len(order))
	for _, i := range order {
		q := s.Questions[i]
		if s.Shuffle {
			q.Answers = slices.Clone(q.Answers)
			rng.Shuffle(len(q.Answers), func(i, j int) { q.Answers[i], q.Answers[j] = q.Answers[j], q.Answers[i] })
		}
		out = append(out, q)
	}
	return out
}

// referringOption: an option about the other options ("нет правильного
// ответа", "верно всё перечисленное") — its truth depends on which options
// are shown, so a question with one is never cut down to a subset.
var referringOption = regexp.MustCompile(`(?i)(нет\s+(правильн|верн)|вс[её]\s+(перечисленн|вышеперечисленн|ответы|вариант|указанн)|верно\s+вс|ни\s+од(ин|ного)|вс[её]\s+верн|оба\s+(ответа|варианта))`)

// mixOptions picks n of options: a random number of the correct ones (at
// least one, and at least one wrong left when there are wrong ones) topped up
// with random wrong ones. Questions with n or fewer options, without a correct
// one, or with a referring option keep all their options; mixed says whether
// a subset was taken.
func mixOptions(rng *rand.Rand, options []TestSnapshotAnswer, n int) (out []TestSnapshotAnswer, mixed bool) {
	if len(options) <= n || slices.ContainsFunc(options, func(o TestSnapshotAnswer) bool { return referringOption.MatchString(o.Text) }) {
		return options, false
	}
	var correct, wrong []TestSnapshotAnswer
	for _, o := range options {
		if o.IsCorrect {
			correct = append(correct, o)
		} else {
			wrong = append(wrong, o)
		}
	}
	if len(correct) == 0 {
		return options, false
	}

	lo, hi := max(1, n-len(wrong)), min(len(correct), n)
	if len(wrong) > 0 {
		hi = min(hi, n-1)
	}
	if hi < lo {
		hi = lo
	}
	k := lo + rng.IntN(hi-lo+1)

	rng.Shuffle(len(correct), func(i, j int) { correct[i], correct[j] = correct[j], correct[i] })
	rng.Shuffle(len(wrong), func(i, j int) { wrong[i], wrong[j] = wrong[j], wrong[i] })
	out = append(slices.Clone(correct[:k]), wrong[:min(len(wrong), n-k)]...)
	return out, true
}

type TestAttemptParams struct {
	InstructionAccepted bool
	RecordBook          string
	MDMUserUUID         string
	FullName            string
	StudentGroup        string
}

// NewTestAttempt starts the clock for one student.
func NewTestAttempt(session *TestSession, params TestAttemptParams, token string, seed int64, now time.Time) (*TestAttempt, error) {
	if session.IsOpen && session.NotOpenYet(now) {
		return nil, ErrTestSessionNotOpenYet
	}
	if !session.Open(now) {
		return nil, ErrTestSessionClosed
	}
	a := &TestAttempt{
		SessionID:    session.ID,
		Token:        token,
		FullName:     strings.Join(strings.Fields(params.FullName), " "),
		StudentGroup: strings.Join(strings.Fields(params.StudentGroup), " "),
		MDMUserUUID:  params.MDMUserUUID,
		Seed:         seed,
		Status:       enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS,
		Answers:      []TestAttemptAnswer{},
		Total:        session.AskedCount(),
		StartedAt:    now,
		Deadline:     now.Add(time.Duration(session.DurationMinutes) * time.Minute),
	}
	if session.ExamSettings.Enabled {
		if !params.InstructionAccepted {
			return nil, testInvalid("подтвердите ознакомление с инструкцией")
		}
		a.InstructionAcceptedAt = &now
		a.Events = []TestAttemptEvent{{At: now, Kind: "instruction_accepted"}, {At: now, Kind: "started"}}
	}
	if a.FullName == "" {
		return nil, testInvalid("укажите ФИО")
	}
	if len([]rune(a.FullName)) > testAttemptMaxName {
		return nil, testInvalid(fmt.Sprintf("ФИО длиннее %d символов", testAttemptMaxName))
	}
	if a.StudentGroup == "" {
		return nil, testInvalid("укажите группу")
	}
	if len([]rune(a.StudentGroup)) > testAttemptMaxGroup {
		return nil, testInvalid(fmt.Sprintf("номер группы длиннее %d символов", testAttemptMaxGroup))
	}
	return a, nil
}

func (a *TestAttempt) InProgress() bool {
	return a.Status == enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS
}

// Expired: still marked in progress, but its time (with the grace) is up.
func (a *TestAttempt) Expired(now time.Time) bool {
	if a.InstructionAcceptedAt != nil {
		return a.InProgress() && !now.Before(a.Deadline)
	}
	return a.InProgress() && now.After(a.Deadline.Add(TestAttemptGrace))
}

// SetAnswer records the options picked for one of the attempt's questions;
// an empty answerIDs clears it.
func (a *TestAttempt) SetAnswer(questions []TestSnapshotQuestion, questionID int64, answerIDs []int64, now time.Time) error {
	if !a.InProgress() || a.Expired(now) {
		return ErrTestAttemptOver
	}

	i := slices.IndexFunc(questions, func(q TestSnapshotQuestion) bool { return q.ID == questionID })
	if i < 0 {
		return testInvalid("такого вопроса нет в этой попытке")
	}
	q := questions[i]

	picked := slices.Clone(answerIDs)
	slices.Sort(picked)
	picked = slices.Compact(picked)
	for _, id := range picked {
		if !slices.ContainsFunc(q.Answers, func(o TestSnapshotAnswer) bool { return o.ID == id }) {
			return testInvalid("такого варианта ответа нет в вопросе")
		}
	}
	if len(picked) > 1 && !q.multiple() {
		return testInvalid("в этом вопросе выберите один вариант")
	}

	if a.InstructionAcceptedAt != nil {
		a.Events = append(a.Events, TestAttemptEvent{At: now, Kind: "answer_saved", QuestionID: questionID, AnswerIDs: picked})
	}
	a.Answers = slices.DeleteFunc(a.Answers, func(x TestAttemptAnswer) bool { return x.QuestionID == questionID })
	if len(picked) > 0 {
		a.Answers = append(a.Answers, TestAttemptAnswer{QuestionID: questionID, AnswerIDs: picked})
	}
	return nil
}

// Finish ends the attempt and grades it. Past the deadline it counts as
// expired, finished at the deadline. Finishing twice changes nothing.
func (a *TestAttempt) Finish(questions []TestSnapshotQuestion, now time.Time) {
	if !a.InProgress() {
		return
	}
	finished := now
	if a.Expired(now) {
		a.Status = enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_EXPIRED
		finished = a.Deadline
	} else {
		a.Status = enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED
	}
	if a.InstructionAcceptedAt != nil {
		a.Events = append(a.Events, TestAttemptEvent{At: finished, Kind: "finished"})
	}
	a.FinishedAt = &finished
	a.Score, a.Total = a.Grade(questions)
}

// Grade counts the questions answered fully right: exactly the correct
// options picked, no more and no fewer.
func (a *TestAttempt) Grade(questions []TestSnapshotQuestion) (score, total int) {
	for _, q := range questions {
		if q.IsCorrect(a.Picked(q.ID)) {
			score++
		}
	}
	return score, len(questions)
}

// Picked: the options saved for a question; nil when unanswered.
func (a *TestAttempt) Picked(questionID int64) []int64 {
	for _, x := range a.Answers {
		if x.QuestionID == questionID {
			return x.AnswerIDs
		}
	}
	return nil
}

func (q TestSnapshotQuestion) correctCount() int {
	n := 0
	for _, o := range q.Answers {
		if o.IsCorrect {
			n++
		}
	}
	return n
}

// multiple: the student may pick several options.
func (q TestSnapshotQuestion) multiple() bool {
	return q.Multiple || q.correctCount() > 1
}

// IsCorrect: picked is exactly the set of correct options.
func (q TestSnapshotQuestion) IsCorrect(picked []int64) bool {
	if len(picked) != q.correctCount() {
		return false
	}
	for _, o := range q.Answers {
		if o.IsCorrect && !slices.Contains(picked, o.ID) {
			return false
		}
	}
	return true
}

func (s *TestSession) ToProto() *entity.TestSession {
	out := &entity.TestSession{
		Audience:        s.Audience.ToProto(),
		AssignedCount:   int32(s.AssignedCount),
		ExamV2:          s.ExamSettings.Enabled,
		Id:              s.ID,
		Token:           s.Token,
		Topic:           s.Topic,
		Department:      s.Department,
		Description:     s.Description,
		Note:            s.Note,
		DurationMinutes: int32(s.DurationMinutes),
		QuestionCount:   int32(s.QuestionCount),
		OptionCount:     int32(s.OptionCount),
		Version:         s.Version,
		TotalQuestions:  int32(s.TotalQuestions),
		Shuffle:         s.Shuffle,
		ShowResult:      s.ShowResult,
		IsOpen:          s.IsOpen,
		AttemptCount:    int32(s.AttemptCount),
		CreatedAt:       timestamppb.New(s.CreatedAt),
	}
	for _, a := range s.Assignments {
		out.Recipients = append(out.Recipients, &entity.ExamRecipient{MdmUserUuid: a.MDMUserUUID, FullName: a.FullName, StudentGroup: a.StudentGroup, IssuedAt: timestamppb.New(a.CreatedAt)})
	}
	if s.TestID != nil {
		out.TestId = *s.TestID
	}
	if s.OpensAt != nil {
		out.OpensAt = timestamppb.New(*s.OpensAt)
	}
	if s.ClosesAt != nil {
		out.ClosesAt = timestamppb.New(*s.ClosesAt)
	}
	return out
}

// QuestionsProto: the frozen copy with the correct options, for staff.
func (s *TestSession) QuestionsProto() []*entity.TestQuestion {
	out := make([]*entity.TestQuestion, 0, len(s.Questions))
	for _, q := range s.Questions {
		answers := make([]*entity.TestAnswer, 0, len(q.Answers))
		for _, a := range q.Answers {
			answers = append(answers, &entity.TestAnswer{Id: a.ID, Text: a.Text, IsCorrect: a.IsCorrect})
		}
		out = append(out, &entity.TestQuestion{
			Id: q.ID, Text: q.Text, Answers: answers,
			Image: q.Image, ImageWidth: int32(q.ImageWidth), ImageHeight: int32(q.ImageHeight),
		})
	}
	return out
}

// TakeQuestionsProto: the questions as the student sees them, no correct marks.
func TakeQuestionsProto(questions []TestSnapshotQuestion) []*entity.TestTakeQuestion {
	out := make([]*entity.TestTakeQuestion, 0, len(questions))
	for _, q := range questions {
		answers := make([]*entity.TestTakeAnswer, 0, len(q.Answers))
		for _, a := range q.Answers {
			answers = append(answers, &entity.TestTakeAnswer{Id: a.ID, Text: a.Text})
		}
		out = append(out, &entity.TestTakeQuestion{
			Id: q.ID, Text: q.Text, Answers: answers, Multiple: q.multiple(),
			Image: q.Image, ImageWidth: int32(q.ImageWidth), ImageHeight: int32(q.ImageHeight),
		})
	}
	return out
}

// ToProto: the attempt for staff — every question asked, in order, with
// what was picked and whether it was right.
func (a *TestAttempt) ToProto(questions []TestSnapshotQuestion) *entity.TestAttempt {
	out := &entity.TestAttempt{
		MdmUserUuid:  a.MDMUserUUID,
		Id:           a.ID,
		SessionId:    a.SessionID,
		FullName:     a.FullName,
		StudentGroup: a.StudentGroup,
		Status:       a.Status,
		Score:        int32(a.Score),
		Total:        int32(a.Total),
		StartedAt:    timestamppb.New(a.StartedAt),
		Deadline:     timestamppb.New(a.Deadline),
		Answers:      make([]*entity.TestAttemptAnswer, 0, len(questions)),
	}
	if a.FinishedAt != nil {
		out.FinishedAt = timestamppb.New(*a.FinishedAt)
	}
	for _, q := range questions {
		picked := a.Picked(q.ID)
		out.Answers = append(out.Answers, &entity.TestAttemptAnswer{QuestionId: q.ID, AnswerIds: picked, IsCorrect: q.IsCorrect(picked)})
	}
	return out
}

// SavedAnswersProto: what the student picked so far, without grading.
func (a *TestAttempt) SavedAnswersProto() []*entity.TestAttemptAnswer {
	out := make([]*entity.TestAttemptAnswer, 0, len(a.Answers))
	for _, x := range a.Answers {
		out = append(out, &entity.TestAttemptAnswer{QuestionId: x.QuestionID, AnswerIds: x.AnswerIDs})
	}
	return out
}
