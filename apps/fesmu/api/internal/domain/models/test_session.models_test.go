package models

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	enum "fesmu/contract/fesmu/enum/v1"
)

func sessionTest(questions int) *Test {
	t := &Test{ID: 7, Department: "Кафедра анатомии", Topic: "Кости черепа"}
	for i := range questions {
		qid := int64(100 + i)
		t.Questions = append(t.Questions, TestQuestion{
			ID: qid, Text: fmt.Sprintf("Вопрос %d", i),
			Answers: []TestAnswer{
				{ID: qid*10 + 1, Text: "А", IsCorrect: true},
				{ID: qid*10 + 2, Text: "Б"},
				{ID: qid*10 + 3, Text: "В", IsCorrect: i%2 == 1},
			},
		})
	}
	return t
}

func TestNewTestSessionValidates(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Hour)
	cases := map[string]TestSessionParams{
		"no time":        {DurationMinutes: 0},
		"too long":       {DurationMinutes: 601},
		"too many asked": {DurationMinutes: 10, QuestionCount: 4},
		"negative asked": {DurationMinutes: 10, QuestionCount: -1},
		"closes in past": {DurationMinutes: 10, ClosesAt: &past},
	}
	for name, params := range cases {
		if _, err := NewTestSession(sessionTest(3), params, "tok", now); !errors.Is(err, ErrTestInvalid) {
			t.Errorf("%s: expected ErrTestInvalid, got %v", name, err)
		}
	}

	s, err := NewTestSession(sessionTest(3), TestSessionParams{DurationMinutes: 20, QuestionCount: 3, Note: "  Л-101   поток 2 "}, "tok", now)
	if err != nil {
		t.Fatal(err)
	}
	if s.QuestionCount != 0 || s.AskedCount() != 3 {
		t.Errorf("asking every question should store 0 (all), got %d", s.QuestionCount)
	}
	if s.Note != "Л-101 поток 2" || *s.TestID != 7 || !s.Open(now) {
		t.Errorf("unexpected session %+v", s)
	}
}

