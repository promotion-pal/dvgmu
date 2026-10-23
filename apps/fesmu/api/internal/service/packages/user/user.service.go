// Package user is this api's own capability, not a passthrough to an
// external package: it uploads an Excel file to the files service, then
// creates the parsed rows in the mdm service — as plain users (employee
// sheet) or as users with an attached student record (student sheet).
// Unlike the mdm/tasks proxying (see internal/proxy), this genuinely needs
// typed clients because it combines two services' responses into one.
package user

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	filesenum "dvgmu/api/contract/gen/go/packages/files/enum"
	filespb "dvgmu/api/contract/gen/go/packages/files/service"
	filesserviceconnect "dvgmu/api/contract/gen/go/packages/files/service/serviceconnect"
	mdmentity "dvgmu/api/contract/gen/go/packages/mdm/entity"
	mdmenum "dvgmu/api/contract/gen/go/packages/mdm/enum"
	mdmpb "dvgmu/api/contract/gen/go/packages/mdm/service"
	mdmserviceconnect "dvgmu/api/contract/gen/go/packages/mdm/service/serviceconnect"
	pb "dvgmu/api/contract/gen/go/service/v1"
)

type ImportService struct {
	log         *slog.Logger
	filesClient filesserviceconnect.FilesServiceClient
	mdmClient   mdmserviceconnect.UserServiceClient
}

func NewImportService(log *slog.Logger, filesClient filesserviceconnect.FilesServiceClient, mdmClient mdmserviceconnect.UserServiceClient) *ImportService {
	return &ImportService{log: log, filesClient: filesClient, mdmClient: mdmClient}
}

