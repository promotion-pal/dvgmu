package word

import (
	"log/slog"
	"os"
	"testing"

	mdmentity "dvgmu/file/contract/gen/go/mdm/entity"
	mdmenum "dvgmu/file/contract/gen/go/mdm/enum"
)

func TestApplicationCertificateEnrollmentSmoke(t *testing.T) {
	g := NewGenerator("../../../../docs", slog.Default())

	patronymic := "Русланович"
	profile := &mdmentity.UserFull{
		User: &mdmentity.User{
			FirstName:  "Ростислав",
			LastName:   "Коноплев",
			Patronymic: &patronymic,
		},
		Student: &mdmentity.Student{
			Group:         "20309",
			RecordBook:    "2024139",
			EducationForm: mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET,
		},
	}

	content, err := g.ApplicationCertificateEnrollment(profile)
	if err != nil {
		t.Fatalf("ApplicationCertificateEnrollment() error = %v", err)
	}
	if len(content) == 0 {
		t.Fatal("ApplicationCertificateEnrollment() returned empty content")
	}
	os.WriteFile("/tmp/application_certificate_enrollment_out.docx", content, 0644)
}
