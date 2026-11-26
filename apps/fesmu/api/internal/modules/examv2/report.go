package examv2

import (
	"connectrpc.com/connect"
	"context"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	"encoding/json"
	pb "fesmu/contract/fesmu/exam/service/v2"
	"math"
	"sort"
	"time"
)

type AlternativeStat struct {
	Text    string  `json:"text"`
	Correct bool    `json:"correct"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
	Flag    bool    `json:"flag"`
}
type ItemStat struct {
	ID             int64             `json:"id"`
	Text           string            `json:"text"`
	Asked          int               `json:"asked"`
	Difficulty     float64           `json:"difficulty"`
	Discrimination *float64          `json:"discrimination"`
	Correlation    *float64          `json:"correlation"`
	Alternatives   []AlternativeStat `json:"alternatives"`
	Unanswered     int               `json:"unanswered"`
}
type StudentRow struct {
	TestID                *int64                     `json:"test_id,omitempty"`
	TestTitle             string                     `json:"test_title"`
	AskedQuestionIDs      []int64                    `json:"asked_question_ids"`
	ID                    int64                      `json:"id"`
	SessionID             int64                      `json:"session_id"`
	Name                  string                     `json:"name"`
	Group                 string                     `json:"group"`
	Score                 int                        `json:"score"`
	Total                 int                        `json:"total"`
	Percent               float64                    `json:"percent"`
	Grade                 int                        `json:"grade"`
	Rank                  int                        `json:"rank"`
	Status                int32                      `json:"status"`
	StartedAt             time.Time                  `json:"started_at"`
	FinishedAt            *time.Time                 `json:"finished_at"`
	Answers               []models.TestAttemptAnswer `json:"answers"`
	Events                []models.TestAttemptEvent  `json:"events"`
	InstructionAcceptedAt *time.Time                 `json:"instruction_accepted_at"`
	Settings              models.ExamV2Settings      `json:"settings"`
}
type Summary struct {
	Key            string      `json:"key"`
	Count          int         `json:"count"`
	AveragePercent float64     `json:"average_percent"`
	AverageGrade   float64     `json:"average_grade"`
	Grades         map[int]int `json:"grades"`
}
type Report struct {
	Title     string                        `json:"title"`
	Settings  models.ExamV2Settings         `json:"settings"`
	Students  []StudentRow                  `json:"students"`
	Items     []ItemStat                    `json:"items"`
	Summaries map[string][]Summary          `json:"summaries"`
	Questions []models.TestSnapshotQuestion `json:"questions"`
	Method    string                        `json:"method"`
}

const Method = "Сложность = 1 − число верных ответов / число предъявлений. Пропуск считается неверным ответом. Дискриминативность = доля верных в верхних 27% − доля верных в нижних 27% по суммарному баллу; группы округляются вверх, при пересечении показатель не вычисляется. Корреляция = Pearson(ответ 0/1, суммарный балл без данного задания); это показатель согласованности, а не доказательство содержательной валидности. При менее 4 ответах или нулевой дисперсии корреляция не вычисляется. Анализ включает завершённые и просроченные попытки, исключая текущие и пробного студента. Неправильная альтернатива отмечается при выборе >20%; дискриминативность >0,3 приемлема, >0,6 хорошая; сложность <0,05 или >0,95 отмечается как крайняя."

func percent(score, total int) float64 {
	if total == 0 {
		return 0
	}
	return 100 * float64(score) / float64(total)
}
func Analyze(session *models.TestSession, views []service.TestAttemptView) Report {
	out := Report{Title: session.Topic, Settings: session.ExamSettings, Method: Method, Questions: session.Questions, Students: []StudentRow{}, Items: []ItemStat{}}
	completed := []service.TestAttemptView{}
	for _, v := range views {
		if v.Attempt.InProgress() {
			continue
		}
		completed = append(completed, v)
		a := v.Attempt
		askedIDs := []int64{}
		for _, q := range v.Questions {
			askedIDs = append(askedIDs, q.ID)
		}
		p := percent(a.Score, a.Total)
		out.Students = append(out.Students, StudentRow{TestID: session.TestID, TestTitle: session.Topic, AskedQuestionIDs: askedIDs, ID: a.ID, SessionID: session.ID, Name: a.FullName, Group: a.StudentGroup, Score: a.Score, Total: a.Total, Percent: p, Grade: session.ExamSettings.Grade(p), Status: int32(a.Status), StartedAt: a.StartedAt, FinishedAt: a.FinishedAt, Answers: a.Answers, Events: a.Events, InstructionAcceptedAt: a.InstructionAcceptedAt, Settings: session.ExamSettings})
	}
	sort.SliceStable(completed, func(i, j int) bool { return completed[i].Attempt.Score > completed[j].Attempt.Score })
	for _, q := range session.Questions {
		item := ItemStat{ID: q.ID, Text: q.Text, Alternatives: []AlternativeStat{}}
		xs, ys := []float64{}, []float64{}
		correct := 0
		for _, v := range completed {
			asked := false
			for _, actual := range v.Questions {
				if actual.ID == q.ID {
					asked = true
					break
				}
			}
			if !asked {
				continue
			}
			item.Asked++
			picked := v.Attempt.Picked(q.ID)
			if len(picked) == 0 {
				item.Unanswered++
			}
			x := 0.0
			if q.IsCorrect(picked) {
				x = 1
				correct++
			}
			xs = append(xs, x)
			ys = append(ys, float64(v.Attempt.Score)-x)
		}
		if item.Asked > 0 {
			item.Difficulty = 1 - float64(correct)/float64(item.Asked)
		}
		for _, a := range q.Answers {
			count := 0
			for _, v := range completed {
				for _, id := range v.Attempt.Picked(q.ID) {
					if id == a.ID {
						count++
					}
				}
			}
			p := percent(count, item.Asked)
			item.Alternatives = append(item.Alternatives, AlternativeStat{Text: a.Text, Correct: a.IsCorrect, Count: count, Percent: p, Flag: !a.IsCorrect && p > 20})
		}
		n := len(xs)
		k := int(math.Ceil(float64(n) * .27))
		if n >= 4 && k*2 <= n {
			hi, lo := 0.0, 0.0
			for i := 0; i < k; i++ {
				hi += xs[i]
				lo += xs[n-1-i]
			}
			d := (hi - lo) / float64(k)
			item.Discrimination = &d
		}
		item.Correlation = Pearson(xs, ys)
		out.Items = append(out.Items, item)
	}
	rank(out.Students)
	out.Summaries = summarize(out.Students)
	return out
}
func Pearson(x, y []float64) *float64 {
	if len(x) < 4 || len(x) != len(y) {
		return nil
	}
	mx, my := 0.0, 0.0
	for i := range x {
		mx += x[i]
		my += y[i]
	}
	mx /= float64(len(x))
	my /= float64(len(x))
	xx, yy, xy := 0.0, 0.0, 0.0
	for i := range x {
		dx, dy := x[i]-mx, y[i]-my
		xx += dx * dx
		yy += dy * dy
		xy += dx * dy
	}
	if xx == 0 || yy == 0 {
		return nil
	}
	r := xy / math.Sqrt(xx*yy)
	return &r
}
func rank(rows []StudentRow) {
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Percent == rows[j].Percent {
			return rows[i].Name < rows[j].Name
		}
		return rows[i].Percent > rows[j].Percent
	})
	last := 0
	for i := range rows {
		if i == 0 || rows[i].Percent != rows[i-1].Percent {
			last = i + 1
		}
		rows[i].Rank = last
	}
}
func summarize(rows []StudentRow) map[string][]Summary {
	groups := map[string]map[string]*Summary{}
	for _, row := range rows {
		keys := map[string]string{"group": row.Group, "specialty": row.Settings.Specialty, "faculty": row.Settings.Faculty, "discipline": row.Settings.Specialty + " / " + row.Settings.Discipline, "year": row.Settings.AcademicYear + " / " + row.Settings.Season, "university": "Университет"}
		for kind, key := range keys {
			if groups[kind] == nil {
				groups[kind] = map[string]*Summary{}
			}
			s := groups[kind][key]
			if s == nil {
				s = &Summary{Key: key, Grades: map[int]int{}}
				groups[kind][key] = s
			}
			s.Count++
			s.AveragePercent += row.Percent
			s.AverageGrade += float64(row.Grade)
			s.Grades[row.Grade]++
		}
	}
	out := map[string][]Summary{}
	for kind, group := range groups {
		for _, s := range group {
			s.AveragePercent /= float64(s.Count)
			s.AverageGrade /= float64(s.Count)
			out[kind] = append(out[kind], *s)
		}
		sort.Slice(out[kind], func(i, j int) bool { return out[kind][i].Key < out[kind][j].Key })
	}
	return out
}
func (m *Module) ReportFetch(ctx context.Context, req *connect.Request[pb.ReportFetchRequest]) (*connect.Response[pb.ReportFetchResponse], error) {
	if err := m.guard(ctx, false); err != nil {
		return nil, err
	}
	var out Report
	if req.Msg.SessionId > 0 {
		s, views, err := m.sessions.TestAttemptFetch(ctx, req.Msg.SessionId)
		if err != nil {
			return nil, dbError(err)
		}
		if !s.ExamSettings.Enabled || s.ExamSettings.AssessmentKind != req.Msg.AssessmentKind {
			return nil, bad("выберите сессию V2")
		}
		out = Analyze(s, views)
	} else {
		out = Report{Title: "Сводный отчёт V2", Method: Method, Students: []StudentRow{}}
		var sessions []models.TestSession
		q := m.db.WithContext(ctx).Where("exam_settings->>'enabled'='true'").Where("COALESCE(exam_settings->>'assessment_kind','')=?", req.Msg.AssessmentKind)
		if req.Msg.TestId > 0 {
			q = q.Where("test_id=?", req.Msg.TestId)
		}
		if req.Msg.AcademicYear != "" {
			q = q.Where("exam_settings->>'academic_year'=?", req.Msg.AcademicYear)
		}
		if req.Msg.Season != "" {
			q = q.Where("exam_settings->>'season'=?", req.Msg.Season)
		}
		if err := q.Order("id").Find(&sessions).Error; err != nil {
			return nil, dbError(err)
		}
		for _, s := range sessions {
			session, views, err := m.sessions.TestAttemptFetch(ctx, s.ID)
			if err != nil {
				return nil, dbError(err)
			}
			report := Analyze(session, views)
			if req.Msg.TestId > 0 && out.Title == "Сводный отчёт V2" {
				out.Title = session.Topic
				out.Settings = session.ExamSettings
			}
			out.Students = append(out.Students, report.Students...)
		}
		rank(out.Students)
		out.Summaries = summarize(out.Students)
	}
	data, err := json.Marshal(out)
	if err != nil {
		return nil, dbError(err)
	}
	return connect.NewResponse(&pb.ReportFetchResponse{ReportJson: string(data)}), nil
}
func (m *Module) ResultsFetch(ctx context.Context, _ *connect.Request[pb.StudentResultsRequest]) (*connect.Response[pb.ReportFetchResponse], error) {
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, nil)
	}
	if m.db == nil {
		return nil, connect.NewError(connect.CodeUnavailable, nil)
	}
	type OwnResult struct {
		Topic      string     `json:"topic"`
		ShowResult bool       `json:"show_result"`
		Score      *int       `json:"score"`
		Total      *int       `json:"total"`
		FinishedAt *time.Time `json:"finished_at"`
	}
	// Conditional projection keeps hidden scores out of the response altogether.
	var rows []OwnResult
	err := m.db.WithContext(ctx).Raw(`SELECT s.topic,s.show_result,CASE WHEN s.show_result THEN a.score END AS score,CASE WHEN s.show_result THEN a.total END AS total,a.finished_at FROM test_attempts a JOIN test_sessions s ON s.id=a.session_id WHERE a.mdm_user_uuid=? AND a.status<>1 AND s.exam_settings->>'enabled'='true' ORDER BY a.finished_at DESC`, u.UUID).Scan(&rows).Error
	if err != nil {
		return nil, dbError(err)
	}
	if rows == nil {
		rows = []OwnResult{}
	}
	data, _ := json.Marshal(rows)
	return connect.NewResponse(&pb.ReportFetchResponse{ReportJson: string(data)}), nil
}
