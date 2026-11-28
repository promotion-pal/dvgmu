package grpc

import (
	"context"
	"slices"
	"strings"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/service"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
)

func studentGroups(ctx context.Context, directory mdmconnect.UserDirectoryServiceClient, id string) ([]string, error) {
	response, err := directory.UserDirectoryFetch(ctx, connect.NewRequest(&mdm.UserDirectoryFetchRequest{
		ProfileKind: "student", ActiveStudentsOnly: true, UserUuids: []string{id}, Limit: 1,
	}))
	if err != nil || response.Msg.GetProfileKind() != "student" {
		return nil, directoryUnavailable()
	}
	var groups []string
	for _, user := range response.Msg.GetUsers() {
		if user.GetUuid() != id {
			continue
		}
		for _, student := range user.GetStudents() {
			group := strings.TrimSpace(student.GetGroup())
			if group != "" && !slices.Contains(groups, group) {
				groups = append(groups, group)
			}
		}
	}
	return groups, nil
}

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