func TestAttemptQuestionsAreStablePerSeed(t *testing.T) {
	s, err := NewTestSession(sessionTest(30), TestSessionParams{DurationMinutes: 10, QuestionCount: 10, Shuffle: true}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	a, b := s.AttemptQuestions(42), s.AttemptQuestions(42)
	if len(a) != 10 || !slices.EqualFunc(a, b, func(x, y TestSnapshotQuestion) bool {
		return x.ID == y.ID && x.Answers[0].ID == y.Answers[0].ID
	}) {
		t.Fatal("the same seed must give the same questions in the same order")
	}
	// Shuffling the options of one attempt must not touch the frozen copy.
	if s.Questions[0].Answers[0].ID != 1001 {
		t.Fatal("frozen copy was reordered")
	}

	s.Shuffle = false
	ids := []int64{}
	for _, q := range s.AttemptQuestions(42) {
		ids = append(ids, q.ID)
	}
	if !slices.IsSorted(ids) {
		t.Errorf("without shuffle the picked questions keep the test's order, got %v", ids)
	}

	s.QuestionCount = 0
	if got := s.AttemptQuestions(1); len(got) != 30 || got[0].ID != 100 || got[29].ID != 129 {
		t.Error("without shuffle and limit every question is asked in order")
	}
}

func TestAttemptAnswerAndGrade(t *testing.T) {
	now := time.Now()
	s, _ := NewTestSession(sessionTest(2), TestSessionParams{DurationMinutes: 10}, "tok", now)
	s.ID = 1
	a, err := NewTestAttempt(s, TestAttemptParams{FullName: " Иванов  Иван ", StudentGroup: "Л-101"}, "att", 1, now)
	if err != nil {
		t.Fatal(err)
	}
	if a.FullName != "Иванов Иван" || a.Total != 2 || !a.Deadline.Equal(now.Add(10*time.Minute)) {
		t.Fatalf("unexpected attempt %+v", a)
	}
	qs := s.AttemptQuestions(a.Seed)

	// Question 100 has one correct option (1001). A V1 test asks it with radio
	// buttons, so two picks are refused, as in a version-0 session; a V2 test
	// takes several picks on any question (it doesn't give away how many are
	// right), and two picks are simply wrong.
	if err := a.SetAnswer(qs, 100, []int64{1001, 1002}, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("a V1 session must refuse two picks on a single-answer question, got %v", err)
	}
	if !qs[0].IsCorrect([]int64{1001}) || qs[0].IsCorrect([]int64{1001, 1002}) {
		t.Error("only exactly the correct options count as right")
	}
	v2 := *s
	v2.Version = enum.TestVersion_TEST_VERSION_V2
	if err := a.SetAnswer(v2.AttemptQuestions(a.Seed), 100, []int64{1001, 1002}, now); err != nil {
		t.Errorf("a V2 session must take two picks on any question, got %v", err)
	}
	old := *s
	old.PickVersion = 0
	if err := a.SetAnswer(old.AttemptQuestions(a.Seed), 100, []int64{1001, 1002}, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("a version-0 session must refuse two picks on a single-answer question, got %v", err)
	}
	if err := a.SetAnswer(qs, 100, []int64{9999}, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("expected a foreign option to be refused, got %v", err)
	}
	if err := a.SetAnswer(qs, 555, []int64{1001}, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("expected a foreign question to be refused, got %v", err)
	}
	if err := a.SetAnswer(qs, 100, []int64{1002}, now); err != nil {
		t.Fatal(err)
	}
	if err := a.SetAnswer(qs, 100, []int64{1001}, now); err != nil {
		t.Fatal(err)
	}
	// Question 101 needs both 1011 and 1013; one of them is not enough.
	if err := a.SetAnswer(qs, 101, []int64{1011}, now); err != nil {
		t.Fatal(err)
	}
	if score, _ := a.Grade(qs); score != 1 {
		t.Errorf("expected 1 right (a partial multi-answer counts as wrong), got %d", score)
	}
	if err := a.SetAnswer(qs, 101, []int64{1013, 1011, 1011}, now); err != nil {
		t.Fatal(err)
	}
	if len(a.Answers) != 2 || !slices.Equal(a.Picked(101), []int64{1011, 1013}) {
		t.Fatalf("expected one saved answer per question, deduplicated, got %+v", a.Answers)
	}

	a.Finish(qs, now.Add(time.Minute))
	if a.Status != enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED || a.Score != 2 || a.Total != 2 {
		t.Fatalf("expected finished 2/2, got %v %d/%d", a.Status, a.Score, a.Total)
	}
	if err := a.SetAnswer(qs, 100, []int64{1002}, now); !errors.Is(err, ErrTestAttemptOver) {
		t.Errorf("a finished attempt must refuse answers, got %v", err)
	}
}

func TestAttemptDeadline(t *testing.T) {
	now := time.Now()
	s, _ := NewTestSession(sessionTest(2), TestSessionParams{DurationMinutes: 5}, "tok", now)
	a, _ := NewTestAttempt(s, TestAttemptParams{FullName: "Петров", StudentGroup: "П-2"}, "att", 1, now)
	qs := s.AttemptQuestions(a.Seed)

	inGrace := a.Deadline.Add(TestAttemptGrace / 2)
	if err := a.SetAnswer(qs, 100, []int64{1001}, inGrace); err != nil {
		t.Errorf("an answer within the grace must count, got %v", err)
	}
	late := a.Deadline.Add(TestAttemptGrace + time.Second)
	if err := a.SetAnswer(qs, 101, []int64{1011}, late); !errors.Is(err, ErrTestAttemptOver) {
		t.Errorf("an answer after the grace must be refused, got %v", err)
	}
	if !a.Expired(late) {
		t.Fatal("expected expired")
	}
	a.Finish(qs, late.Add(time.Hour))
	if a.Status != enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_EXPIRED || !a.FinishedAt.Equal(a.Deadline) || a.Score != 1 {
		t.Errorf("expected expired at the deadline with 1 right, got %v %v %d", a.Status, a.FinishedAt, a.Score)
	}
}

func TestNewTestAttemptRules(t *testing.T) {
	now := time.Now()
	s, _ := NewTestSession(sessionTest(1), TestSessionParams{DurationMinutes: 5}, "tok", now)
	if _, err := NewTestAttempt(s, TestAttemptParams{FullName: " ", StudentGroup: "Л-1"}, "a", 1, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("expected a name to be required, got %v", err)
	}
	if _, err := NewTestAttempt(s, TestAttemptParams{FullName: "Иванов"}, "a", 1, now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("expected a group to be required, got %v", err)
	}
	s.IsOpen = false
	if _, err := NewTestAttempt(s, TestAttemptParams{FullName: "Иванов", StudentGroup: "Л-1"}, "a", 1, now); !errors.Is(err, ErrTestSessionClosed) {
		t.Errorf("a closed session must refuse new attempts, got %v", err)
	}
	s.IsOpen = true
	closes := now.Add(time.Minute)
	s.ClosesAt = &closes
	if s.Open(now.Add(2 * time.Minute)) {
		t.Error("a session past its close date must not be open")
	}
}

// Before its opening time a session takes no attempts and says so; it can't
// close before it opens.
func TestSessionOpensAt(t *testing.T) {
	now := time.Now()
	opens, closes := now.Add(time.Hour), now.Add(2*time.Hour)
	if _, err := NewTestSession(sessionTest(3), TestSessionParams{DurationMinutes: 10, OpensAt: &closes, ClosesAt: &opens}, "tok", now); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("closing before opening must be refused, got %v", err)
	}

	s, err := NewTestSession(sessionTest(3), TestSessionParams{DurationMinutes: 10, OpensAt: &opens, ClosesAt: &closes}, "tok", now)
	if err != nil {
		t.Fatal(err)
	}
	if s.Open(now) {
		t.Error("a session must not be open before its opening time")
	}
	if _, err := NewTestAttempt(s, TestAttemptParams{FullName: "Иванов", StudentGroup: "Л-1"}, "a", 1, now); !errors.Is(err, ErrTestSessionNotOpenYet) {
		t.Errorf("an attempt before the opening time must be refused as not open yet, got %v", err)
	}
	if !s.Open(opens) || !s.Open(closes.Add(-time.Second)) {
		t.Error("a session must be open from its opening time until it closes")
	}
	if _, err := NewTestAttempt(s, TestAttemptParams{FullName: "Иванов", StudentGroup: "Л-1"}, "a", 1, opens.Add(time.Minute)); err != nil {
		t.Errorf("an attempt after the opening time must start, got %v", err)
	}
}

