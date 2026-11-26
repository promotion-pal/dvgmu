package examv2

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	"dvgmu/api/internal/storage"
	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/exam/service/v2"
	rpc "fesmu/contract/fesmu/exam/service/v2/servicev2connect"
	servicepb "fesmu/contract/fesmu/service/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BankRecord struct {
	ID        int64           `gorm:"primaryKey"`
	Revision  int64           `gorm:"not null;default:1"`
	Payload   json.RawMessage `gorm:"type:jsonb;not null"`
	UpdatedAt time.Time       `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (BankRecord) TableName() string { return "exam_v2_banks" }

type VariantRecord struct {
	Bank            *BankRecord  `gorm:"foreignKey:BankID;constraint:OnDelete:CASCADE"`
	Test            *models.Test `gorm:"foreignKey:TestID;constraint:OnDelete:SET NULL"`
	ID              int64        `gorm:"primaryKey"`
	BankID          int64        `gorm:"not null;index"`
	TestID          *int64
	Title           string `gorm:"type:text;not null"`
	DurationMinutes int32  `gorm:"not null"`
	ShowResult      bool   `gorm:"not null"`
}

func (VariantRecord) TableName() string { return "exam_v2_variants" }
func Tables() []any                     { return []any{&BankRecord{}, &VariantRecord{}} }

type Module struct {
	db       *gorm.DB
	sessions *service.TestSessionService
}

func New(db *gorm.DB, sessions *service.TestSessionService) *Module {
	return &Module{db: db, sessions: sessions}
}
func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	bankOpts := append(append([]connect.HandlerOption{}, opts...), connect.WithReadMaxBytes(24<<20))
	p, h := rpc.NewExamBankServiceHandler(m, bankOpts...)
	mux.Handle(p, h)
	p, h = rpc.NewExamStudentServiceHandler(m, opts...)
	mux.Handle(p, h)
	return []string{rpc.ExamBankServiceName, rpc.ExamStudentServiceName}
}
func (m *Module) guard(ctx context.Context, write bool) error {
	action := auth.ActionFetch
	if write {
		action = auth.ActionPost
	}
	if err := auth.RequireCan(ctx, auth.SectionExamTests, action); err != nil {
		return err
	}
	if m.db == nil {
		return connect.NewError(connect.CodeUnavailable, errors.New("БД экзаменов недоступна"))
	}
	return nil
}
func bad(s string) error { return connect.NewError(connect.CodeInvalidArgument, errors.New(s)) }
func dbError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return connect.NewError(connect.CodeNotFound, errors.New("запись не найдена"))
	}
	if err != nil {
		return connect.NewError(connect.CodeInternal, errors.New("не удалось обработать данные экзамена"))
	}
	return nil
}
func Decode(r BankRecord) (*pb.Bank, error) {
	b := &pb.Bank{}
	err := protojson.Unmarshal(r.Payload, b)
	b.Id = r.ID
	b.Revision = r.Revision
	if err == nil {
		NormalizeStructure(b)
	}
	return b, err
}
func variant(r VariantRecord) *pb.GeneratedVariant {
	var id int64
	if r.TestID != nil {
		id = *r.TestID
	}
	return &pb.GeneratedVariant{Id: r.ID, BankId: r.BankID, TestId: id, Title: r.Title, DurationMinutes: r.DurationMinutes, ShowResult: r.ShowResult}
}
func (m *Module) BankFetch(ctx context.Context, req *connect.Request[pb.BankFetchRequest]) (*connect.Response[pb.BankFetchResponse], error) {
	if err := m.guard(ctx, false); err != nil {
		return nil, err
	}
	var records []BankRecord
	var variants []VariantRecord
	if err := m.db.WithContext(ctx).Order("id DESC").Find(&records).Error; err != nil {
		return nil, dbError(err)
	}
	if err := m.db.WithContext(ctx).Where("test_id IS NOT NULL").Order("id DESC").Find(&variants).Error; err != nil {
		return nil, dbError(err)
	}
	out := &pb.BankFetchResponse{}
	allowed := map[int64]bool{}
	for _, r := range records {
		b, err := Decode(r)
		if err != nil {
			return nil, dbError(err)
		}
		if b.AssessmentKind != req.Msg.AssessmentKind {
			continue
		}
		allowed[b.Id] = true
		out.Banks = append(out.Banks, b)
	}
	for _, v := range variants {
		if allowed[v.BankID] {
			out.Variants = append(out.Variants, variant(v))
		}
	}
	return connect.NewResponse(out), nil
}
func params(b *pb.Bank, questions []*pb.BankSection) models.TestParams {
	p := models.TestParams{Department: b.Specialty, Discipline: b.Discipline, Semester: int(b.Semester), Topic: b.Discipline, Version: enum.TestVersion_TEST_VERSION_V1}
	for _, section := range questions {
		for _, q := range SectionQuestions(section) {
			item := models.TestQuestionParams{Text: q.Text, Image: q.Image}
			for _, a := range q.Answers {
				item.Answers = append(item.Answers, models.TestAnswerParams{Text: a.Text, IsCorrect: a.IsCorrect})
			}
			p.Questions = append(p.Questions, item)
		}
	}
	return p
}
func Validate(b *pb.Bank) error {
	if b == nil {
		return bad("заполните банк")
	}
	NormalizeStructure(b)
	if b.AssessmentKind != "" && b.AssessmentKind != "intermediate" {
		return bad("неверный вид тестирования")
	}
	if IsReadyExam(b) {
		b.VariantCount = 1
	}
	b.Specialty = strings.TrimSpace(b.Specialty)
	b.Faculty = strings.TrimSpace(b.Faculty)
	b.AcademicYear = strings.TrimSpace(b.AcademicYear)
	b.Discipline = strings.TrimSpace(b.Discipline)
	if strings.TrimSpace(b.Faculty) == "" || b.Specialty == "" || b.Discipline == "" || b.Semester < 1 || b.Semester > 12 {
		return bad("укажите специальность, дисциплину и семестр 1–12")
	}
	if len(b.Faculty) > 255 || len(b.Specialty) > 255 || len(b.Discipline) > 255 || len(b.AcademicYear) > 16 || len(b.ReviewNotes) > 20000 {
		return bad("слишком длинные поля банка")
	}
	if b.AcademicYear == "" || (b.Season != "winter" && b.Season != "summer") {
		return bad("укажите учебный год и зимнюю/летнюю сессию")
	}
	if b.VariantCount < 1 || b.VariantCount > 100 || b.DurationMinutes < 1 || b.DurationMinutes > 600 {
		return bad("вариантов: 1–100; время: 1–600 минут")
	}
	if !(b.Excellent <= 100 && b.Excellent > b.Good && b.Good > b.Satisfactory && b.Satisfactory > 0) {
		return bad("пороги оценок: 100 ≥ отлично > хорошо > удовлетворительно > 0")
	}
	if len(b.Sections) == 0 || len(b.Sections) > 100 {
		return bad("добавьте от 1 до 100 разделов")
	}
	names := map[string]bool{}
	total := 0
	all := 0
	for _, s := range b.Sections {
		if s == nil {
			return bad("пустой раздел")
		}
		s.Name = strings.TrimSpace(s.Name)
		key := strings.ToLower(s.Name)
		if key == "" || names[key] {
			return bad("названия разделов должны быть непустыми и уникальными")
		}
		names[key] = true
		pool := SectionQuestions(s)
		if s.ReadyVariant && len(pool) == 0 {
			return bad("готовый раздел «" + s.Name + "» не содержит вопросов")
		}
		if s.Quota < 0 || int(s.Quota) > len(pool) {
			return bad(fmt.Sprintf("раздел «%s»: нужно %d случайных вопросов, в темах доступно %d", s.Name, s.Quota, len(pool)))
		}
		if s.ReadyVariant {
			if len(pool) > 500 {
				return bad("в готовом тесте допускается не больше 500 вопросов")
			}
		} else {
			total += int(s.Quota)
		}
		all += len(pool)
		if len(s.Topics) > 100 {
			return bad("в разделе допускается не больше 100 тем")
		}
		if err := validateTopics(b, s); err != nil {
			return err
		}
	}

	if (!IsReadyExam(b) && total < 1) || total > 500 || all > 10000 {
		return bad("в варианте должно быть 1–500 заданий, в банке — не больше 10000")
	}
	return nil
}
func (m *Module) BankSave(ctx context.Context, req *connect.Request[pb.BankSaveRequest]) (*connect.Response[pb.BankSaveResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	b := req.Msg.Bank
	if err := Validate(b); err != nil {
		return nil, err
	}
	// Review metadata is retained for compatibility, but review is temporarily not required.
	payload, err := protojson.Marshal(b)
	if err != nil {
		return nil, bad("неверный формат банка")
	}
	record := BankRecord{ID: b.Id, Revision: 1, Payload: payload, UpdatedAt: time.Now()}
	if b.Id == 0 {
		err = m.db.WithContext(ctx).Create(&record).Error
	} else {
		result := m.db.WithContext(ctx).Model(&BankRecord{}).Where("id=? AND revision=?", b.Id, b.Revision).Updates(map[string]any{"payload": payload, "revision": b.Revision + 1, "updated_at": time.Now()})
		err = result.Error
		if err == nil && result.RowsAffected == 0 {
			return nil, connect.NewError(connect.CodeAborted, errors.New("банк изменён другим редактором — обновите страницу"))
		}
		record.Revision = b.Revision + 1
	}
	if err != nil {
		return nil, dbError(err)
	}
	b.Id = record.ID
	b.Revision = record.Revision
	return connect.NewResponse(&pb.BankSaveResponse{Bank: b}), nil
}
func (m *Module) BankDelete(ctx context.Context, req *connect.Request[pb.BankDeleteRequest]) (*connect.Response[pb.BankDeleteResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	result := m.db.WithContext(ctx).Where("id=? AND revision=?", req.Msg.Id, req.Msg.Revision).Delete(&BankRecord{})
	if result.Error != nil {
		return nil, dbError(result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, connect.NewError(connect.CodeAborted, errors.New("банк уже изменён или удалён"))
	}
	return connect.NewResponse(&pb.BankDeleteResponse{}), nil
}
func Settings(b *pb.Bank) models.ExamV2Settings {
	return models.ExamV2Settings{AssessmentKind: b.AssessmentKind, Enabled: true, Specialty: b.Specialty, Faculty: b.Faculty, Semester: int(b.Semester), Discipline: b.Discipline, AcademicYear: b.AcademicYear, Season: b.Season, Excellent: b.Excellent, Good: b.Good, Satisfactory: b.Satisfactory}
}
func (m *Module) VariantsGenerate(ctx context.Context, req *connect.Request[pb.VariantsGenerateRequest]) (*connect.Response[pb.VariantsGenerateResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	out := &pb.VariantsGenerateResponse{}
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var record BankRecord
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&record, req.Msg.BankId).Error; err != nil {
			return dbError(err)
		}
		if record.Revision != req.Msg.Revision {
			return connect.NewError(connect.CodeAborted, errors.New("обновите банк перед генерацией"))
		}
		b, err := Decode(record)
		if err != nil {
			return dbError(err)
		}
		if err := Validate(b); err != nil {
			return err
		}
		plans, err := publicationPlans(b)
		if err != nil {
			return err
		}
		for _, plan := range plans {
			p := params(b, plan.Sections)
			p.Topic = plan.Title
			test, err := models.NewTest(p, time.Now())
			if err != nil {
				return bad(err.Error())
			}
			test.ExamSettings = Settings(b)
			sizes, err := storage.TestStorageNew(tx).TestImages(ctx, test.ImageHashes())
			if err != nil {
				return dbError(err)
			}
			if err := test.SetImageSizes(sizes); err != nil {
				return bad(err.Error())
			}
			if _, err := storage.TestStorageNew(tx).TestCreate(ctx, test); err != nil {
				return dbError(err)
			}
			v := VariantRecord{BankID: b.Id, TestID: &test.ID, Title: test.Topic, DurationMinutes: b.DurationMinutes, ShowResult: b.ShowResult}
			if err := tx.Create(&v).Error; err != nil {
				return dbError(err)
			}
			out.Variants = append(out.Variants, variant(v))
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(out), nil
}
func (m *Module) PreviewFetch(ctx context.Context, req *connect.Request[pb.PreviewFetchRequest]) (*connect.Response[pb.PreviewFetchResponse], error) {
	if err := m.guard(ctx, true); err != nil {
		return nil, err
	}
	test, err := storage.TestStorageNew(m.db).TestByID(ctx, req.Msg.TestId)
	if err != nil {
		return nil, dbError(err)
	}
	if !test.ExamSettings.Enabled {
		return nil, bad("это не вариант V2")
	}
	testDuration := 20
	var variant VariantRecord
	if err := m.db.WithContext(ctx).Where("test_id=?", test.ID).First(&variant).Error; err == nil {
		testDuration = int(variant.DurationMinutes)
	}
	b := &pb.BankSection{} // no attempt, assignment, protocol or statistics is created for a trial student
	for _, q := range test.Questions {
		item := &servicepb.TestQuestionInput{Text: q.Text}
		for _, a := range q.Answers {
			item.Answers = append(item.Answers, &servicepb.TestAnswerInput{Text: a.Text, IsCorrect: a.IsCorrect})
		}
		b.Questions = append(b.Questions, item)
	}
	return connect.NewResponse(&pb.PreviewFetchResponse{Questions: b.Questions, DurationMinutes: int32(testDuration)}), nil
}
