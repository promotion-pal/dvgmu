package word

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	mdmentity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
)

const dateLayout = "02.01.2006"

type DormitoryApplicationParams struct {
	Room       int32
	Building   int32
	PeriodFrom string
	PeriodTo   string
	Address    string
}

type TemporaryResidenceParams struct {
	PeriodFrom        string
	PeriodTo          string
	Official          string
	RoomOwner         string
	RoomOwnerPosition string
}

// Every method below renders one template from an MDM profile. Missing
// optional data (passport, phone, an unparseable record book) is logged and
// left blank rather than failing the document.

func (g *Generator) ApplicationDormitoryStudent(profile *mdmentity.UserFull, p DormitoryApplicationParams) ([]byte, error) {
	user, student, err := requireStudent(profile)
	if err != nil {
		return nil, err
	}

	faculty, facultyAdj, dean, err := facultyInfo(student.GetRecordBook())
	if err != nil {
		g.log.Warn("failed to derive faculty from record book, leaving it blank", "error", err.Error())
	}

	r := merge(
		fullName(user),
		g.passportFields(profile),
		map[string]string{
			"faculty":    faculty,
			"facultyAbj": facultyAdj,
			"dean":       dean,
			"group":      student.GetGroup(),
			"phone":      user.GetPhone(),
			"birthday":   formatBirthday(user),
			"birthPlace": strings.ToUpper(strings.TrimSpace(profile.GetPassport().GetBirthPlace())),
			"periodFrom": p.PeriodFrom,
			"periodTo":   p.PeriodTo,
			"room":       strconv.Itoa(int(p.Room)),
			"location":   strconv.Itoa(int(p.Building)),
			"nowDate":    now(),
		},
	)
	return g.fill(TemplateApplicationDormitoryStudent, r)
}

func (g *Generator) ApplicationDormitoryStudentFull(profile *mdmentity.UserFull, p DormitoryApplicationParams) ([]byte, error) {
	user, student, err := requireStudent(profile)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(p.Address) == "" {
		return nil, ErrDormitoryAddress
	}

	educationForm, err := educationFormLabel(student.GetEducationForm())
	if err != nil {
		g.log.Warn("failed to derive education form, leaving it blank", "error", err.Error())
	}

	r := merge(
		fullName(user),
		g.passportFields(profile),
		map[string]string{
			"educationForm":     educationForm,
			"dormitory_address": p.Address,
			"periodFrom":        p.PeriodFrom,
			"periodTo":          p.PeriodTo,
			"room":              strconv.Itoa(int(p.Room)),
			"nowDate":           now(),
		},
	)
	return g.fill(TemplateApplicationDormitoryStudentFull, r)
}

func (g *Generator) ApplicationDormitoryAbitur(profile *mdmentity.UserFull, p DormitoryApplicationParams) ([]byte, error) {
	if profile == nil || profile.GetUser() == nil {
		return nil, ErrProfileRequired
	}

	r := merge(
		fullName(profile.GetUser()),
		map[string]string{
			"periodFrom": p.PeriodFrom,
			"periodTo":   p.PeriodTo,
			"room":       strconv.Itoa(int(p.Room)),
			"location":   strconv.Itoa(int(p.Building)),
			"nowDate":    now(),
		},
	)
	return g.fill(TemplateApplicationDormitoryAbitur, r)
}

func (g *Generator) ApplicationTemporaryResidence(profile *mdmentity.UserFull, p TemporaryResidenceParams) ([]byte, error) {
	if profile == nil || profile.GetUser() == nil {
		return nil, ErrProfileRequired
	}
	user := profile.GetUser()
	passport := profile.GetPassport()

	r := merge(
		g.passportFields(profile),
		map[string]string{
			"firstName":         user.GetFirstName(),
			"lastName":          user.GetLastName(),
			"patronymic":        user.GetPatronymic(),
			"birthday":          formatBirthday(user),
			"birthPlace":        strings.ToUpper(strings.TrimSpace(passport.GetBirthPlace())),
			"departmentCode":    passport.GetDepartmentCode(),
			"gender":            genderLabel(passport.GetGender()),
			"nationality":       nationalityLabel(passport.GetNationality()),
			"periodFrom":        p.PeriodFrom,
			"periodTo":          p.PeriodTo,
			"official":          p.Official,
			"roomOwner":         p.RoomOwner,
			"roomOwnerPosition": p.RoomOwnerPosition,
		},
	)
	return g.fill(TemplateApplicationTemporaryResidence, r)
}

