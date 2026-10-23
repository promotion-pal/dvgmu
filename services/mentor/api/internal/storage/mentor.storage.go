package storage

import (
	"context"
	"errors"
	"log/slog"

	"gorm.io/gorm"

	"dvgmu/api/internal/domain/models"
)

type MentorStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func MentorStorageNew(db *gorm.DB, log *slog.Logger) *MentorStorage {
	return &MentorStorage{
		db:  db,
		log: log,
	}
}

func (s *MentorStorage) ApplicationCreate(ctx context.Context, application *models.MentorApplication) (int64, error) {
	if err := s.db.WithContext(ctx).Create(application).Error; err != nil {
		s.log.Error("failed to create mentor application", "error", err.Error())
		return 0, err
	}
	return application.ID, nil
}

func (s *MentorStorage) ApplicationByID(ctx context.Context, id int64) (*models.MentorApplication, error) {
	var application models.MentorApplication
	if err := s.db.WithContext(ctx).First(&application, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch mentor application by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &application, nil
}

func (s *MentorStorage) ApplicationFetch(ctx context.Context, courseID int64, page, pageSize int32) ([]models.MentorApplication, error) {
	query := s.db.WithContext(ctx).Order("id")
	if courseID != 0 {
		query = query.Where("course_id = ?", courseID)
	}
	if pageSize > 0 {
		query = query.Limit(int(pageSize))
		if page > 0 {
			query = query.Offset(int(page-1) * int(pageSize))
		}
	}

	var applications []models.MentorApplication
	if err := query.Find(&applications).Error; err != nil {
		s.log.Error("failed to fetch mentor applications", "error", err.Error())
		return nil, err
	}
	return applications, nil
}

func (s *MentorStorage) ApplicationUpdate(ctx context.Context, application *models.MentorApplication) error {
	if err := s.db.WithContext(ctx).Model(&models.MentorApplication{}).
		Where("id = ?", application.ID).
		Updates(map[string]any{
			"first_name": application.FirstName,
			"last_name":  application.LastName,
			"patronymic": application.Patronymic,
			"email":      application.Email,
			"course_id":  application.CourseID,
		}).Error; err != nil {
		s.log.Error("failed to update mentor application", "id", application.ID, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) ApplicationMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.db.WithContext(ctx).Model(&models.MentorApplication{}).
		Where("id = ?", id).
		Updates(map[string]any{"is_done": isDone}).Error; err != nil {
		s.log.Error("failed to mark mentor application done", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) ApplicationDelete(ctx context.Context, id int64) error {
	if err := s.db.WithContext(ctx).Delete(&models.MentorApplication{}, id).Error; err != nil {
		s.log.Error("failed to delete mentor application", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) CourseCreate(ctx context.Context, course *models.MentorCourse) (int64, error) {
	if err := s.db.WithContext(ctx).Create(course).Error; err != nil {
		s.log.Error("failed to create mentor course", "error", err.Error())
		return 0, err
	}
	return course.ID, nil
}

func (s *MentorStorage) CourseByID(ctx context.Context, id int64) (*models.MentorCourse, error) {
	var course models.MentorCourse
	if err := s.db.WithContext(ctx).First(&course, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch mentor course by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &course, nil
}

func (s *MentorStorage) CourseFetch(ctx context.Context, page, pageSize int32) ([]models.MentorCourse, error) {
	query := s.db.WithContext(ctx).Order("id")
	if pageSize > 0 {
		query = query.Limit(int(pageSize))
		if page > 0 {
			query = query.Offset(int(page-1) * int(pageSize))
		}
	}

	var courses []models.MentorCourse
	if err := query.Find(&courses).Error; err != nil {
		s.log.Error("failed to fetch mentor courses", "error", err.Error())
		return nil, err
	}
	return courses, nil
}

func (s *MentorStorage) CourseUpdate(ctx context.Context, course *models.MentorCourse) error {
	if err := s.db.WithContext(ctx).Model(&models.MentorCourse{}).
		Where("id = ?", course.ID).
		Updates(map[string]any{
			"start_date": course.StartDate,
			"end_date":   course.EndDate,
		}).Error; err != nil {
		s.log.Error("failed to update mentor course", "id", course.ID, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) CourseDelete(ctx context.Context, id int64) error {
	if err := s.db.WithContext(ctx).Delete(&models.MentorCourse{}, id).Error; err != nil {
		s.log.Error("failed to delete mentor course", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) QuestionCreate(ctx context.Context, question *models.MentorQuestion) (int64, error) {
	if err := s.db.WithContext(ctx).Create(question).Error; err != nil {
		s.log.Error("failed to create mentor question", "error", err.Error())
		return 0, err
	}
	return question.ID, nil
}

func (s *MentorStorage) QuestionFetch(ctx context.Context, page, pageSize int32) ([]models.MentorQuestion, error) {
	query := s.db.WithContext(ctx).Order("id")
	if pageSize > 0 {
		query = query.Limit(int(pageSize))
		if page > 0 {
			query = query.Offset(int(page-1) * int(pageSize))
		}
	}

	var questions []models.MentorQuestion
	if err := query.Find(&questions).Error; err != nil {
		s.log.Error("failed to fetch mentor questions", "error", err.Error())
		return nil, err
	}
	return questions, nil
}

func (s *MentorStorage) QuestionMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.db.WithContext(ctx).Model(&models.MentorQuestion{}).
		Where("id = ?", id).
		Updates(map[string]any{"is_done": isDone}).Error; err != nil {
		s.log.Error("failed to mark mentor question done", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) QuestionDelete(ctx context.Context, id int64) error {
	if err := s.db.WithContext(ctx).Delete(&models.MentorQuestion{}, id).Error; err != nil {
		s.log.Error("failed to delete mentor question", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) TechnicalQuestionCreate(ctx context.Context, question *models.MentorTechnicalQuestion) (int64, error) {
	if err := s.db.WithContext(ctx).Create(question).Error; err != nil {
		s.log.Error("failed to create mentor technical question", "error", err.Error())
		return 0, err
	}
	return question.ID, nil
}

func (s *MentorStorage) TechnicalQuestionFetch(ctx context.Context, courseID int64, page, pageSize int32) ([]models.MentorTechnicalQuestion, error) {
	query := s.db.WithContext(ctx).Order("id")
	if courseID != 0 {
		query = query.Where("course_id = ?", courseID)
	}
	if pageSize > 0 {
		query = query.Limit(int(pageSize))
		if page > 0 {
			query = query.Offset(int(page-1) * int(pageSize))
		}
	}

	var questions []models.MentorTechnicalQuestion
	if err := query.Find(&questions).Error; err != nil {
		s.log.Error("failed to fetch mentor technical questions", "error", err.Error())
		return nil, err
	}
	return questions, nil
}

func (s *MentorStorage) TechnicalQuestionMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.db.WithContext(ctx).Model(&models.MentorTechnicalQuestion{}).
		Where("id = ?", id).
		Updates(map[string]any{"is_done": isDone}).Error; err != nil {
		s.log.Error("failed to mark mentor technical question done", "id", id, "error", err.Error())
		return err
	}
	return nil
}

func (s *MentorStorage) TechnicalQuestionDelete(ctx context.Context, id int64) error {
	if err := s.db.WithContext(ctx).Delete(&models.MentorTechnicalQuestion{}, id).Error; err != nil {
		s.log.Error("failed to delete mentor technical question", "id", id, "error", err.Error())
		return err
	}
	return nil
}
