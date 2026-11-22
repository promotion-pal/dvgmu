package access

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"dvgmu/tickets/internal/domain/models"
	enum "fesmu/contract/mdm/enum"
	mdmservice "fesmu/contract/mdm/service"
	"fesmu/contract/mdm/service/serviceconnect"
)

type MDM struct {
	client serviceconnect.UserServiceClient
}

func NewMDM(client serviceconnect.UserServiceClient) *MDM {
	return &MDM{client: client}
}

func (m *MDM) CheckPermission(ctx context.Context, userID int64, required enum.UserPermission) error {
	if userID <= 0 {
		return models.ErrUserIDRequired
	}
	response, err := m.client.UserFetchByID(ctx, connect.NewRequest(&mdmservice.UserFetchByIDRequest{Id: userID}))
	if err != nil {
		return fmt.Errorf("fetch permissions for user %d: %w", userID, err)
	}
	if response.Msg.GetUser() == nil || response.Msg.GetUser().GetPermission() == nil {
		return models.ErrPermissionDenied
	}
	for _, permission := range response.Msg.GetUser().GetPermission().GetPermissions() {
		if permission == required {
			return nil
		}
	}
	return models.ErrPermissionDenied
}
