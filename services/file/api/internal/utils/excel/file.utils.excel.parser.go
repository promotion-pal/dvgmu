package excel

import (
	"fmt"
	"io"
	"strings"
)

type FileExcelUserParserType struct {
	FirstName  string
	LastName   string
	Patronymic string
}

func (p *Parser) FileExcelUserParser(data io.Reader) ([]FileExcelUserParserType, error) {
	f, _, rows, err := p.openExcelSheet(data)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			p.log.Error("failed to close excel file", "error", err)
		}
	}()

	var users []FileExcelUserParserType

	for rowIndex, row := range rows {
		if len(row) != 1 {
			continue
		}

		lastName, firstName, patronymic := splitFullName(strings.TrimSpace(row[0]))
		if lastName == "" || firstName == "" {
			continue
		}

		user := FileExcelUserParserType{
			FirstName:  firstName,
			LastName:   lastName,
			Patronymic: patronymic,
		}

		users = append(users, user)

		p.log.Info("parsed user row",
			"row", rowIndex+1,
			"name", fmt.Sprintf("%s %s %s", user.LastName, user.FirstName, user.Patronymic),
		)
	}

	if len(users) == 0 {
		return nil, ErrParseExcelUsers
	}

	return users, nil
}

type FileExcelStudentParserType struct {
	FirstName  string
	LastName   string
	Patronymic string

	Course              string
	EducationForm       string
	Status              string
	Group               string
	RecordBookNumber    string
	Snils               string
	PassportNumber      string
	DepartmentCode      string
	Authority           string
	PassportIssueDate   string
	Nationality         string
	Birthday            string
	BirthPlace          string
	Gender              string
	EducationType       string
	EducationSeries     string
	EducationIssueDate  string
	Honors              string
	InstitutionName     string
	Phone               string
	Mobile              string
	Email               string
	NeedsDormitory      string
	ResidentialAddress  string
	RegistrationAddress string
	Commissariat        string
	RegCert             string
	VusCode             string
	Rank                string
	MilTicket           string
}