// In a V2 test variants of one question (the same text, as supplied files
// repeat a question with other options) are asked once per attempt, as one
// random variant; a V1 test asks every question it has.
func TestAttemptAsksVariantsOnce(t *testing.T) {
	test := &Test{ID: 1, Topic: "Токсикология", Version: enum.TestVersion_TEST_VERSION_V2}
	for i := range 40 {
		text := fmt.Sprintf("Вопрос %d", i%10) // 10 questions × 4 variants
		if i%2 == 1 {
			text = "  " + strings.ToUpper(text) + " " // spacing and case aside
		}
		test.Questions = append(test.Questions, TestQuestion{ID: int64(100 + i), Text: text, Answers: []TestAnswer{
			{ID: int64(1000 + 2*i), Text: "да", IsCorrect: true}, {ID: int64(1001 + 2*i), Text: "нет"},
		}})
	}
	s, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, QuestionCount: 8, Shuffle: true}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if s.TotalQuestions != 10 {
		t.Fatalf("variants must count once: expected 10 questions, got %d", s.TotalQuestions)
	}
	if _, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, QuestionCount: 11}, "tok", time.Now()); !errors.Is(err, ErrTestInvalid) {
		t.Errorf("asking more than the distinct questions must be refused, got %v", err)
	}

	variantsSeen := map[int64]bool{}
	for seed := range int64(50) {
		texts := map[string]bool{}
		for _, q := range s.AttemptQuestions(seed) {
			key := strings.ToLower(strings.TrimSpace(q.Text))
			if texts[key] {
				t.Fatalf("seed %d: question %q asked twice", seed, key)
			}
			texts[key] = true
			variantsSeen[q.ID] = true
		}
		if len(texts) != 8 {
			t.Fatalf("seed %d: expected 8 questions, got %d", seed, len(texts))
		}
		for _, q := range s.AttemptQuestions(seed) {
			if !q.multiple() {
				t.Fatalf("seed %d: every question of a V2 session must take several picks", seed)
			}
		}
	}
	if len(variantsSeen) < 30 {
		t.Errorf("different students should get different variants, saw only %d of 40", len(variantsSeen))
	}

	// A V1 test: every added question on its own, however alike the texts.
	test.Version = enum.TestVersion_TEST_VERSION_V1
	v1, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, Shuffle: true}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if v1.TotalQuestions != 40 {
		t.Fatalf("a V1 test must ask all 40 added questions, got %d", v1.TotalQuestions)
	}
	asked := map[int64]bool{}
	for _, q := range v1.AttemptQuestions(3) {
		if asked[q.ID] || q.multiple() {
			t.Fatalf("a V1 question is asked once, with one pick when one option is right: %+v", q)
		}
		asked[q.ID] = true
	}
	if len(asked) != 40 {
		t.Fatalf("a V1 attempt must ask all 40, got %d", len(asked))
	}
	// A V1 session made with pick version 2 keeps counting variants once.
	v1.PickVersion = 2
	if got := len(v1.AttemptQuestions(3)); got != 10 {
		t.Errorf("a pick-version-2 V1 session must keep asking variants once, got %d", got)
	}

	// A session made before variants counted keeps asking as it did.
	old := *s
	old.PickVersion, old.QuestionCount = 0, 0
	if got := len(old.AttemptQuestions(1)); got != 40 {
		t.Errorf("a version-0 session must ask every stored question, got %d", got)
	}
}

