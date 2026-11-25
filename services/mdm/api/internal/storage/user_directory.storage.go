package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	enum "fesmu/contract/mdm/enum"
	pb "fesmu/contract/mdm/service"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
	"strings"
	"time"
)

type directoryUser struct {
	ID                                              int64
	UUID, FirstName, LastName, Patronymic, Position string
	Students                                        []models.Student  `gorm:"foreignKey:UserID"`
	Employees                                       []models.Employee `gorm:"foreignKey:UserID"`
	Roles                                           []models.UserRole `gorm:"foreignKey:UserID"`
}

func (directoryUser) TableName() string { return "users" }

type UserDirectoryStorage struct{ db *gorm.DB }

func UserDirectoryStorageNew(db *gorm.DB) *UserDirectoryStorage { return &UserDirectoryStorage{db} }

// The same derivation as Student.ParseCourse/ParseRecordBookCode, evaluated in
// SQL before pagination. Invalid record books never get cast to numbers.
const directoryFaculty = `CASE WHEN btrim(students.record_book) ~ '^[0-9]{7}$' THEN substring(btrim(students.record_book),1,2)::int ELSE 0 END`

func directoryCourse() string {
	return `CASE WHEN btrim(students.record_book) ~ '^[0-9]{7}$' THEN LEAST(6,GREATEST(1,` + time.Now().Format("2006") + `-(2000+substring(btrim(students.record_book),3,2)::int)+1)) ELSE 0 END`
}
func directoryStudents(q *pb.UserDirectoryFetchRequest, db *gorm.DB) *gorm.DB {
	if q.ActiveStudentsOnly {
		db = db.Where("students.status IN ?", []enum.UserStudentStatus{enum.UserStudentStatus_USER_STUDENT_STATUS_UNSPECIFIED, enum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING, enum.UserStudentStatus_USER_STUDENT_STATUS_RESTORED, enum.UserStudentStatus_USER_STUDENT_STATUS_TRANSFERRED})
	}
	if q.FacultyCode > 0 {
		db = db.Where(directoryFaculty+" = ?", q.FacultyCode)
	}
	if q.Course > 0 {
		db = db.Where(directoryCourse()+" = ?", q.Course)
	}
	if q.StudentGroup != "" {
		db = db.Where(`lower(btrim(students."group")) = lower(?)`, q.StudentGroup)
	}
	if q.RecordBook != "" {
		db = db.Where("btrim(students.record_book) = ?", q.RecordBook)
	}
	if q.StudentStatus != 0 {
		db = db.Where("students.status = ?", q.StudentStatus)
	}
	return db
}
func directoryUsers(q *pb.UserDirectoryFetchRequest, db *gorm.DB) *gorm.DB {
	if q.UserStatus != 0 {
		db = db.Where("users.status=?", q.UserStatus)
	}
	if q.Role != 0 {
		db = db.Where("EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id=users.id AND user_roles.role=?)", q.Role)
	}
	if q.Query != "" {
		escaped := strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(q.Query)
		db = db.Where("concat_ws(' ',users.last_name,users.first_name,users.patronymic) ILIKE ?", "%"+escaped+"%")
	}
	if len(q.UserUuids) > 0 {
		db = db.Where("users.uuid IN ?", q.UserUuids)
	}
	if q.ProfileKind == "student" || q.ActiveStudentsOnly || q.Role == enum.UserRole_USER_ROLE_STUDENT || q.FacultyCode > 0 || q.Course > 0 || q.StudentGroup != "" || q.RecordBook != "" || q.StudentStatus != 0 {
		sub := directoryStudents(q, db.Session(&gorm.Session{NewDB: true}).Table("students").Select("1").Where("students.user_id=users.id"))
		db = db.Where("EXISTS (?)", sub)
	}
	if q.ProfileKind == "employee" || q.EmployeeDepartment != 0 || q.EmployeePosition != "" {
		sub := db.Session(&gorm.Session{NewDB: true}).Table("employees").Select("1").Where("employees.user_id=users.id")
		if q.EmployeeDepartment != 0 {
			sub = sub.Where("department=?", q.EmployeeDepartment)
		}
		if q.EmployeePosition != "" {
			db = db.Where("lower(btrim(users.position))=lower(?)", q.EmployeePosition)
		}
		db = db.Where("EXISTS (?)", sub)
	}
	return db
}
func (s *UserDirectoryStorage) UserDirectoryFetch(ctx context.Context, q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	out := &pb.UserDirectoryFetchResponse{ProfileKind: q.ProfileKind}
	base := func() *gorm.DB { return directoryUsers(q, s.db.WithContext(ctx).Model(&directoryUser{})) }
	if err := base().Count(&out.Total).Error; err != nil {
		return nil, err
	}
	var users []directoryUser
	// A fixed number of bulk queries; no per-user profile/StudentFetch calls.
	records := base().Select("users.id,users.uuid,users.first_name,users.last_name,users.patronymic,users.position").Preload("Roles")
	if q.ProfileKind != "employee" && q.Role != enum.UserRole_USER_ROLE_STAFF && q.Role != enum.UserRole_USER_ROLE_TEACHER {
		records = records.Preload("Students", func(db *gorm.DB) *gorm.DB { return directoryStudents(q, db).Order("students.id DESC") })
	}
	if q.ProfileKind != "student" && q.Role != enum.UserRole_USER_ROLE_STUDENT {
		records = records.Preload("Employees")
	}
	if err := records.Order("users.last_name,users.first_name,users.id").Limit(int(q.Limit)).Offset(int(q.Offset)).Find(&users).Error; err != nil {
		return nil, err
	}
	for _, u := range users {
		entry := &pb.UserDirectoryEntry{Uuid: u.UUID, FullName: strings.Join(strings.Fields(u.LastName+" "+u.FirstName+" "+u.Patronymic), " ")}
		for _, r := range u.Roles {
			entry.Roles = append(entry.Roles, r.Role)
		}
		for _, st := range u.Students {
			faculty, _, _ := st.ParseRecordBookCode()
			course, _ := st.ParseCourse()
			facultyName, _ := st.ParseFaculty()
			entry.Students = append(entry.Students, &pb.UserDirectoryStudent{FacultyCode: int32(faculty), Course: int32(course), Group: st.Group, Status: st.Status, FacultyName: facultyName})
		}
		for _, e := range u.Employees {
			entry.Employees = append(entry.Employees, &pb.UserDirectoryEmployee{Department: e.Department, Position: u.Position})
		}
		out.Users = append(out.Users, entry)
	}
	if int64(q.Offset)+int64(len(users)) < out.Total {
		out.NextOffset = q.Offset + int32(len(users))
	}
	if q.IncludeFacets {
		// Facets intentionally ignore name/course/group/pagination so changing one
		// selector does not require separate requests for every group or course.
		f := proto.Clone(q).(*pb.UserDirectoryFetchRequest)
		f.Query = ""
		f.FacultyCode = 0
		f.Course = 0
		f.StudentGroup = ""
		f.RecordBook = ""
		f.UserUuids = nil
		ids := directoryUsers(f, s.db.WithContext(ctx).Table("users").Select("users.id"))
		var rows []struct {
			FacultyCode, Course int32
			Group               string
			Count               int32
		}
		query := s.db.WithContext(ctx).Table("students").Select(directoryFaculty+" AS faculty_code,"+directoryCourse()+` AS course, btrim(students."group") AS "group",count(DISTINCT students.user_id) AS count`).Where("students.user_id IN (?)", ids)
		query = directoryStudents(f, query)
		if err := query.Group(`faculty_code,course,btrim(students."group")`).Order(`faculty_code,course,btrim(students."group")`).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			facultyName, _ := models.FacultyName(int(row.FacultyCode))
			out.StudentFacets = append(out.StudentFacets, &pb.UserDirectoryStudentFacet{FacultyCode: row.FacultyCode, Course: row.Course, Group: row.Group, Count: row.Count, FacultyName: facultyName})
		}
	}
	return out, nil
}