func normHeader(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

var studentHeaderAliases = map[string]string{
	"фамилия, имя, отчество": "full_name",
	"фио":                     "full_name",
	"ф.и.о.":                  "full_name",
	"курс":                    "course",
	"условия обучения":        "education_form",
	"статус":                  "status",
	"группа":                  "group",
	"№ зачет книжки":          "record_book",
	"№ зачетной книжки":       "record_book",
	"снилс":                   "snils",
	"номер паспорта":          "passport_number",
	"код подр.":               "department_code",
	"кем выдан":               "authority",
	"дата выдачи":             "passport_issue_date",
	"гражданство":             "nationality",
	"дата рождения":           "birthday",
	"место рождения":          "birth_place",
	"пол":                     "gender",
	"тип документа":           "education_type",
	"серия и номер":           "education_series",
	"даты выдачи":             "education_issue_date",
	"отличия":                 "honors",
	"название":                "institution_name",
	"телефон":                 "phone",
	"мобильный":               "mobile",
	"email":                   "email",
	"общежитие":               "needs_dormitory",
	"место жительства":        "residential_address",
	"адрес по прописке":       "registration_address",
	"военкомат":               "commissariat",
	"приписное свидетельство": "reg_cert",
	"военная специальность":   "vus_code",
	"воинское звание":         "rank",
	"военный билет":           "mil_ticket",
}

func locateStudentHeader(rows [][]string) (int, map[string]int, error) {
	bestRow, bestScore := -1, 0
	limit := len(rows)
	if limit > 25 {
		limit = 25
	}
	for i := 0; i < limit; i++ {
		score := 0
		for _, cell := range rows[i] {
			if _, ok := studentHeaderAliases[normHeader(cell)]; ok {
				score++
			}
		}
		if score > bestScore {
			bestRow, bestScore = i, score
		}
	}
	if bestRow == -1 || bestScore < 3 {
		return 0, nil, ErrStudentHeaderNotFound
	}

	cols := make(map[string]int)
	assign := func(row []string) {
		for idx, cell := range row {
			key, ok := studentHeaderAliases[normHeader(cell)]
			if !ok {
				continue
			}
			if _, taken := cols[key]; !taken {
				cols[key] = idx
			}
		}
	}
	assign(rows[bestRow])
	if bestRow > 0 {
		assign(rows[bestRow-1])
	}

	return bestRow, cols, nil
}

func (p *Parser) FileExcelStudentParser(data io.Reader) ([]FileExcelStudentParserType, error) {
	f, sheetName, rows, err := p.openExcelSheet(data)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			p.log.Error("failed to close excel file", "error", err)
		}
	}()

	headerRow, cols, err := locateStudentHeader(rows)
	if err != nil {
		p.log.Error("failed to locate student header row", "error", err)
		return nil, err
	}

	fullNameIdx, hasFullName := cols["full_name"]
	if !hasFullName {
		if courseIdx, ok := cols["course"]; ok && courseIdx-2 >= 0 {
			fullNameIdx, hasFullName = courseIdx-2, true
		}
	}
	if !hasFullName {
		return nil, ErrStudentRequiredColumns
	}

	col := func(row []string, key string) string {
		idx, ok := cols[key]
		if !ok {
			return ""
		}
		return strings.TrimSpace(colAt(row, idx))
	}
	rawIDCol := func(row []string, rowIndex int, key string) string {
		idx, ok := cols[key]
		if !ok {
			return ""
		}
		return strings.TrimSpace(rawIDCellAt(f, sheetName, row, rowIndex, idx))
	}
	dateCol := func(row []string, rowIndex int, key string) string {
		idx, ok := cols[key]
		if !ok {
			return ""
		}
		return strings.TrimSpace(dateCellAt(f, sheetName, row, rowIndex, idx))
	}

	var students []FileExcelStudentParserType

	for rowIndex := headerRow + 1; rowIndex < len(rows); rowIndex++ {
		row := rows[rowIndex]

		fullName := strings.TrimSpace(colAt(row, fullNameIdx))
		if fullName == "" {
			p.log.Warn("row is missing name, skipping", "row_index", rowIndex+1)
			continue
		}

		lastName, firstName, patronymic := splitFullName(fullName)
		if lastName == "" || firstName == "" {
			p.log.Warn("row does not look like a full name, skipping", "row_index", rowIndex+1, "value", fullName)
			continue
		}

		student := FileExcelStudentParserType{
			FirstName:  firstName,
			LastName:   lastName,
			Patronymic: patronymic,

			Course:              col(row, "course"),
			EducationForm:       col(row, "education_form"),
			Status:              col(row, "status"),
			Group:               col(row, "group"),
			RecordBookNumber:    rawIDCol(row, rowIndex, "record_book"),
			Snils:               rawIDCol(row, rowIndex, "snils"),
			PassportNumber:      rawIDCol(row, rowIndex, "passport_number"),
			DepartmentCode:      col(row, "department_code"),
			Authority:           col(row, "authority"),
			PassportIssueDate:   dateCol(row, rowIndex, "passport_issue_date"),
			Nationality:         col(row, "nationality"),
			Birthday:            dateCol(row, rowIndex, "birthday"),
			BirthPlace:          col(row, "birth_place"),
			Gender:              col(row, "gender"),
			EducationType:       col(row, "education_type"),
			EducationSeries:     rawIDCol(row, rowIndex, "education_series"),
			EducationIssueDate:  dateCol(row, rowIndex, "education_issue_date"),
			Honors:              col(row, "honors"),
			InstitutionName:     col(row, "institution_name"),
			Phone:               col(row, "phone"),
			Mobile:              col(row, "mobile"),
			Email:               col(row, "email"),
			NeedsDormitory:      col(row, "needs_dormitory"),
			ResidentialAddress:  col(row, "residential_address"),
			RegistrationAddress: col(row, "registration_address"),
			Commissariat:        col(row, "commissariat"),
			RegCert:             col(row, "reg_cert"),
			VusCode:             rawIDCol(row, rowIndex, "vus_code"),
			Rank:                col(row, "rank"),
			MilTicket:           col(row, "mil_ticket"),
		}

		students = append(students, student)

		p.log.Info("parsed student row",
			"row", rowIndex+1,
			"name", fmt.Sprintf("%s %s %s", student.LastName, student.FirstName, student.Patronymic),
			"email", student.Email,
		)
	}

	if len(students) == 0 {
		return nil, ErrStudentNoRows
	}

	return students, nil
}

func colAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return row[idx]
}
