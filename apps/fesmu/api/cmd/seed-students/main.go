package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	mdmentity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdmpb "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type seedStudent struct {
	sourceRow      string
	firstName      string
	lastName       string
	patronymic     string
	birthday       time.Time
	group          string
	recordBook     string
	status         mdmenum.UserStudentStatus
	needsDormitory bool
}

func main() {
	filePath := flag.String("file", "/seed/student-roster.csv", "path to the student seed CSV")
	mdmURL := flag.String("mdm-url", envOr("PACKAGE_MDM", "http://mdm:4000"), "MDM service URL")
	mdmToken := flag.String("mdm-token", os.Getenv("MDM_INTERNAL_TOKEN"), "optional MDM internal token")
	flag.Parse()

	rows, err := readSeed(*filePath)
	fatalIf(err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	client := mdmconnect.NewUserServiceClient(&http.Client{Timeout: 30 * time.Second}, *mdmURL, connect.WithProtoJSON())

	fetchReq := connect.NewRequest(&mdmpb.UserFetchRequest{})
	setToken(fetchReq, *mdmToken)
	fetched, err := client.UserFetch(ctx, fetchReq)
	fatalIf(err)

	byIdentity := make(map[string][]*mdmentity.User, len(fetched.Msg.GetUsers()))
	for _, u := range fetched.Msg.GetUsers() {
		key := identityKey(u.GetLastName(), u.GetFirstName(), u.GetPatronymic(), userBirthdayKey(u))
		byIdentity[key] = append(byIdentity[key], u)
	}

	var createdUsers, reusedUsers, studentRecords, roleUpdates, failed int
	for _, row := range rows {
		key := identityKey(row.lastName, row.firstName, row.patronymic, birthdayKey(row.birthday))
		matches := byIdentity[key]
		var u *mdmentity.User
		switch len(matches) {
		case 0:
			birthday := timestamppb.New(row.birthday)
			createReq := connect.NewRequest(&mdmpb.UserCreateRequest{
				FirstName:  row.firstName,
				LastName:   row.lastName,
				Patronymic: optional(row.patronymic),
				Birthday:   birthday,
			})
			setToken(createReq, *mdmToken)
			created, err := client.UserCreate(ctx, createReq)
			if err != nil || !created.Msg.GetSuccess() {
				failed++
				printRowError(row.sourceRow, "user create")
				continue
			}
			u = &mdmentity.User{Id: created.Msg.GetId(), FirstName: row.firstName, LastName: row.lastName, Patronymic: optional(row.patronymic), Birthday: birthday}
			byIdentity[key] = []*mdmentity.User{u}
			createdUsers++
		case 1:
			u = matches[0]
			reusedUsers++
		default:
			failed++
			printRowError(row.sourceRow, "ambiguous existing user identity")
			continue
		}

		studentReq := connect.NewRequest(&mdmpb.StudentCreateRequest{
			UserId:         u.GetId(),
			Group:          row.group,
			RecordBook:     row.recordBook,
			Status:         row.status,
			EducationForm:  mdmenum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_UNSPECIFIED,
			NeedsDormitory: row.needsDormitory,
		})
		setToken(studentReq, *mdmToken)
		studentResp, err := client.StudentCreate(ctx, studentReq)
		if err != nil || !studentResp.Msg.GetSuccess() {
			failed++
			printRowError(row.sourceRow, "student record create")
			continue
		}
		studentRecords++

		if !hasStudentRole(u.GetRoles()) {
			roles := append(append([]mdmenum.UserRole(nil), u.GetRoles()...), mdmenum.UserRole_USER_ROLE_STUDENT)
			roleReq := connect.NewRequest(&mdmpb.UserRolesSetRequest{Id: u.GetId(), Roles: roles})
			setToken(roleReq, *mdmToken)
			if _, err := client.UserRolesSet(ctx, roleReq); err != nil {
				failed++
				printRowError(row.sourceRow, "student role set")
				continue
			}
			u.Roles = roles
			roleUpdates++
		}
	}

	fmt.Printf("Строк в seed: %d; пользователей создано: %d; найдено и переиспользовано: %d; студенческих записей добавлено/проверено: %d; ролей STUDENT добавлено: %d; ошибок: %d\n",
		len(rows), createdUsers, reusedUsers, studentRecords, roleUpdates, failed)
	if failed > 0 {
		fatalIf(fmt.Errorf("seed completed with %d errors; rerunning after resolving them is safe", failed))
	}
}

func readSeed(path string) ([]seedStudent, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.FieldsPerRecord = 8
	all, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(all) < 2 || strings.Join(all[0], ",") != "source_row,full_name,birthday,group,record_book,status,source_condition,needs_dormitory" {
		return nil, fmt.Errorf("unexpected student-roster.csv header")
	}
	rows := make([]seedStudent, 0, len(all)-1)
	for _, r := range all[1:] {
		parts := strings.Fields(r[1])
		if len(parts) < 2 || len(parts) > 4 {
			return nil, fmt.Errorf("source row %s: full name must have 2–4 parts", r[0])
		}
		birthday, err := time.Parse("2006-01-02", r[2])
		if err != nil {
			return nil, fmt.Errorf("source row %s: invalid birthday", r[0])
		}
		status := mdmenum.UserStudentStatus_USER_STUDENT_STATUS_UNSPECIFIED
		if strings.TrimSpace(r[5]) == "USER_STUDENT_STATUS_STUDYING" {
			status = mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING
		}
		if status == mdmenum.UserStudentStatus_USER_STUDENT_STATUS_UNSPECIFIED {
			return nil, fmt.Errorf("source row %s: unsupported student status", r[0])
		}
		needsDormitory := strings.EqualFold(strings.TrimSpace(r[7]), "true")
		rows = append(rows, seedStudent{
			sourceRow: r[0], lastName: parts[0], firstName: parts[1], patronymic: strings.Join(parts[2:], " "),
			birthday: birthday, group: r[3], recordBook: r[4], status: status, needsDormitory: needsDormitory,
		})
	}
	return rows, nil
}

func identityKey(lastName, firstName, patronymic, birthday string) string {
	norm := func(s string) string {
		s = strings.ToLower(strings.Join(strings.Fields(s), " "))
		return strings.ReplaceAll(s, "ё", "е")
	}
	return norm(lastName) + "|" + norm(firstName) + "|" + norm(patronymic) + "|" + birthday
}

func birthdayKey(t time.Time) string { return t.Format("2006-01-02") }

func userBirthdayKey(u *mdmentity.User) string {
	if u.GetBirthday() == nil {
		return ""
	}
	return birthdayKey(u.GetBirthday().AsTime())
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func hasStudentRole(roles []mdmenum.UserRole) bool {
	for _, role := range roles {
		if role == mdmenum.UserRole_USER_ROLE_STUDENT {
			return true
		}
	}
	return false
}

func setToken[T any](req *connect.Request[T], token string) {
	if token != "" {
		req.Header().Set("Authorization", "Bearer "+token)
	}
}

func printRowError(sourceRow, reason string) {
	fmt.Fprintf(os.Stderr, "Строка Excel %s: %s\n", sourceRow, reason)
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func fatalIf(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