// EmployeeImportFromExcel parses a name-only sheet. A person already in mdm
// (same full name) is reused, not created again — so re-running the same
// file is safe and only fills in what is missing. Every resolved person gets
// an Employee record (department unspecified: the sheet has none), which is
// what puts them on the «Сотрудники» page.
func (s *ImportService) EmployeeImportFromExcel(ctx context.Context, req *pb.EmployeeImportFromExcelRequest) (*pb.UserImportFromExcelResponse, error) {
	const op = "Import.EmployeeImportFromExcel"
	log := s.log.With(slog.String("op", op), slog.String("file_name", req.GetFileName()))

	uploadResp, err := s.filesClient.FileUpload(ctx, connect.NewRequest(&filespb.FileUploadRequest{
		FileName: req.GetFileName(),
		Type:     filesenum.FileType_FILE_TYPE_EXCEL_PARSER_USER,
		Content:  req.GetContent(),
	}))
	if err != nil {
		log.Error("files service upload failed", slog.String("error", err.Error()))
		return nil, err
	}
	if !uploadResp.Msg.GetSuccess() {
		return nil, errors.New(uploadResp.Msg.GetMessage())
	}

	employees := uploadResp.Msg.GetEmployees()
	log.Info("file parsed", slog.Int("employees", len(employees)))

	existing, err := s.usersByFullName(ctx)
	if err != nil {
		log.Error("fetching existing users for dedup failed", slog.String("error", err.Error()))
		return nil, err
	}
	hasEmployee, err := s.employeeUserIDs(ctx)
	if err != nil {
		log.Error("fetching employees failed", slog.String("error", err.Error()))
		return nil, err
	}

	resp := &pb.UserImportFromExcelResponse{Success: true}

	// Rows → people: an existing one, a new one to create, or ambiguous.
	resolved := make(map[string]int64) // full name → user id, within this run
	var (
		items    []*mdmpb.UserCreateBatchItem
		itemRows []int // file row of each item
		reused   int
	)
	for i, e := range employees {
		key := fullNameKey(e.GetLastName(), e.GetFirstName(), e.GetPatronymic())
		if _, seen := resolved[key]; seen {
			continue // the same person twice in the file
		}
		switch matches := existing[key]; len(matches) {
		case 0:
			resolved[key] = 0
			item := &mdmpb.UserCreateBatchItem{FirstName: e.GetFirstName(), LastName: e.GetLastName()}
			if patronymic := e.GetPatronymic(); patronymic != "" {
				item.Patronymic = &patronymic
			}
			items = append(items, item)
			itemRows = append(itemRows, i)
		case 1:
			resolved[key] = matches[0]
			reused++
		default:
			resolved[key] = -1
			resp.Errors = append(resp.Errors, &pb.UserImportError{
				Index:   int32(i),
				Message: fmt.Sprintf("в MDM %d человека с таким ФИО — запись сотрудника добавьте вручную", len(matches)),
			})
		}
	}

	var newIDs []int64
	if len(items) > 0 {
		createResp, err := s.mdmClient.UserCreateBatch(ctx, connect.NewRequest(&mdmpb.UserCreateBatchRequest{Users: items}))
		if err != nil {
			log.Error("mdm batch create failed", slog.String("error", err.Error()))
			return nil, err
		}
		for _, result := range createResp.Msg.GetResults() {
			idx := int(result.GetIndex())
			if idx < 0 || idx >= len(items) {
				continue
			}
			if !result.GetSuccess() {
				resp.Errors = append(resp.Errors, &pb.UserImportError{Index: int32(itemRows[idx]), Message: result.GetMessage()})
				continue
			}
			newIDs = append(newIDs, result.GetUserId())
			resp.CreatedCount++
			resp.Created = append(resp.Created, &pb.UserImportCreated{
				UserId:    result.GetUserId(),
				FirstName: items[idx].GetFirstName(),
				LastName:  items[idx].GetLastName(),
				Email:     result.GetEmail(),
			})
		}
	}

	// Employee records for everyone resolved who has none yet.
	ids := newIDs
	for _, id := range resolved {
		if id > 0 {
			ids = append(ids, id)
		}
	}
	added := 0
	for _, id := range ids {
		if hasEmployee[id] {
			continue
		}
		hasEmployee[id] = true
		empResp, err := s.mdmClient.EmployeeCreate(ctx, connect.NewRequest(&mdmpb.EmployeeCreateRequest{
			UserId:     id,
			Department: mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_UNSPECIFIED,
		}))
		if err == nil && !empResp.Msg.GetSuccess() {
			err = errors.New(empResp.Msg.GetMessage())
		}
		if err != nil {
			log.Error("employee record creation failed", slog.Int64("user_id", id), slog.String("error", err.Error()))
			resp.Errors = append(resp.Errors, &pb.UserImportError{
				Index:   -1,
				Message: fmt.Sprintf("пользователь %d: не удалось добавить запись сотрудника: %s", id, err.Error()),
			})
			continue
		}
		added++
	}

	resp.Message = fmt.Sprintf("Уже были в MDM: %d · добавлено в «Сотрудники»: %d", reused, added)
	log.Info("import finished", slog.Int("created", int(resp.CreatedCount)), slog.Int("reused", reused),
		slog.Int("employees_added", added), slog.Int("failed", len(resp.Errors)))
	return resp, nil
}

// usersByFullName indexes mdm's users by normalized full name → ids.
func (s *ImportService) usersByFullName(ctx context.Context) (map[string][]int64, error) {
	resp, err := s.mdmClient.UserFetch(ctx, connect.NewRequest(&mdmpb.UserFetchRequest{}))
	if err != nil {
		return nil, err
	}
	out := make(map[string][]int64, len(resp.Msg.GetUsers()))
	for _, u := range resp.Msg.GetUsers() {
		key := fullNameKey(u.GetLastName(), u.GetFirstName(), u.GetPatronymic())
		out[key] = append(out[key], u.GetId())
	}
	return out, nil
}

// employeeUserIDs — users that already have an Employee record.
func (s *ImportService) employeeUserIDs(ctx context.Context) (map[int64]bool, error) {
	resp, err := s.mdmClient.EmployeeFetch(ctx, connect.NewRequest(&mdmpb.EmployeeFetchRequest{}))
	if err != nil {
		return nil, err
	}
	out := make(map[int64]bool, len(resp.Msg.GetEmployees()))
	for _, e := range resp.Msg.GetEmployees() {
		out[e.GetEmployee().GetUserId()] = true
	}
	return out, nil
}

// fullNameKey — ФИО без учёта регистра, лишних пробелов и ё/е.
func fullNameKey(last, first, patronymic string) string {
	norm := func(v string) string {
		v = strings.ToLower(strings.Join(strings.Fields(v), " "))
		return strings.ReplaceAll(v, "ё", "е")
	}
	return norm(last) + "|" + norm(first) + "|" + norm(patronymic)
}

