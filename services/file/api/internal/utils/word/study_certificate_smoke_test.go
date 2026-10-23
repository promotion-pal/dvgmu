package word

import (
	"log/slog"
	"os"
	"testing"

	mdmentity "dvgmu/file/contract/gen/go/mdm/entity"
	mdmenum "dvgmu/file/contract/gen/go/mdm/enum"
)

func TestStudyCertificateSmoke(t *testing.T) {
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

	content, err := g.StudyCertificate(profile)
	if err != nil {
		t.Fatalf("StudyCertificate() error = %v", err)
	}
	if len(content) == 0 {
		t.Fatal("StudyCertificate() returned empty content")
	}
	os.WriteFile("/tmp/study_certificate_out.docx", content, 0644)
}
