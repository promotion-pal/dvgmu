package grpc

import (
	"context"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/service"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
)

func Students(directory mdmconnect.UserDirectoryServiceClient) service.GroupsFetch {
	return func(ctx context.Context) ([]service.Group, error) {
		response, err := directory.UserDirectoryFetch(ctx, connect.NewRequest(&mdm.UserDirectoryFetchRequest{
			ProfileKind: "student", ActiveStudentsOnly: true, IncludeFacets: true, Limit: 1,
		}))
		if err != nil {
			return nil, directoryUnavailable()
		}
		rows := response.Msg.GetStudentFacets()
		groups := make([]service.Group, 0, len(rows))
		for _, row := range rows {
			groups = append(groups, service.Group{Code: row.Group, Course: row.Course, Count: row.Count})
		}
		return groups, nil
	}
}
