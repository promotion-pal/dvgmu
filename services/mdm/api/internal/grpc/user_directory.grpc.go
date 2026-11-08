package grpc

import (
	"connectrpc.com/connect"
	"context"
	"dvgmu/api/internal/service"
	"encoding/json"
	"errors"
	pb "fesmu/contract/mdm/service"
	"google.golang.org/protobuf/encoding/protojson"
	"net/http"
	"strconv"
	"strings"
)

type UserDirectoryHandler struct{ service *service.UserDirectoryService }

func UserDirectoryNewController(s *service.UserDirectoryService) *UserDirectoryHandler {
	return &UserDirectoryHandler{s}
}
func (h *UserDirectoryHandler) UserDirectoryFetch(ctx context.Context, req *connect.Request[pb.UserDirectoryFetchRequest]) (*connect.Response[pb.UserDirectoryFetchResponse], error) {
	out, err := h.service.Fetch(ctx, req.Msg)
	if errors.Is(err, service.ErrDirectoryQuery) {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(out), nil
}

// GET /users?role=student&course=2&student_group=201&query=Иванов
// This read projection never includes passports, phones, permissions or record books.
func (h *UserDirectoryHandler) QueryHTTP(w http.ResponseWriter, r *http.Request) {
	data := map[string]any{}
	ints := map[string]bool{"faculty_code": true, "course": true, "limit": true, "offset": true}
	enums := map[string]string{"role": "USER_ROLE_", "user_status": "USER_STATUS_", "student_status": "USER_STUDENT_STATUS_", "employee_department": "USER_EMPLOYEE_DEPARTMENT_"}
	stringsAllowed := map[string]bool{"query": true, "student_group": true, "record_book": true, "employee_position": true}
	bad := func() { http.Error(w, "invalid directory query", http.StatusBadRequest) }
	for key, values := range r.URL.Query() {
		if len(values) != 1 {
			bad()
			return
		}
		value := values[0]
		switch {
		case ints[key]:
			n, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				bad()
				return
			}
			data[key] = n
		case enums[key] != "":
			if n, err := strconv.ParseInt(value, 10, 32); err == nil {
				data[key] = n
				continue
			}
			if key == "role" && strings.EqualFold(value, "employee") {
				value = "staff"
			}
			prefix := enums[key]
			v := strings.ToUpper(value)
			if !strings.HasPrefix(v, prefix) {
				v = prefix + v
			}
			data[key] = v
		case stringsAllowed[key]:
			data[key] = value
		case key == "include_facets":
			v, err := strconv.ParseBool(value)
			if err != nil {
				bad()
				return
			}
			data[key] = v
		default:
			bad()
			return
		}
	}
	raw, _ := json.Marshal(data)
	q := &pb.UserDirectoryFetchRequest{}
	if err := protojson.Unmarshal(raw, q); err != nil {
		bad()
		return
	}
	out, err := h.service.Fetch(r.Context(), q)
	if errors.Is(err, service.ErrDirectoryQuery) {
		bad()
		return
	}
	if err != nil {
		http.Error(w, "directory unavailable", http.StatusServiceUnavailable)
		return
	}
	raw, err = protojson.Marshal(out)
	if err != nil {
		http.Error(w, "directory unavailable", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(raw)
}
