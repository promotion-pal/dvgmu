package service

import (
	"context"
	"fmt"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/storage"
)

type MentorService struct {
	storage *storage.MentorStorage
}

func NewMentorService(storage *storage.MentorStorage) *MentorService {
	return &MentorService{storage: storage}
}

func (s *MentorService) ApplicationCreate(ctx context.Context, application *models.MentorApplication) (int64, error) {
	id, err := s.storage.ApplicationCreate(ctx, application)
	if err != nil {
		return 0, fmt.Errorf("create mentor application: %w", err)
	}
	return id, nil
}

func (s *MentorService) ApplicationByID(ctx context.Context, id int64) (*models.MentorApplication, error) {
	application, err := s.storage.ApplicationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get mentor application: %w", err)
	}
	return application, nil
}

func (s *MentorService) ApplicationFetch(ctx context.Context, courseID int64, page, pageSize int32) ([]models.MentorApplication, error) {
	applications, err := s.storage.ApplicationFetch(ctx, courseID, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("fetch mentor applications: %w", err)
	}
	return applications, nil
}

func (s *MentorService) ApplicationUpdate(ctx context.Context, application *models.MentorApplication) error {
	if err := s.storage.ApplicationUpdate(ctx, application); err != nil {
		return fmt.Errorf("update mentor application: %w", err)
	}
	return nil
}

func (s *MentorService) ApplicationMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.storage.ApplicationMarkDone(ctx, id, isDone); err != nil {
		return fmt.Errorf("mark mentor application done: %w", err)
	}
	return nil
}

func (s *MentorService) ApplicationDelete(ctx context.Context, id int64) error {
	if err := s.storage.ApplicationDelete(ctx, id); err != nil {
		return fmt.Errorf("delete mentor application: %w", err)
	}
	return nil
}

func (s *MentorService) CourseCreate(ctx context.Context, course *models.MentorCourse) (int64, error) {
	id, err := s.storage.CourseCreate(ctx, course)
	if err != nil {
		return 0, fmt.Errorf("create mentor course: %w", err)
	}
	return id, nil
}

func (s *MentorService) CourseByID(ctx context.Context, id int64) (*models.MentorCourse, error) {
	course, err := s.storage.CourseByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get mentor course: %w", err)
	}
	return course, nil
}

func (s *MentorService) CourseFetch(ctx context.Context, page, pageSize int32) ([]models.MentorCourse, error) {
	courses, err := s.storage.CourseFetch(ctx, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("fetch mentor courses: %w", err)
	}
	return courses, nil
}

func (s *MentorService) CourseUpdate(ctx context.Context, course *models.MentorCourse) error {
	if err := s.storage.CourseUpdate(ctx, course); err != nil {
		return fmt.Errorf("update mentor course: %w", err)
	}
	return nil
}

func (s *MentorService) CourseDelete(ctx context.Context, id int64) error {
	if err := s.storage.CourseDelete(ctx, id); err != nil {
		return fmt.Errorf("delete mentor course: %w", err)
	}
	return nil
}

func (s *MentorService) QuestionCreate(ctx context.Context, question *models.MentorQuestion) (int64, error) {
	id, err := s.storage.QuestionCreate(ctx, question)
	if err != nil {
		return 0, fmt.Errorf("create mentor question: %w", err)
	}
	return id, nil
}

func (s *MentorService) QuestionFetch(ctx context.Context, page, pageSize int32) ([]models.MentorQuestion, error) {
	questions, err := s.storage.QuestionFetch(ctx, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("fetch mentor questions: %w", err)
	}
	return questions, nil
}

func (s *MentorService) QuestionMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.storage.QuestionMarkDone(ctx, id, isDone); err != nil {
		return fmt.Errorf("mark mentor question done: %w", err)
	}
	return nil
}

func (s *MentorService) QuestionDelete(ctx context.Context, id int64) error {
	if err := s.storage.QuestionDelete(ctx, id); err != nil {
		return fmt.Errorf("delete mentor question: %w", err)
	}
	return nil
}

func (s *MentorService) TechnicalQuestionCreate(ctx context.Context, question *models.MentorTechnicalQuestion) (int64, error) {
	id, err := s.storage.TechnicalQuestionCreate(ctx, question)
	if err != nil {
		return 0, fmt.Errorf("create mentor technical question: %w", err)
	}
	return id, nil
}

func (s *MentorService) TechnicalQuestionFetch(ctx context.Context, courseID int64, page, pageSize int32) ([]models.MentorTechnicalQuestion, error) {
	questions, err := s.storage.TechnicalQuestionFetch(ctx, courseID, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("fetch mentor technical questions: %w", err)
	}
	return questions, nil
}

func (s *MentorService) TechnicalQuestionMarkDone(ctx context.Context, id int64, isDone bool) error {
	if err := s.storage.TechnicalQuestionMarkDone(ctx, id, isDone); err != nil {
		return fmt.Errorf("mark mentor technical question done: %w", err)
	}
	return nil
}

func (s *MentorService) TechnicalQuestionDelete(ctx context.Context, id int64) error {
	if err := s.storage.TechnicalQuestionDelete(ctx, id); err != nil {
		return fmt.Errorf("delete mentor technical question: %w", err)
	}
	return nil
}
