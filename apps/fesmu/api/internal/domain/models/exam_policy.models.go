package models

import (
	"errors"
	"fmt"
	"time"
)

var ErrExamAlreadyTaken = errors.New("вы уже прошли экзамен в этой сессии; результат сообщит преподаватель")

// One attempt per student and session. Deleting the session cascades this
// entitlement; explicitly deleting a result also releases it.
type ExamParticipation struct {
	ID          int64        `gorm:"primaryKey;autoIncrement"`
	MDMUserUUID string       `gorm:"type:uuid;not null;uniqueIndex:idx_exam_session_student"`
	SessionID   int64        `gorm:"not null;uniqueIndex:idx_exam_session_student;index"`
	Session     *TestSession `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE"`
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
