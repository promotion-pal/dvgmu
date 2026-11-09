package models

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var ErrExamAlreadyTaken = errors.New("вы уже прошли экзамен по этому предмету; результат сообщит преподаватель")

// One entitlement per student and subject within a faculty/semester. The key
// is frozen in the session, so issuing a new session does not reset the limit.
func ExamSubjectKey(test *Test) string {
	normalize := func(s string) string { return strings.ToLower(strings.Join(strings.Fields(s), " ")) }
	subject := normalize(test.Discipline)
	value := normalize(test.Department) + "\x1f" + strconv.Itoa(test.Semester) + "\x1f" + subject
	if subject == "" {
		value = "legacy-test:" + strconv.FormatInt(test.ID, 10)
	}
	sum := md5.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

// Session deletion keeps the limit. Explicit result deletion releases it.
type ExamParticipation struct {
	ID          int64        `gorm:"primaryKey;autoIncrement"`
	MDMUserUUID string       `gorm:"type:uuid;not null;uniqueIndex:idx_exam_subject_student"`
	SubjectKey  string       `gorm:"size:32;not null;uniqueIndex:idx_exam_subject_student"`
	AttemptID   *int64       `gorm:"index"`
	Attempt     *TestAttempt `gorm:"foreignKey:AttemptID;constraint:OnDelete:SET NULL"`
	CreatedAt   time.Time    `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func ValidateExamQuestions(questions []TestSnapshotQuestion) error {
	for i, q := range questions {
		correct := 0
		for _, a := range q.Answers {
			if a.IsCorrect {
				correct++
			}
		}
		if correct != 1 {
			return testInvalid(fmt.Sprintf("вопрос %d: для экзамена нужен ровно один верный ответ", i+1))
		}
	}
	return nil
}
func ValidateExamParams(params TestParams) error {
	for i, q := range params.Questions {
		correct := 0
		for _, a := range q.Answers {
			if a.IsCorrect {
				correct++
			}
		}
		if correct != 1 {
			return testInvalid(fmt.Sprintf("вопрос %d: для экзамена нужен ровно один верный ответ", i+1))
		}
	}
	return nil
}
