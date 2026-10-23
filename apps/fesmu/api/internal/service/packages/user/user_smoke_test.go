package user_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"

	filesserviceconnect "fesmu/contract/file/service/serviceconnect"
	mdmserviceconnect "fesmu/contract/mdm/service/serviceconnect"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/service/packages/user"
)

// fakeConnectServer answers any Connect unary POST with a fixed JSON body,
// mimicking the real files/mdm services enough to exercise the
// orchestration logic without needing them running.
func fakeConnectServer(t *testing.T, byPath map[string]string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := byPath[r.URL.Path]
		if !ok {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(body))
	}))
}

func TestEmployeeImportFromExcel_Smoke(t *testing.T) {
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "ok",
		"employees": []map[string]string{
			{"firstName": "Иван", "lastName": "Иванов", "patronymic": "Иванович"},
			{"firstName": "Пётр", "lastName": "Петров"},
			{"firstName": "Ольга", "lastName": "Сидорова"},
			{"firstName": "Анна", "lastName": "Кузнецова"},
			{"firstName": "Иван", "lastName": "иванов", "patronymic": "Иванович"}, // повтор в файле
		},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	// Петров уже есть (с ё/е в другом виде) и уже сотрудник; Сидорова есть,
	// но не сотрудник; Кузнецовых двое — неоднозначно.
	userFetchResp, _ := json.Marshal(map[string]any{"users": []map[string]any{
		{"id": "10", "firstName": "Петр", "lastName": "Петров"},
		{"id": "11", "firstName": "Ольга", "lastName": "Сидорова"},
		{"id": "12", "firstName": "Анна", "lastName": "Кузнецова"},
		{"id": "13", "firstName": "Анна", "lastName": "Кузнецова"},
	}})
	employeeFetchResp, _ := json.Marshal(map[string]any{"employees": []map[string]any{
		{"employee": map[string]any{"userId": "10"}},
	}})
	mdmBatchResp, _ := json.Marshal(map[string]any{
		"results": []map[string]any{
			{"index": 0, "success": true, "userId": "1", "email": "ivanov_ii@fesmu.ru"},
		},
	})
	var employeeCreates int
	mdmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(io.Discard, r.Body)
		switch r.URL.Path {
		case "/contract.service.UserService/UserFetch":
			_, _ = w.Write(userFetchResp)
		case "/contract.service.UserService/EmployeeFetch":
			_, _ = w.Write(employeeFetchResp)
		case "/contract.service.UserService/UserCreateBatch":
			_, _ = w.Write(mdmBatchResp)
		case "/contract.service.UserService/EmployeeCreate":
			employeeCreates++
			_, _ = w.Write([]byte(`{"success":true,"employeeId":"1"}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	svc := user.NewImportService(slog.Default(), filesClient, mdmClient)

	resp, err := svc.EmployeeImportFromExcel(context.Background(), &pb.EmployeeImportFromExcelRequest{
		FileName: "employees.xlsx",
		Content:  []byte("fake-excel-bytes"),
	})
	if err != nil {
		t.Fatalf("EmployeeImportFromExcel returned error: %v", err)
	}
	if resp.GetCreatedCount() != 1 || resp.GetCreated()[0].GetEmail() != "ivanov_ii@fesmu.ru" {
		t.Fatalf("expected only Иванов created, got %+v", resp.GetCreated())
	}
	if len(resp.GetErrors()) != 1 {
		t.Fatalf("expected one ambiguity error (Кузнецова), got %+v", resp.GetErrors())
	}
	// Иванов (новый) и Сидорова; Петров уже сотрудник.
	if employeeCreates != 2 {
		t.Fatalf("expected 2 employee records, got %d", employeeCreates)
	}
	if resp.GetMessage() != "Уже были в MDM: 2 · добавлено в «Сотрудники»: 2" {
		t.Fatalf("unexpected message: %q", resp.GetMessage())
	}
}

func TestStudentImportFromExcel_Smoke(t *testing.T) {
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "ok",
		"students": []map[string]any{
			{
				"profile": map[string]any{
					"user":     map[string]any{"firstName": "Анна", "lastName": "Смирнова", "patronymic": "Олеговна"},
					"student":  map[string]any{"group": "Л-101", "recordBook": "0120001"},
					"passport": map[string]any{"snils": "123-456-789 00"},
				},
				"raw": map[string]any{"needsDormitory": "да", "gender": "Жен"},
			},
		},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	userFetchResp, _ := json.Marshal(map[string]any{"users": []map[string]any{}})
	userCreateResp, _ := json.Marshal(map[string]any{
		"id": "5", "success": true, "message": "", "email": "smirnova@fesmu.ru", "temporaryPassword": "Ab12cD",
	})
	studentCreateResp, _ := json.Marshal(map[string]any{
		"success": true, "message": "", "studentId": "9",
	})
	passportCreateResp, _ := json.Marshal(map[string]any{"success": true, "message": "", "passportId": "1"})
	mdmSrv := fakeConnectServer(t, map[string]string{
		"/contract.service.UserService/UserFetch":      string(userFetchResp),
		"/contract.service.UserService/UserCreate":     string(userCreateResp),
		"/contract.service.UserService/StudentCreate":  string(studentCreateResp),
		"/contract.service.UserService/PassportCreate": string(passportCreateResp),
	})
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	svc := user.NewImportService(slog.Default(), filesClient, mdmClient)

	resp, err := svc.StudentImportFromExcel(context.Background(), &pb.StudentImportFromExcelRequest{
		FileName: "students.xlsx",
		Content:  []byte("fake-excel-bytes"),
	})
	if err != nil {
		t.Fatalf("StudentImportFromExcel returned error: %v", err)
	}
	if !resp.GetSuccess() {
		t.Fatalf("expected success, got message: %s", resp.GetMessage())
	}
	if resp.GetCreatedCount() != 1 {
		t.Fatalf("expected created_count=1, got %d", resp.GetCreatedCount())
	}
	if len(resp.GetErrors()) != 0 {
		t.Fatalf("expected no errors, got %+v", resp.GetErrors())
	}
	if len(resp.GetCreated()) != 1 || resp.GetCreated()[0].GetEmail() != "smirnova@fesmu.ru" || resp.GetCreated()[0].GetTemporaryPassword() != "Ab12cD" {
		t.Fatalf("expected one created student with generated email/password, got %+v", resp.GetCreated())
	}
	t.Logf("orchestration OK: created=%d errors=%d", resp.GetCreatedCount(), len(resp.GetErrors()))
}

// TestStudentImportFromExcel_DedupExistingUser covers the real case found in
// a production student export: the same person listed twice (enrolled in
// two groups). The second row must reuse the first row's user instead of
// tripping mdm's email-uniqueness check — and must not call UserCreate at
// all, which this test would fail on since that path isn't registered.
func TestStudentImportFromExcel_DedupExistingUser(t *testing.T) {
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "ok",
		"students": []map[string]any{
			{
				"profile": map[string]any{
					"user":    map[string]any{"firstName": "Тест", "lastName": "Тестовый", "patronymic": "Тестович"},
					"student": map[string]any{"group": "20108", "recordBook": "2020108"},
				},
				"raw": map[string]any{"birthday": "07.03.2005"},
			},
		},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	userFetchResp, _ := json.Marshal(map[string]any{
		"users": []map[string]any{
			{
				"id": "42", "firstName": "Тест", "lastName": "Тестовый", "patronymic": "Тестович",
				"email": "dedup.test@example.com", "birthday": "2005-03-07T00:00:00Z",
			},
		},
	})
	studentCreateResp, _ := json.Marshal(map[string]any{"success": true, "message": "", "studentId": "11"})
	userFetchByIDResp, _ := json.Marshal(map[string]any{
		"profile": map[string]any{
			"user": map[string]any{"id": "42"},
			// Already has a passport/education from the first time this
			// person was imported — attachStudentDocuments must not run
			// again for them.
			"passport": map[string]any{"id": "1"},
		},
	})
	mdmSrv := fakeConnectServer(t, map[string]string{
		"/contract.service.UserService/UserFetch":     string(userFetchResp),
		"/contract.service.UserService/UserFetchByID": string(userFetchByIDResp),
		"/contract.service.UserService/StudentCreate": string(studentCreateResp),
	})
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	svc := user.NewImportService(slog.Default(), filesClient, mdmClient)

	resp, err := svc.StudentImportFromExcel(context.Background(), &pb.StudentImportFromExcelRequest{
		FileName: "students.xlsx",
		Content:  []byte("fake-excel-bytes"),
	})
	if err != nil {
		t.Fatalf("StudentImportFromExcel returned error: %v", err)
	}
	if len(resp.GetErrors()) != 0 {
		t.Fatalf("expected no errors, got %+v", resp.GetErrors())
	}
	if resp.GetCreatedCount() != 1 || len(resp.GetCreated()) != 1 || resp.GetCreated()[0].GetUserId() != 42 {
		t.Fatalf("expected the existing user (id=42) to be reused, got %+v", resp.GetCreated())
	}
	t.Logf("dedup OK: reused user_id=%d", resp.GetCreated()[0].GetUserId())
}

// TestStudentImportFromExcel_BackfillsMissingDocuments covers a reused user
// from an import that predates passport/education attachment: since their
// profile has neither, this run must still attach a passport for them.
func TestStudentImportFromExcel_BackfillsMissingDocuments(t *testing.T) {
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true,
		"message": "ok",
		"students": []map[string]any{
			{
				"profile": map[string]any{
					"user":     map[string]any{"firstName": "Проверка", "lastName": "Проверкина", "patronymic": "Проверковна"},
					"student":  map[string]any{"group": "30101", "recordBook": "3020105"},
					"passport": map[string]any{"snils": "000-000-000 00"},
				},
				"raw": map[string]any{"birthday": "01.01.2004"},
			},
		},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	userFetchResp, _ := json.Marshal(map[string]any{
		"users": []map[string]any{
			{
				"id": "7", "firstName": "Проверка", "lastName": "Проверкина", "patronymic": "Проверковна",
				"email": "backfill.test@example.com", "birthday": "2004-01-01T00:00:00Z",
			},
		},
	})
	userFetchByIDResp, _ := json.Marshal(map[string]any{
		"profile": map[string]any{"user": map[string]any{"id": "7"}},
	})
	studentCreateResp, _ := json.Marshal(map[string]any{"success": true, "message": "", "studentId": "12"})

	var passportCreateCalls int
	mux := http.NewServeMux()
	byPath := map[string]string{
		"/contract.service.UserService/UserFetch":     string(userFetchResp),
		"/contract.service.UserService/UserFetchByID": string(userFetchByIDResp),
		"/contract.service.UserService/StudentCreate": string(studentCreateResp),
	}
	mux.HandleFunc("/contract.service.UserService/PassportCreate", func(w http.ResponseWriter, r *http.Request) {
		passportCreateCalls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(`{"success":true,"message":"","passportId":"5"}`))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body, ok := byPath[r.URL.Path]
		if !ok {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(body))
	})
	mdmSrv := httptest.NewServer(mux)
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	svc := user.NewImportService(slog.Default(), filesClient, mdmClient)

	resp, err := svc.StudentImportFromExcel(context.Background(), &pb.StudentImportFromExcelRequest{
		FileName: "students.xlsx",
		Content:  []byte("fake-excel-bytes"),
	})
	if err != nil {
		t.Fatalf("StudentImportFromExcel returned error: %v", err)
	}
	if len(resp.GetErrors()) != 0 {
		t.Fatalf("expected no errors, got %+v", resp.GetErrors())
	}
	if passportCreateCalls != 1 {
		t.Fatalf("expected PassportCreate to be called once to backfill the missing passport, got %d calls", passportCreateCalls)
	}
	t.Logf("backfill OK: PassportCreate called %d time(s)", passportCreateCalls)
}

// TestStudentImportFromExcel_DuplicateRowsInSameFile: the real export lists a
// student enrolled in two groups as two rows. Both rows are new to mdm, so
// the second can only be recognized as the same person by remembering the
// user created for the first — UserCreate must run once, StudentCreate twice.
func TestStudentImportFromExcel_DuplicateRowsInSameFile(t *testing.T) {
	row := func(group string) map[string]any {
		return map[string]any{
			"profile": map[string]any{
				"user":    map[string]any{"firstName": "Образец", "lastName": "Образцов", "patronymic": "Образцович"},
				"student": map[string]any{"group": group, "recordBook": "1020001"},
			},
			"raw": map[string]any{"birthday": "2004-05-06"},
		}
	}
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true, "message": "ok",
		"students": []map[string]any{row("10101"), row("20202")},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	var userCreates, studentCreates int
	mux := http.NewServeMux()
	reply := func(counter *int, body string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if counter != nil {
				*counter++
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.Copy(io.Discard, r.Body)
			_, _ = w.Write([]byte(body))
		}
	}
	mux.HandleFunc("/contract.service.UserService/UserFetch", reply(nil, `{"users":[]}`))
	mux.HandleFunc("/contract.service.UserService/UserCreate", reply(&userCreates, `{"id":"77","success":true,"email":"obraztsov@fesmu.ru","temporaryPassword":"Pw1"}`))
	mux.HandleFunc("/contract.service.UserService/StudentCreate", reply(&studentCreates, `{"success":true,"studentId":"1"}`))
	mux.HandleFunc("/contract.service.UserService/UserFetchByID", reply(nil, `{"profile":{"user":{"id":"77"},"passport":{"id":"1"}}}`))
	mdmSrv := httptest.NewServer(mux)
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	resp, err := user.NewImportService(slog.Default(), filesClient, mdmClient).StudentImportFromExcel(
		context.Background(), &pb.StudentImportFromExcelRequest{FileName: "s.xlsx", Content: []byte("x")})
	if err != nil {
		t.Fatalf("StudentImportFromExcel returned error: %v", err)
	}
	if len(resp.GetErrors()) != 0 {
		t.Fatalf("expected no errors, got %+v", resp.GetErrors())
	}
	if userCreates != 1 || studentCreates != 2 {
		t.Fatalf("expected 1 UserCreate and 2 StudentCreate, got %d and %d", userCreates, studentCreates)
	}
}

// TestStudentImportFromExcel_DuplicateRowsWithoutBirthday: same as above but the
// person has no birthday at all — they must still not get one account per row. Both rows are new to mdm, so
// the second can only be recognized as the same person by remembering the
// user created for the first — UserCreate must run once, StudentCreate twice.
func TestStudentImportFromExcel_DuplicateRowsWithoutBirthday(t *testing.T) {
	row := func(group string) map[string]any {
		return map[string]any{
			"profile": map[string]any{
				"user":    map[string]any{"firstName": "Образец", "lastName": "Образцов", "patronymic": "Образцович"},
				"student": map[string]any{"group": group, "recordBook": "1020001"},
			},
		}
	}
	filesUploadResp, _ := json.Marshal(map[string]any{
		"success": true, "message": "ok",
		"students": []map[string]any{row("10101"), row("20202")},
	})
	filesSrv := fakeConnectServer(t, map[string]string{
		"/contract.file.service.FilesService/FileUpload": string(filesUploadResp),
	})
	defer filesSrv.Close()

	var userCreates, studentCreates int
	mux := http.NewServeMux()
	reply := func(counter *int, body string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if counter != nil {
				*counter++
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.Copy(io.Discard, r.Body)
			_, _ = w.Write([]byte(body))
		}
	}
	mux.HandleFunc("/contract.service.UserService/UserFetch", reply(nil, `{"users":[]}`))
	mux.HandleFunc("/contract.service.UserService/UserCreate", reply(&userCreates, `{"id":"77","success":true,"email":"obraztsov@fesmu.ru","temporaryPassword":"Pw1"}`))
	mux.HandleFunc("/contract.service.UserService/StudentCreate", reply(&studentCreates, `{"success":true,"studentId":"1"}`))
	mux.HandleFunc("/contract.service.UserService/UserFetchByID", reply(nil, `{"profile":{"user":{"id":"77"},"passport":{"id":"1"}}}`))
	mdmSrv := httptest.NewServer(mux)
	defer mdmSrv.Close()

	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, filesSrv.URL, connect.WithProtoJSON())
	mdmClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, mdmSrv.URL, connect.WithProtoJSON())

	resp, err := user.NewImportService(slog.Default(), filesClient, mdmClient).StudentImportFromExcel(
		context.Background(), &pb.StudentImportFromExcelRequest{FileName: "s.xlsx", Content: []byte("x")})
	if err != nil {
		t.Fatalf("StudentImportFromExcel returned error: %v", err)
	}
	if len(resp.GetErrors()) != 0 {
		t.Fatalf("expected no errors, got %+v", resp.GetErrors())
	}
	if userCreates != 1 || studentCreates != 2 {
		t.Fatalf("expected 1 UserCreate and 2 StudentCreate, got %d and %d", userCreates, studentCreates)
	}
}
