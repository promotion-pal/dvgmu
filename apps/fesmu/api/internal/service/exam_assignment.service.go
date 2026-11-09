package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"errors"
	pb "fesmu/contract/mdm/service"
	"github.com/google/uuid"
	"regexp"
	"strings"
	"time"
)

type ExamDirectory interface {
	Fetch(context.Context, *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error)
}
type ExamAssignmentStore interface {
	ExamAssigned(context.Context, int64, string) (bool, error)
}

var examRecordBook = regexp.MustCompile(`^[0-9]{7}$`)

func (s *TestSessionService) WithExamDirectory(d ExamDirectory) *TestSessionService {
	s.exam = true
	s.directory = d
	return s
}

func (s *TestSessionService) ExamAudienceFetch(ctx context.Context, input *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	if !s.exam || s.directory == nil {
		return nil, models.ErrExamDirectory
	}
	// This staff endpoint only exposes student selectors, never the employee directory.
	q := &pb.UserDirectoryFetchRequest{ProfileKind: "student", ActiveStudentsOnly: true, Query: input.Query, FacultyCode: input.FacultyCode, Course: input.Course, StudentGroup: input.StudentGroup, Limit: input.Limit, Offset: input.Offset, IncludeFacets: input.IncludeFacets}
	response, err := s.directory.Fetch(ctx, q)
	if err != nil || response.GetProfileKind() != "student" {
		return nil, models.ErrExamDirectory
	}
	for _, entry := range response.Users {
		entry.Employees = nil
	}
	return response, nil
}
func (s *TestSessionService) examRecipients(ctx context.Context, a models.ExamAudience) ([]models.ExamAssignment, error) {
	if s.directory == nil {
		return nil, models.ErrExamDirectory
	}
	q := &pb.UserDirectoryFetchRequest{ProfileKind: "student", ActiveStudentsOnly: true, Limit: 200}
	switch a.Kind {
	case "course":
		if a.FacultyCode <= 0 || a.Course < 1 || a.Course > 6 {
			return nil, models.ErrExamAudience
		}
		q.FacultyCode = a.FacultyCode
		q.Course = a.Course
	case "group":
		if a.FacultyCode <= 0 || a.Course < 1 || a.Course > 6 || strings.TrimSpace(a.StudentGroup) == "" {
			return nil, models.ErrExamAudience
		}
		q.Course = a.Course
		q.StudentGroup = strings.TrimSpace(a.StudentGroup)
		q.FacultyCode = a.FacultyCode
	case "students":
		if len(a.StudentUUIDs) == 0 || len(a.StudentUUIDs) > 200 {
			return nil, models.ErrExamAudience
		}
		for _, id := range a.StudentUUIDs {
			parsed, err := uuid.Parse(id)
			if err != nil {
				return nil, models.ErrExamAudience
			}
			q.UserUuids = append(q.UserUuids, parsed.String())
		}
	default:
		return nil, models.ErrExamAudience
	}
	seen := map[string]bool{}
	result := []models.ExamAssignment{}
	for {
		page, err := s.directory.Fetch(ctx, q)
		if err != nil || page.GetProfileKind() != "student" {
			return nil, models.ErrExamDirectory
		}
		for _, person := range page.Users {
			if _, err := uuid.Parse(person.Uuid); err != nil {
				return nil, models.ErrExamDirectory
			}
			if !seen[person.Uuid] {
				seen[person.Uuid] = true
				group := ""
				if len(person.Students) > 0 {
					group = person.Students[0].Group
				}
				result = append(result, models.ExamAssignment{MDMUserUUID: person.Uuid, FullName: person.FullName, StudentGroup: group, CreatedAt: s.now()})
			}
		}
		if len(result) > 20000 {
			return nil, models.ErrExamAudience
		}
		if page.NextOffset == 0 {
			break
		}
		if page.NextOffset <= q.Offset {
			return nil, models.ErrExamDirectory
		}
		q.Offset = page.NextOffset
	}
	if len(result) == 0 {
		return nil, models.ErrExamAudience
	}
	if a.Kind == "students" {
		for _, id := range q.UserUuids {
			if !seen[id] {
				return nil, models.ErrExamAudience
			}
		}
	}
	return result, nil
}
func (s *TestSessionService) examStudent(ctx context.Context, recordBook string) (*pb.UserDirectoryEntry, error) {
	recordBook = strings.TrimSpace(recordBook)
	if !examRecordBook.MatchString(recordBook) {
		return nil, models.ErrExamStudent
	}
	if s.directory == nil {
		return nil, models.ErrExamDirectory
	}
	page, err := s.directory.Fetch(ctx, &pb.UserDirectoryFetchRequest{ProfileKind: "student", ActiveStudentsOnly: true, RecordBook: recordBook, Limit: 2})
	if err != nil || page.GetProfileKind() != "student" {
		return nil, models.ErrExamDirectory
	}
	if page.Total != 1 || len(page.Users) != 1 || len(page.Users[0].Students) == 0 {
		return nil, models.ErrExamStudent
	}
	return page.Users[0], nil
}
func (s *TestSessionService) examCheck(ctx context.Context, session *models.TestSession, params *models.TestAttemptParams) error {
	student, err := s.examStudent(ctx, params.RecordBook)
	if err != nil {
		return err
	}
	store, ok := s.store.(ExamAssignmentStore)
	if !ok {
		return models.ErrExamDirectory
	}
	assigned, err := store.ExamAssigned(ctx, session.ID, student.Uuid)
	if err != nil {
		return models.ErrExamDirectory
	}
	if !assigned {
		return models.ErrExamNotAssigned
	}
	params.MDMUserUUID = student.Uuid
	params.FullName = student.FullName
	params.StudentGroup = student.Students[0].Group
	if params.FullName == "" {
		return errors.New("MDM returned a student without a name")
	}
	return nil
}

type ExamOnceStore interface {
	ExamStartOnce(context.Context, *models.TestSession, *models.TestAttempt, time.Time) (*models.TestAttempt, *models.TestSession, error)
}

// Recipient names are frozen on issuance. Older assignments are resolved in
// batches by UUID; a directory outage must not hide existing exam results.
func (s *TestSessionService) examSessionRecipients(ctx context.Context, session *models.TestSession) error {
	store, ok := s.store.(interface {
		ExamAssignments(context.Context, int64) ([]models.ExamAssignment, error)
	})
	if !ok {
		return models.ErrExamDirectory
	}
	recipients, err := store.ExamAssignments(ctx, session.ID)
	if err != nil {
		return err
	}
	session.Assignments = recipients
	session.AssignedCount = len(recipients)
	missing := []string{}
	for _, a := range recipients {
		if a.FullName == "" {
			missing = append(missing, a.MDMUserUUID)
		}
	}
	for start := 0; start < len(missing) && s.directory != nil; start += 200 {
		end := start + 200
		if end > len(missing) {
			end = len(missing)
		}
		page, err := s.directory.Fetch(ctx, &pb.UserDirectoryFetchRequest{ProfileKind: "student", UserUuids: missing[start:end], Limit: 200})
		if err != nil || page.GetProfileKind() != "student" {
			break
		}
		byID := map[string]*pb.UserDirectoryEntry{}
		for _, person := range page.Users {
			byID[person.Uuid] = person
		}
		for i := range session.Assignments {
			a := &session.Assignments[i]
			if person := byID[a.MDMUserUUID]; person != nil && a.FullName == "" {
				a.FullName = person.FullName
				if len(person.Students) > 0 {
					a.StudentGroup = person.Students[0].Group
				}
			}
		}
	}
	return nil
}
