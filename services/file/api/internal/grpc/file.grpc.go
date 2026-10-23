package grpc

import (
	"bytes"
	"context"
	"io"
	"log/slog"

	"connectrpc.com/connect"

	"dvgmu/file/contract/gen/go/entity"
	mdmentity "dvgmu/file/contract/gen/go/mdm/entity"
	servicepb "dvgmu/file/contract/gen/go/service"
	"dvgmu/file/contract/gen/go/service/serviceconnect"
	"dvgmu/file/internal/service"
	"dvgmu/file/internal/utils"
	"dvgmu/file/internal/utils/excel"
	"dvgmu/file/internal/utils/word"
)

type FilesHandler struct {
	serviceconnect.UnimplementedFilesServiceHandler

	log     *slog.Logger
	service *service.FileService
	storage *utils.Storage
}

func FilesNewController(fileService *service.FileService, storage *utils.Storage, log *slog.Logger) *FilesHandler {
	return &FilesHandler{
		log:     log,
		service: fileService,
		storage: storage,
	}
}

func (h *FilesHandler) FileUpload(ctx context.Context, req *connect.Request[servicepb.FileUploadRequest]) (*connect.Response[servicepb.FileUploadResponse], error) {
	msg := req.Msg

	id, data, err := h.service.Upload(ctx, msg.GetUserId(), msg.GetFileName(), bytes.NewReader(msg.GetContent()), msg.GetType())
	if err != nil {
		h.log.Error("file upload failed", "error", err.Error())
		return connect.NewResponse(&servicepb.FileUploadResponse{
			Success: false,
			Message: err.Error(),
		}), nil
	}

	resp := &servicepb.FileUploadResponse{Success: true}

	switch parsed := data.(type) {
	case []excel.FileExcelUserParserType:
		for _, u := range parsed {
			resp.Employees = append(resp.Employees, &mdmentity.User{
				FirstName:  u.FirstName,
				LastName:   u.LastName,
				Patronymic: &u.Patronymic,
			})
		}

	case []excel.FileExcelStudentParserType:
		for _, st := range parsed {
			resp.Students = append(resp.Students, studentToProto(st))
		}
	}

	if id > 0 {
		file, err := h.service.Download(ctx, id)
		if err != nil {
			h.log.Error("failed to load uploaded file", "id", id, "error", err.Error())
		} else if file != nil {
			resp.File = file.ToProto()
		}
	}

	return connect.NewResponse(resp), nil
}

func (h *FilesHandler) FileGenerate(ctx context.Context, req *connect.Request[servicepb.FileGenerateRequest]) (*connect.Response[servicepb.FileGenerateResponse], error) {
	msg := req.Msg

	var params any
	switch p := msg.GetParams().(type) {
	case *servicepb.FileGenerateRequest_DormitoryApplication:
		params = word.DormitoryApplicationParams{
			Room:       p.DormitoryApplication.GetRoom(),
			Building:   p.DormitoryApplication.GetBuilding(),
			PeriodFrom: p.DormitoryApplication.GetPeriodFrom(),
			PeriodTo:   p.DormitoryApplication.GetPeriodTo(),
			Address:    p.DormitoryApplication.GetDormitoryAddress(),
		}
	case *servicepb.FileGenerateRequest_TemporaryResidence:
		params = word.TemporaryResidenceParams{
			PeriodFrom:        p.TemporaryResidence.GetPeriodFrom(),
			PeriodTo:          p.TemporaryResidence.GetPeriodTo(),
			Official:          p.TemporaryResidence.GetOfficial(),
			RoomOwner:         p.TemporaryResidence.GetRoomOwner(),
			RoomOwnerPosition: p.TemporaryResidence.GetRoomOwnerPosition(),
		}
	}

	fileName, content, err := h.service.Generate(ctx, msg.GetProfile(), msg.GetType(), params)
	if err != nil {
		h.log.Error("file generate failed", "error", err.Error())
		return connect.NewResponse(&servicepb.FileGenerateResponse{
			Success: false,
			Message: err.Error(),
		}), nil
	}

	return connect.NewResponse(&servicepb.FileGenerateResponse{
		Success: true,
		File: &entity.File{
			UserId:   msg.GetProfile().GetUser().GetId(),
			FileName: fileName,
			FileSize: int64(len(content)),
		},
		Content: content,
	}), nil
}

func (h *FilesHandler) FileDownload(ctx context.Context, req *connect.Request[servicepb.FileDownloadRequest], stream *connect.ServerStream[servicepb.FileDownloadResponse]) error {
	file, err := h.service.Download(ctx, req.Msg.GetId())
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	if file == nil {
		return connect.NewError(connect.CodeNotFound, utils.ErrFileNotFound)
	}

	reader, err := h.storage.Read(file.RelativePath)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	defer reader.Close()

	buf := make([]byte, 32*1024)
	for {
		n, readErr := reader.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			if sendErr := stream.Send(&servicepb.FileDownloadResponse{ChunkContent: chunk}); sendErr != nil {
				return sendErr
			}
		}
		if readErr == io.EOF {
			return nil
		}
		if readErr != nil {
			return connect.NewError(connect.CodeInternal, readErr)
		}
	}
}

// studentToProto lays one raw parsed row out in MDM's own entity shape. Every
// value is the untouched cell text: plain-string MDM fields are set directly,
// enum/Timestamp/bool ones (and combined "series number" cells) go to Raw for
// MDM to resolve. Course is dropped — MDM derives it from record_book.
func studentToProto(st excel.FileExcelStudentParserType) *servicepb.ParsedStudent {
	phone := st.Mobile
	if phone == "" {
		phone = st.Phone
	}

	return &servicepb.ParsedStudent{
		Profile: &mdmentity.UserFull{
			User: &mdmentity.User{
				FirstName:  st.FirstName,
				LastName:   st.LastName,
				Patronymic: &st.Patronymic,
				Email:      st.Email,
				Phone:      &phone,
			},
			Passport: &mdmentity.Passport{
				Authority:           st.Authority,
				IssueDate:           st.PassportIssueDate,
				DepartmentCode:      st.DepartmentCode,
				Snils:               st.Snils,
				BirthPlace:          st.BirthPlace,
				ResidentialAddress:  st.ResidentialAddress,
				RegistrationAddress: st.RegistrationAddress,
			},
			Educations: []*mdmentity.Education{{
				InstitutionName: st.InstitutionName,
				Honors:          st.Honors,
			}},
			Military: &mdmentity.Military{
				Commissariat: st.Commissariat,
				VusCode:      st.VusCode,
			},
			Student: &mdmentity.Student{
				Group:      st.Group,
				RecordBook: st.RecordBookNumber,
			},
		},
		Raw: &servicepb.RawStudentValues{
			Birthday:                        st.Birthday,
			Gender:                          st.Gender,
			Nationality:                     st.Nationality,
			PassportSeriesNumber:            st.PassportNumber,
			EducationType:                   st.EducationType,
			EducationSeriesNumber:           st.EducationSeries,
			EducationIssueDate:              st.EducationIssueDate,
			EducationForm:                   st.EducationForm,
			Status:                          st.Status,
			NeedsDormitory:                  st.NeedsDormitory,
			MilitaryRank:                    st.Rank,
			MilitaryRegistrationCertificate: st.RegCert,
			MilitaryTicket:                  st.MilTicket,
		},
	}
}