// With OptionCount each student sees that many options: a random number of the
// correct ones mixed with wrong ones; a question that refers to its other
// options keeps them all.
func TestAttemptMixesOptions(t *testing.T) {
	pool := TestQuestion{ID: 1, Text: "Признаки отравления ФОВ"}
	for i := range 4 {
		pool.Answers = append(pool.Answers, TestAnswer{ID: int64(10 + i), Text: fmt.Sprintf("верный %d", i), IsCorrect: true})
	}
	for i := range 8 {
		pool.Answers = append(pool.Answers, TestAnswer{ID: int64(20 + i), Text: fmt.Sprintf("неверный %d", i)})
	}
	referring := TestQuestion{ID: 2, Text: "Антидоты", Answers: []TestAnswer{
		{ID: 30, Text: "атропин"}, {ID: 31, Text: "унитиол"}, {ID: 32, Text: "налоксон"}, {ID: 33, Text: "глюкоза"},
		{ID: 34, Text: "тиосульфат"}, {ID: 35, Text: "Нет правильного ответа", IsCorrect: true},
	}}
	test := &Test{ID: 1, Topic: "ФОВ", Questions: []TestQuestion{pool, referring}}

	// A V1 test shows every option as written, whatever was asked for.
	v1, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, OptionCount: 5}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if v1.OptionCount != 0 || len(v1.AttemptQuestions(1)[0].Answers) != 12 {
		t.Fatalf("a V1 session must show all 12 options, got option count %d", v1.OptionCount)
	}

	test.Version = enum.TestVersion_TEST_VERSION_V2
	s, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, OptionCount: 5}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}

	correctCounts := map[int]bool{}
	for seed := range int64(200) {
		questions := s.AttemptQuestions(seed)
		q := questions[slices.IndexFunc(questions, func(q TestSnapshotQuestion) bool { return q.ID == 1 })]
		if len(q.Answers) != 5 || !q.Multiple {
			t.Fatalf("seed %d: expected 5 options taking several picks, got %d (multiple=%v)", seed, len(q.Answers), q.Multiple)
		}
		correct := q.correctCount()
		if correct < 1 || correct > 4 || correct == 5 {
			t.Fatalf("seed %d: %d correct of 5 shown", seed, correct)
		}
		correctCounts[correct] = true

		var right []int64
		for _, o := range q.Answers {
			if o.IsCorrect {
				right = append(right, o.ID)
			}
		}
		if !q.IsCorrect(right) || q.IsCorrect(right[:len(right)-1]) && len(right) > 1 {
			t.Fatalf("seed %d: grading must take exactly the correct options shown", seed)
		}

		r := questions[slices.IndexFunc(questions, func(q TestSnapshotQuestion) bool { return q.ID == 2 })]
		if len(r.Answers) != 6 {
			t.Fatalf("seed %d: a question with a referring option must keep all 6, got %d", seed, len(r.Answers))
		}
	}
	for _, k := range []int{1, 2, 3} {
		if !correctCounts[k] {
			t.Errorf("expected some students to get %d correct options, got only %v", k, correctCounts)
		}
	}

	a, err := NewTestAttempt(s, TestAttemptParams{FullName: "Иванов", StudentGroup: "Л-1"}, "a", 7, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	questions := s.AttemptQuestions(a.Seed)
	q := questions[0]
	if err := a.SetAnswer(questions, q.ID, []int64{q.Answers[0].ID, q.Answers[1].ID}, time.Now()); err != nil {
		t.Errorf("a mixed session must take several picks on any question, got %v", err)
	}
}