// StudyCertificate renders "справка об обучении" — proof of current
// enrollment. Order number/date and the outgoing certificate number aren't
// tracked anywhere in MDM, so those stay blank on the template for the
// deanery to fill in by hand when they countersign it.
func (g *Generator) StudyCertificate(profile *mdmentity.UserFull) ([]byte, error) {
	user, student, err := requireStudent(profile)
	if err != nil {
		return nil, err
	}

	_, facultyAdj, dean, err := facultyInfo(student.GetRecordBook())
	if err != nil {
		g.log.Warn("failed to derive faculty from record book, leaving it blank", "error", err.Error())
	}
	// facultyInfo's adjective is meant for "... ф." phrasing elsewhere; this
	// template's static text already reads "Декан <adj> факультета".
	facultyAdjLower := strings.ToLower(strings.TrimSuffix(facultyAdj, " ф."))

	admissionYear, course, err := courseFromRecordBook(student.GetRecordBook())
	courseStr := ""
	if err != nil {
		g.log.Warn("failed to derive course from record book, leaving it blank", "error", err.Error())
	} else {
		courseStr = strconv.Itoa(course)
	}

	specialty, years, err := specialtyInfo(student.GetRecordBook())
	if err != nil {
		g.log.Warn("no confirmed specialty/term for this faculty, leaving dates blank", "error", err.Error())
	}

	startDate, endDate, normativeTerm := "", "", ""
	if admissionYear > 0 && years > 0 {
		startDate = fmt.Sprintf("01.09.%d", admissionYear)
		endDate = fmt.Sprintf("30.06.%d", admissionYear+years)
		normativeTerm = fmt.Sprintf("%d %s", years, yearsWord(years))
	}

	fundingSource, err := fundingSourceLabel(student.GetEducationForm())
	if err != nil {
		g.log.Warn("failed to derive funding source, leaving it blank", "error", err.Error())
	}

	r := merge(
		fullName(user),
		map[string]string{
			"birthday":      formatBirthday(user),
			"course":        courseStr,
			"specialty":     specialty,
			"startDate":     startDate,
			"endDate":       endDate,
			"normativeTerm": normativeTerm,
			"fundingSource": fundingSource,
			"facultyAbj":    facultyAdjLower,
			"dean":          dean,
		},
	)
	return g.fill(TemplateStudyCertificate, r)
}

// ApplicationCertificateEnrollment renders another wording of the same
// "справка об обучении" as StudyCertificate — same source data and the same
// derived faculty/course/specialty/funding-source rules, just a different
// layout with an added scholarship-availability line. Order number/date
// aren't tracked in MDM either, so they're left blank on the template for
// the deanery to fill in by hand, same as StudyCertificate.
func (g *Generator) ApplicationCertificateEnrollment(profile *mdmentity.UserFull) ([]byte, error) {
	user, student, err := requireStudent(profile)
	if err != nil {
		return nil, err
	}

	_, facultyAdj, dean, err := facultyInfo(student.GetRecordBook())
	if err != nil {
		g.log.Warn("failed to derive faculty from record book, leaving it blank", "error", err.Error())
	}
	facultyAdjLower := strings.ToLower(strings.TrimSuffix(facultyAdj, " ф."))

	admissionYear, course, err := courseFromRecordBook(student.GetRecordBook())
	courseStr := ""
	if err != nil {
		g.log.Warn("failed to derive course from record book, leaving it blank", "error", err.Error())
	} else {
		courseStr = strconv.Itoa(course)
	}

	specialty, years, err := specialtyInfo(student.GetRecordBook())
	if err != nil {
		g.log.Warn("no confirmed specialty/term for this faculty, leaving dates blank", "error", err.Error())
	}

	startDate, endDate, normativeTerm := "", "", ""
	if admissionYear > 0 && years > 0 {
		startDate = fmt.Sprintf("01.09.%d", admissionYear)
		endDate = fmt.Sprintf("30.06.%d", admissionYear+years)
		normativeTerm = fmt.Sprintf("%d %s", years, yearsWord(years))
	}

	fundingSource, err := fundingSourceLabel(student.GetEducationForm())
	if err != nil {
		g.log.Warn("failed to derive funding source, leaving it blank", "error", err.Error())
	}

	scholarship, err := scholarshipLabel(student.GetEducationForm())
	if err != nil {
		g.log.Warn("failed to derive scholarship availability, leaving it blank", "error", err.Error())
	}

	r := merge(
		fullName(user),
		map[string]string{
			"birthday":      formatBirthday(user),
			"course":        courseStr,
			"specialty":     specialty,
			"startDate":     startDate,
			"endDate":       endDate,
			"normativeTerm": normativeTerm,
			"fundingSource": fundingSource,
			"facultyAbj":    facultyAdjLower,
			"dean":          dean,
			"scholarship":   scholarship,
		},
	)
	return g.fill(TemplateApplicationCertificateEnrollment, r)
}

