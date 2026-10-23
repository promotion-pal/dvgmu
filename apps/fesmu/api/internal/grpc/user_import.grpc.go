package grpc

import (
	"context"

	"connectrpc.com/connect"

	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/service/packages/user"
)

type UserImportHandler struct {
	service *user.ImportService
}

func UserImportNewController(service *user.ImportService) *UserImportHandler {
	return &UserImportHandler{service: service}
}

func (h *UserImportHandler) EmployeeImportFromExcel(
	ctx context.Context,
	req *connect.Request[pb.EmployeeImportFromExcelRequest],
) (*connect.Response[pb.UserImportFromExcelResponse], error) {
	resp, err := h.service.EmployeeImportFromExcel(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(resp), nil
}

func (h *UserImportHandler) StudentImportFromExcel(
	ctx context.Context,
	req *connect.Request[pb.StudentImportFromExcelRequest],
) (*connect.Response[pb.UserImportFromExcelResponse], error) {
	resp, err := h.service.StudentImportFromExcel(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(resp), nil
}