// Since version 2 variants typed with another dash, colon, quotes or "ё"
// are one question; a different word still makes another question.
func TestQuestionVariantsIgnorePunctuation(t *testing.T) {
	texts := []string{
		"Химический агент, предназначенный для применения в качестве оружия - это:",
		"Химический агент, предназначенный для применения в качестве оружия — это:",
		"химический агент, предназначенный для применения в качестве оружия это",
		"Вещество, вызвавшее интоксикацию — это:",
		"Вещество, вызвавшее гибель — это:",
		"Объём «зоны» заражения",
		"объем зоны заражения?",
	}
	test := &Test{ID: 1, Topic: "Т-1", Version: enum.TestVersion_TEST_VERSION_V2}
	for i, text := range texts {
		test.Questions = append(test.Questions, TestQuestion{ID: int64(100 + i), Text: text, Answers: []TestAnswer{
			{ID: int64(1000 + 2*i), Text: "да", IsCorrect: true}, {ID: int64(1001 + 2*i), Text: "нет"},
		}})
	}
	s, err := NewTestSession(test, TestSessionParams{DurationMinutes: 10, Shuffle: true}, "tok", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if s.TotalQuestions != 4 {
		t.Fatalf("expected 4 distinct questions (agent, intoxication, death, zone), got %d", s.TotalQuestions)
	}
	for seed := range int64(100) {
		seen := map[string]bool{}
		for _, q := range s.AttemptQuestions(seed) {
			if key := QuestionKey(q.Text); seen[key] {
				t.Fatalf("seed %d: variants of %q asked twice", seed, key)
			} else {
				seen[key] = true
			}
		}
	}

	// A version-1 session made before keeps comparing exact texts: all 7 differ.
	v1 := *s
	v1.PickVersion, v1.DistinctQuestions = 1, 0
	if got := v1.QuestionTotal(); got != 7 {
		t.Errorf("a version-1 session must keep comparing exact texts, got %d questions", got)
	}
}