func (g *Generator) MilitaryRegistrationCard(profile *mdmentity.UserFull) ([]byte, error) {
	if profile == nil || profile.GetUser() == nil {
		return nil, ErrProfileRequired
	}
	user := profile.GetUser()
	passport := profile.GetPassport()
	if passport == nil {
		g.log.Warn("profile has no passport on file, leaving passport fields blank", "user_id", user.GetId())
	}

	r := merge(
		fullName(user),
		map[string]string{
			"phone":                user.GetPhone(),
			"birthday":             formatBirthday(user),
			"passportSeries":       passport.GetSeries(),
			"passportNumber":       passport.GetNumber(),
			"issueDate":            passport.GetIssueDate(),
			"authority":            passport.GetAuthority(),
			"department_code":      passport.GetDepartmentCode(),
			"birth_place":          passport.GetBirthPlace(),
			"snils":                passport.GetSnils(),
			"registration_address": passport.GetRegistrationAddress(),
			"registration_date":    passport.GetRegistrationDate(),
			"residential_address":  passport.GetResidentialAddress(),
		},
	)
	return g.fill(TemplateMilitaryRegistrationCard, r)
}

func requireStudent(profile *mdmentity.UserFull) (*mdmentity.User, *mdmentity.Student, error) {
	if profile == nil || profile.GetUser() == nil {
		return nil, nil, ErrProfileRequired
	}
	if profile.GetStudent() == nil {
		return nil, nil, ErrStudentRequired
	}
	return profile.GetUser(), profile.GetStudent(), nil
}

func fullName(user *mdmentity.User) map[string]string {
	return map[string]string{
		"last_name":  user.GetLastName(),
		"first_name": user.GetFirstName(),
		"patronymic": user.GetPatronymic(),
	}
}

func (g *Generator) passportFields(profile *mdmentity.UserFull) map[string]string {
	passport := profile.GetPassport()
	if passport == nil {
		g.log.Warn("profile has no passport on file, leaving passport fields blank", "user_id", profile.GetUser().GetId())
	}
	return map[string]string{
		"passportSeries":      passport.GetSeries(),
		"passportNumber":      passport.GetNumber(),
		"issueDate":           passport.GetIssueDate(),
		"authority":           passport.GetAuthority(),
		"registrationAddress": passport.GetRegistrationAddress(),
	}
}

func merge(parts ...map[string]string) map[string]string {
	out := map[string]string{}
	for _, part := range parts {
		for k, v := range part {
			out[k] = v
		}
	}
	return out
}

func now() string { return time.Now().Format(dateLayout) }

func formatBirthday(user *mdmentity.User) string {
	if user.GetBirthday() == nil {
		return ""
	}
	return user.GetBirthday().AsTime().Format(dateLayout)
}

func genderLabel(g mdmenum.UserGender) string {
	switch g {
	case mdmenum.UserGender_USER_GENDER_MALE:
		return "Мужской"
	case mdmenum.UserGender_USER_GENDER_FEMALE:
		return "Женский"
	default:
		return ""
	}
}

func nationalityLabel(n mdmenum.UserNationality) string {
	switch n {
	case mdmenum.UserNationality_USER_NATIONALITY_RUS:
		return "Российская Федерация"
	case mdmenum.UserNationality_USER_NATIONALITY_BLR:
		return "Республика Беларусь"
	case mdmenum.UserNationality_USER_NATIONALITY_KAZ:
		return "Республика Казахстан"
	case mdmenum.UserNationality_USER_NATIONALITY_UZB:
		return "Республика Узбекистан"
	case mdmenum.UserNationality_USER_NATIONALITY_KGZ:
		return "Кыргызская Республика"
	case mdmenum.UserNationality_USER_NATIONALITY_CHN:
		return "Китайская Народная Республика"
	default:
		return ""
	}
}

// educationFormLabel mirrors ParseEducationForm in services/mdm
// (student.models.go): MDM is the source of truth, keep the two in sync.
func educationFormLabel(f mdmenum.UserStudentEducationForm) (string, error) {
	switch f {
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET:
		return "Бюджет", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_TARGET:
		return "Целевое", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_CONTRACT:
		return "Контракт", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_SPECIAL_QUOTA:
		return "Специальная квота", nil
	default:
		return "", fmt.Errorf("%w: %d", ErrUnknownEducationForm, f)
	}
}