// StudentImportFromExcel parses the richer student sheet and, per row,
// either reuses an already-existing user (the same person can legitimately
// appear twice — e.g. enrolled in two groups — and must not get a second
// account) or creates a new one, then attaches a student record plus
// whatever passport/education data the row has. The sheet's personal email
// is never sent to mdm — mdm generates the institutional login itself, the
// same as employee import — so dedup matches on name + birthday instead.
// Status "учащийся" maps to STUDYING; education_form ("ЦП", "ОО", ...) has
// no confirmed mapping onto mdm's enum yet and is left unspecified.
func (s *ImportService) StudentImportFromExcel(ctx context.Context, req *pb.StudentImportFromExcelRequest) (*pb.UserImportFromExcelResponse, error) {
	const op = "Import.StudentImportFromExcel"
	log := s.log.With(slog.String("op", op), slog.String("file_name", req.GetFileName()))

	uploadResp, err := s.filesClient.FileUpload(ctx, connect.NewRequest(&filespb.FileUploadRequest{
		FileName: req.GetFileName(),
		Type:     filesenum.FileType_FILE_TYPE_EXCEL_PARSER_STUDENT,
		Content:  req.GetContent(),
	}))
	if err != nil {
		log.Error("files service upload failed", slog.String("error", err.Error()))
		return nil, err
	}
	if !uploadResp.Msg.GetSuccess() {
		return nil, errors.New(uploadResp.Msg.GetMessage())
	}

	students := uploadResp.Msg.GetStudents()
	log.Info("file parsed", slog.Int("students", len(students)))

	existingByIdentity, err := s.fetchExistingStudentsByIdentity(ctx)
	if err != nil {
		log.Error("fetching existing users for dedup failed", slog.String("error", err.Error()))
		return nil, err
	}

	resp := &pb.UserImportFromExcelResponse{Success: true, Message: "import completed"}

	for i, row := range students {
		birthday := parseExcelDate(row.GetRaw().GetBirthday())

		userID, needsDocuments, err := s.resolveStudentUser(ctx, row, birthday, existingByIdentity)
		if err != nil {
			resp.Errors = append(resp.Errors, &pb.UserImportError{Index: int32(i), Message: err.Error()})
			continue
		}

		studentResp, err := s.mdmClient.StudentCreate(ctx, connect.NewRequest(&mdmpb.StudentCreateRequest{
			UserId:         userID.id,
			Group:          row.GetProfile().GetStudent().GetGroup(),
			RecordBook:     row.GetProfile().GetStudent().GetRecordBook(),
			Status:         mapStudentStatus(row.GetRaw().GetStatus()),
			NeedsDormitory: parseRussianBool(row.GetRaw().GetNeedsDormitory()),
		}))
		if err != nil {
			log.Error("student record creation failed", slog.Int("row", i), slog.String("error", err.Error()))
			resp.Errors = append(resp.Errors, &pb.UserImportError{Index: int32(i), Message: "пользователь готов, но не удалось сохранить данные студента: " + err.Error()})
			continue
		}
		if !studentResp.Msg.GetSuccess() {
			resp.Errors = append(resp.Errors, &pb.UserImportError{Index: int32(i), Message: "пользователь готов, но не удалось сохранить данные студента: " + studentResp.Msg.GetMessage()})
			continue
		}

		if needsDocuments {
			s.attachStudentDocuments(ctx, log, i, userID.id, row)
		}

		resp.CreatedCount++
		resp.Created = append(resp.Created, &pb.UserImportCreated{
			UserId:            userID.id,
			FirstName:         row.GetProfile().GetUser().GetFirstName(),
			LastName:          row.GetProfile().GetUser().GetLastName(),
			Email:             userID.email,
			TemporaryPassword: userID.temporaryPassword,
		})
	}

	log.Info("import finished", slog.Int("created", int(resp.CreatedCount)), slog.Int("failed", len(resp.Errors)))
	return resp, nil
}

// resolvedUser is what the rest of the import needs about a row's user,
// whether it was just created or already existed.
type resolvedUser struct {
	id                int64
	email             string
	temporaryPassword string
}

