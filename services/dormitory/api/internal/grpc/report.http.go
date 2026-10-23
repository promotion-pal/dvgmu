package grpc

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dvgmu/analytics/internal/domain/models"
	"dvgmu/analytics/internal/service"
	"dvgmu/analytics/internal/utils"
)

// ReportHandler — обычные HTTP-эндпоинты выгрузки документов (не gRPC).
type ReportHandler struct {
	dormitory *service.DormitoryRegistrationService
	users     *service.UserService
}

func ReportNewController(
	dormitory *service.DormitoryRegistrationService,
	users *service.UserService,
) *ReportHandler {
	return &ReportHandler{dormitory: dormitory, users: users}
}

// DutyRoster: GET /admin/duty-roster.docx?floor=3&month=2026-09
// month необязателен, по умолчанию — следующий календарный месяц.
func (h *ReportHandler) DutyRoster(w http.ResponseWriter, r *http.Request) {
	floor, err := strconv.Atoi(r.URL.Query().Get("floor"))
	if err != nil || floor < 1 || floor > 50 {
		http.Error(w, "параметр floor должен быть числом 1..50", http.StatusBadRequest)
		return
	}

	now := time.Now()
	month := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	if v := r.URL.Query().Get("month"); v != "" {
		parsed, perr := time.Parse("2006-01", v)
		if perr != nil {
			http.Error(w, "параметр month должен быть в формате YYYY-MM", http.StatusBadRequest)
			return
		}
		month = time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	ctx := r.Context()

	registrations, err := h.dormitory.Fetch(ctx, nil, nil, nil, nil, nil)
	if err != nil {
		http.Error(w, "не удалось получить записи", http.StatusInternalServerError)
		return
	}
	users, err := h.users.Fetch(ctx)
	if err != nil {
		http.Error(w, "не удалось получить студентов", http.StatusInternalServerError)
		return
	}

	usersByID := make(map[int64]models.User, len(users))
	for _, u := range users {
		usersByID[u.ID] = u
	}

	var entries []utils.DutyEntry
	for _, reg := range registrations {
		if utils.FloorFromRoom(reg.Room) != floor {
			continue
		}
		if reg.Data.Year() != month.Year() || reg.Data.Month() != month.Month() {
			continue
		}

		user := usersByID[reg.UserID]
		faculty, _ := user.ParseFaculty()

		groupFaculty := strings.TrimSpace(user.Group)
		if faculty != "" {
			groupFaculty = strings.TrimSpace(user.Group + ", " + faculty)
		}

		entries = append(entries, utils.DutyEntry{
			Day: reg.Data.Day(),
			FullName: strings.TrimSpace(
				user.LastName + " " + user.FirstName + " " + user.Patronymic,
			),
			GroupFaculty: groupFaculty,
			Room:         strconv.Itoa(int(reg.Room)),
		})
	}

	doc, err := utils.RenderDutyRoster(utils.DutyRosterData{
		Floor:      floor,
		MonthLabel: utils.MonthLabel(month),
		Entries:    entries,
	})
	if err != nil {
		http.Error(w, "не удалось сформировать документ", http.StatusInternalServerError)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	)
	w.Header().Set(
		"Content-Disposition",
		fmt.Sprintf(`attachment; filename="duty-floor-%d-%s.docx"`, floor, month.Format("2006-01")),
	)
	_, _ = w.Write(doc)
}
