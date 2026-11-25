package models

import "time"

// Frozen in each generated test and session; changes to a bank never regrade history.
type ExamV2Settings struct {
	Faculty      string  `json:"faculty"`
	Enabled      bool    `json:"enabled"`
	Specialty    string  `json:"specialty"`
	Semester     int     `json:"semester"`
	Discipline   string  `json:"discipline"`
	AcademicYear string  `json:"academic_year"`
	Season       string  `json:"season"`
	Excellent    float64 `json:"excellent"`
	Good         float64 `json:"good"`
	Satisfactory float64 `json:"satisfactory"`
}

func (s ExamV2Settings) Grade(percent float64) int {
	if percent >= s.Excellent {
		return 5
	}
	if percent >= s.Good {
		return 4
	}
	if percent >= s.Satisfactory {
		return 3
	}
	return 2
}

const ExamV2Instruction = "Каждый ответ фиксируется. При аварийном закрытии откройте ссылку снова в этом же браузере: попытка продолжится с сохранёнными ответами, время не сбрасывается. По истечении времени тест автоматически завершится. Досрочная сдача доступна после ответа на все вопросы. Копирование и снимки экрана запрещены правилами экзамена."

type TestAttemptEvent struct {
	At         time.Time `json:"at"`
	Kind       string    `json:"kind"`
	QuestionID int64     `json:"question_id,omitempty"`
	AnswerIDs  []int64   `json:"answer_ids,omitempty"`
}