// fetchExistingStudentsByIdentity loads mdm's whole user list once per
// import run and indexes it by name+birthday, so per-row dedup is a map
// lookup instead of a request per row. Email isn't part of the key: mdm
// generates each student's institutional login itself (see
// resolveStudentUser), so a stored email never matches the sheet's personal
// one anyway, and the sheet's personal email is never sent to mdm at all —
// name+birthday is the only identity signal both sides actually share.
func (s *ImportService) fetchExistingStudentsByIdentity(ctx context.Context) (map[string]*mdmentity.User, error) {
	resp, err := s.mdmClient.UserFetch(ctx, connect.NewRequest(&mdmpb.UserFetchRequest{}))
	if err != nil {
		return nil, err
	}

	byIdentity := make(map[string]*mdmentity.User, len(resp.Msg.GetUsers()))
	for _, u := range resp.Msg.GetUsers() {
		var birthday *time.Time
		if b := u.GetBirthday(); b != nil {
			t := b.AsTime()
			birthday = &t
		}
		byIdentity[studentIdentityKey(u.GetLastName(), u.GetFirstName(), u.GetPatronymic(), birthday)] = u
	}
	return byIdentity, nil
}

// studentIdentityKey normalizes full name + birthday (date only) into a
// lookup key. Without it, the same person appearing twice — enrolled in two
// groups, say — would trip mdm's uniqueness check on the *generated* email
// on the second row, since that generation has no idea the two rows are the
// same person. A person with no birthday on either side keys on the name
// alone, so a sheet row that never has one still doesn't create a new
// account on every re-import.
func studentIdentityKey(lastName, firstName, patronymic string, birthday *time.Time) string {
	norm := func(s string) string { return strings.ToLower(strings.TrimSpace(s)) }
	key := norm(lastName) + "|" + norm(firstName) + "|" + norm(patronymic) + "|"
	if birthday != nil {
		key += birthday.Format("2006-01-02")
	}
	return key
}

// resolveStudentUser decides whether this row is the same person as an
// already-existing user (full name + birthday match — e.g. someone enrolled
// in two groups) or a genuinely new one.
//
// The student's personal email from the sheet is never sent to mdm: like
// employee import, mdm generates the institutional login itself from the
// name (see UserCreateRequest.email's doc) rather than a real user handing
// out their personal address as a work login.
//
// The bool result says whether attachStudentDocuments should still run: a
// brand-new user always needs it, and a reused one needs it too if an
// earlier import created them before passport/education attachment existed
// (or their passport/education just weren't in that earlier sheet) — never
// unconditionally, since mdm has no "does this user already have a
// passport" guard of its own and would happily create a second one.
func (s *ImportService) resolveStudentUser(
	ctx context.Context,
	row *filespb.ParsedStudent,
	birthday *time.Time,
	existingByIdentity map[string]*mdmentity.User,
) (resolvedUser, bool, error) {
	user := row.GetProfile().GetUser()
	key := studentIdentityKey(user.GetLastName(), user.GetFirstName(), user.GetPatronymic(), birthday)
	if existing, ok := existingByIdentity[key]; ok {
		needsDocuments := s.missingPassportOrEducation(ctx, existing.GetId())
		return resolvedUser{id: existing.GetId(), email: existing.GetEmail()}, needsDocuments, nil
	}

	userReq := mdmpb.UserCreateRequest{
		FirstName: user.GetFirstName(),
		LastName:  user.GetLastName(),
	}
	if patronymic := user.GetPatronymic(); patronymic != "" {
		userReq.Patronymic = &patronymic
	}
	// The files service already resolves phone/mobile down to one value.
	if phone := user.GetPhone(); phone != "" {
		userReq.Phone = &phone
	}
	if birthday != nil {
		userReq.Birthday = timestamppb.New(*birthday)
	}

	userResp, err := s.mdmClient.UserCreate(ctx, connect.NewRequest(&userReq))
	if err != nil {
		return resolvedUser{}, false, err
	}
	if !userResp.Msg.GetSuccess() {
		return resolvedUser{}, false, errors.New(userResp.Msg.GetMessage())
	}

	created := resolvedUser{
		id:                userResp.Msg.GetId(),
		email:             userResp.Msg.GetEmail(),
		temporaryPassword: userResp.Msg.GetTemporaryPassword(),
	}
	// Register the new user so a later row in this same file for the same
	// person (the sheet lists students enrolled in two groups twice) reuses
	// them instead of creating a second account.
	existingByIdentity[key] = &mdmentity.User{Id: created.id, Email: created.email}
	return created, true, nil
}