func facultyInfo(recordBook string) (faculty, adjective, dean string, err error) {
	digits := strings.TrimSpace(recordBook)
	if len(digits) != 7 {
		return "", "", "", fmt.Errorf("%w: expected 7 digits, got %d", ErrInvalidRecordBook, len(digits))
	}
	code, convErr := strconv.Atoi(digits)
	if convErr != nil {
		return "", "", "", fmt.Errorf("%w: not a number", ErrInvalidRecordBook)
	}

	switch code / 100000 {
	case 10:
		return "Лечебный ф.", "Лечебного", "Власюк И. В.", nil
	case 20:
		return "Педиатрический ф.", "Педиатрического ф.", "Каплиева О. В.", nil
	case 30:
		return "Стоматологический ф.", "Стоматологического ф.", "Юркевич А. В.", nil
	case 40:
		return "Фармацевтический ф.", "Фармацевтического ф.", "Слободенюк Е. В.", nil
	case 71:
		return "МГФ", "МГФ", "Витько Е. В.", nil
	default:
		return "", "", "", fmt.Errorf("%w: %d", ErrUnknownFacultyCode, code/100000)
	}
}

// courseFromRecordBook mirrors Student.ParseCourse in services/mdm
// (student.models.go): MDM is the source of truth, keep the two in sync.
func courseFromRecordBook(recordBook string) (admissionYear, course int, err error) {
	digits := strings.TrimSpace(recordBook)
	if len(digits) != 7 {
		return 0, 0, fmt.Errorf("%w: expected 7 digits, got %d", ErrInvalidRecordBook, len(digits))
	}
	code, convErr := strconv.Atoi(digits)
	if convErr != nil {
		return 0, 0, fmt.Errorf("%w: not a number", ErrInvalidRecordBook)
	}

	yearCode := (code % 100000) / 1000
	admissionYear = 2000 + yearCode

	course = time.Now().Year() - admissionYear + 1
	if course < 1 {
		course = 1
	}
	if course > 6 {
		course = 6
	}
	return admissionYear, course, nil
}

// specialtyInfo gives the nationally standardized FGOS code/name and the
// program's normative length in years for a faculty derived from the record
// book. Only the specialties we've confirmed for this university are filled
// in; МГФ (code 71) isn't confirmed yet, so it errors rather than guessing.
func specialtyInfo(recordBook string) (specialty string, years int, err error) {
	digits := strings.TrimSpace(recordBook)
	if len(digits) != 7 {
		return "", 0, fmt.Errorf("%w: expected 7 digits, got %d", ErrInvalidRecordBook, len(digits))
	}
	code, convErr := strconv.Atoi(digits)
	if convErr != nil {
		return "", 0, fmt.Errorf("%w: not a number", ErrInvalidRecordBook)
	}

	switch code / 100000 {
	case 10:
		return "31.05.01 Лечебное дело", 6, nil
	case 20:
		return "31.05.02 Педиатрия", 6, nil
	case 30:
		return "31.05.03 Стоматология", 5, nil
	case 40:
		return "33.05.01 Фармация", 5, nil
	default:
		return "", 0, fmt.Errorf("%w: %d", ErrUnknownFacultyCode, code/100000)
	}
}

// scholarshipLabel says whether a student on this funding basis receives a
// stipend, for ApplicationCertificateEnrollment's "Стипендию {}" line — MDM
// has no explicit scholarship flag, so this reuses the education-form signal
// educationFormLabel/fundingSourceLabel already key off of.
func scholarshipLabel(f mdmenum.UserStudentEducationForm) (string, error) {
	switch f {
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET,
		mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_TARGET,
		mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_SPECIAL_QUOTA:
		return "получает", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_CONTRACT:
		return "не получает", nil
	default:
		return "", fmt.Errorf("%w: %d", ErrUnknownEducationForm, f)
	}
}

// fundingSourceLabel is the genitive phrase for "... за счёт средств {}."
// (StudyCertificate), keyed off the same enum as educationFormLabel.
func fundingSourceLabel(f mdmenum.UserStudentEducationForm) (string, error) {
	switch f {
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET:
		return "федерального бюджета", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_TARGET:
		return "целевого обучения", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_CONTRACT:
		return "договора об оказании платных образовательных услуг", nil
	case mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_SPECIAL_QUOTA:
		return "специальной квоты", nil
	default:
		return "", fmt.Errorf("%w: %d", ErrUnknownEducationForm, f)
	}
}

// yearsWord picks the Russian plural form to follow a number of years
// (1 год, 2-4 года, 5+/0 лет — with the usual 11-14 exception).
func yearsWord(n int) string {
	if n%100 >= 11 && n%100 <= 14 {
		return "лет"
	}
	switch n % 10 {
	case 1:
		return "год"
	case 2, 3, 4:
		return "года"
	default:
		return "лет"
	}
}