// missingPassportOrEducation looks up the full profile so a reused user from
// an import that predates passport/education attachment can be backfilled.
// On any lookup failure it conservatively says "not missing" — attaching
// documents is a best-effort nice-to-have, not worth risking a duplicate
// passport over a transient error.
func (s *ImportService) missingPassportOrEducation(ctx context.Context, userID int64) bool {
	resp, err := s.mdmClient.UserFetchByID(ctx, connect.NewRequest(&mdmpb.UserFetchByIDRequest{Id: userID}))
	if err != nil {
		return false
	}
	profile := resp.Msg.GetProfile()
	return profile.GetPassport() == nil && len(profile.GetEducations()) == 0
}

// attachStudentDocuments best-effort creates Passport/Education records from
// whatever the sheet has for a newly-created student. Failures here don't
// fail the row — the user and student record it's actually needed for are
// already saved — they're only logged.
func (s *ImportService) attachStudentDocuments(ctx context.Context, log *slog.Logger, rowIndex int, userID int64, row *filespb.ParsedStudent) {
	passport := row.GetProfile().GetPassport()
	raw := row.GetRaw()

	if passport.GetSnils() != "" || raw.GetPassportSeriesNumber() != "" {
		series, number := splitSeriesNumber(raw.GetPassportSeriesNumber())
		resp, err := s.mdmClient.PassportCreate(ctx, connect.NewRequest(&mdmpb.PassportCreateRequest{
			UserId:              userID,
			Series:              series,
			Number:              number,
			Authority:           passport.GetAuthority(),
			IssueDate:           passport.GetIssueDate(),
			DepartmentCode:      passport.GetDepartmentCode(),
			Snils:               passport.GetSnils(),
			BirthPlace:          passport.GetBirthPlace(),
			Gender:              mapGender(raw.GetGender()),
			Nationality:         mapNationality(raw.GetNationality()),
			ResidentialAddress:  passport.GetResidentialAddress(),
			RegistrationAddress: passport.GetRegistrationAddress(),
		}))
		if err != nil {
			log.Warn("passport creation failed", slog.Int("row", rowIndex), slog.String("error", err.Error()))
		} else if !resp.Msg.GetSuccess() {
			log.Warn("passport creation failed", slog.Int("row", rowIndex), slog.String("message", resp.Msg.GetMessage()))
		}
	}

	education := firstEducation(row.GetProfile())
	if raw.GetEducationType() != "" || education.GetInstitutionName() != "" || raw.GetEducationSeriesNumber() != "" {
		series, number := splitSeriesNumber(raw.GetEducationSeriesNumber())
		educationReq := mdmpb.EducationCreateRequest{
			UserId:          userID,
			Type:            mapEducationType(raw.GetEducationType()),
			Series:          series,
			Number:          number,
			InstitutionName: education.GetInstitutionName(),
			Honors:          education.GetHonors(),
		}
		if issueDate := parseExcelDate(raw.GetEducationIssueDate()); issueDate != nil {
			educationReq.IssueDate = timestamppb.New(*issueDate)
		}

		resp, err := s.mdmClient.EducationCreate(ctx, connect.NewRequest(&educationReq))
		if err != nil {
			log.Warn("education creation failed", slog.Int("row", rowIndex), slog.String("error", err.Error()))
		} else if !resp.Msg.GetSuccess() {
			log.Warn("education creation failed", slog.Int("row", rowIndex), slog.String("message", resp.Msg.GetMessage()))
		}
	}
}

// firstEducation is nil-safe: the files service's excel parser fills exactly
// one Education entry per row (see ParsedStudent.raw's comment), but a row
// with no education data at all leaves the slice empty.
func firstEducation(profile *mdmentity.UserFull) *mdmentity.Education {
	educations := profile.GetEducations()
	if len(educations) == 0 {
		return nil
	}
	return educations[0]
}

// excelDateLayouts covers the date spellings a Russian Excel export
// typically produces; unparseable input is dropped (Birthday is optional)
// rather than guessed at.
var excelDateLayouts = []string{"02.01.2006", "2006-01-02", "2.1.2006"}

func parseExcelDate(raw string) *time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	for _, layout := range excelDateLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return &t
		}
	}
	return nil
}

func parseRussianBool(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "да", "д", "yes", "y", "true", "1":
		return true
	default:
		return false
	}
}

// splitSeriesNumber splits a combined "series number" field (e.g. passport
// "0818 571883" or education document "02708 000000052") on whitespace. A
// value with no space at all is treated as the number with an empty series
// rather than guessed at.
func splitSeriesNumber(raw string) (series, number string) {
	fields := strings.Fields(raw)
	switch len(fields) {
	case 0:
		return "", ""
	case 1:
		return "", fields[0]
	default:
		return fields[0], strings.Join(fields[1:], "")
	}
}

// mapStudentStatus recognizes the one status spelling the real export
// actually uses ("Учащийся", every row of a 3260-row file); anything else
// stays unspecified rather than being guessed at.
func mapStudentStatus(raw string) mdmenum.UserStudentStatus {
	if strings.Contains(strings.ToLower(strings.TrimSpace(raw)), "учащ") {
		return mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING
	}
	return mdmenum.UserStudentStatus_USER_STUDENT_STATUS_UNSPECIFIED
}

func mapGender(raw string) mdmenum.UserGender {
	raw = strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.HasPrefix(raw, "жен"):
		return mdmenum.UserGender_USER_GENDER_FEMALE
	case strings.HasPrefix(raw, "муж"):
		return mdmenum.UserGender_USER_GENDER_MALE
	default:
		return mdmenum.UserGender_USER_GENDER_UNSPECIFIED
	}
}

// mapNationality only recognizes mdm's known set (RUS/BLR/KAZ/UZB/KGZ/CHN) —
// anything else (a real but less common nationality, or free text mdm has no
// code for) is left unspecified rather than mapped to the wrong country.
func mapNationality(raw string) mdmenum.UserNationality {
	raw = strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(raw, "росс"):
		return mdmenum.UserNationality_USER_NATIONALITY_RUS
	case strings.Contains(raw, "беларус"):
		return mdmenum.UserNationality_USER_NATIONALITY_BLR
	case strings.Contains(raw, "казахст"):
		return mdmenum.UserNationality_USER_NATIONALITY_KAZ
	case strings.Contains(raw, "узбекист"):
		return mdmenum.UserNationality_USER_NATIONALITY_UZB
	case strings.Contains(raw, "киргиз"), strings.Contains(raw, "кыргыз"):
		return mdmenum.UserNationality_USER_NATIONALITY_KGZ
	case strings.Contains(raw, "кита"):
		return mdmenum.UserNationality_USER_NATIONALITY_CHN
	default:
		return mdmenum.UserNationality_USER_NATIONALITY_UNSPECIFIED
	}
}

// mapEducationType matches against the exact Russian document titles named
// in mdm's own enum comments (contract/enum/doc.enum.proto), not a guess —
// e.g. "Аттестат о среднем общем образовании" is that enum's own doc string
// for EDUCATION_TYPE_SCHOOL_SECONDARY.
func mapEducationType(raw string) mdmenum.EducationType {
	raw = strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(raw, "среднем общем"), strings.Contains(raw, "среднем (полном) общем"):
		return mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_SECONDARY
	case strings.Contains(raw, "основном общем"):
		return mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_BASIC
	case strings.Contains(raw, "среднем профессиональном"), strings.Contains(raw, "колледж"), strings.Contains(raw, "техникум"):
		return mdmenum.EducationType_EDUCATION_TYPE_COLLEGE
	case strings.Contains(raw, "магистр"):
		return mdmenum.EducationType_EDUCATION_TYPE_MASTER
	case strings.Contains(raw, "бакалавр"):
		return mdmenum.EducationType_EDUCATION_TYPE_BACHELOR
	case strings.Contains(raw, "аспирант"), strings.Contains(raw, "ординатур"):
		return mdmenum.EducationType_EDUCATION_TYPE_POSTGRADUATE
	case strings.Contains(raw, "специалист"):
		return mdmenum.EducationType_EDUCATION_TYPE_SPECIALIST
	default:
		return mdmenum.EducationType_EDUCATION_TYPE_UNSPECIFIED
	}
}
