package access

import (
	"context"
	"fmt"
	"strconv"

	"connectrpc.com/connect"
	"dvgmu/tickets/internal/domain/models"
	enum "fesmu/contract/mdm/enum"
	mdmservice "fesmu/contract/mdm/service"
	"fesmu/contract/mdm/service/serviceconnect"
)

type MDM struct {
	client       serviceconnect.UserServiceClient
	sharedSecret string
}

func NewMDM(client serviceconnect.UserServiceClient, sharedSecret string) *MDM {
	return &MDM{client: client, sharedSecret: sharedSecret}
}

func (m *MDM) CheckPermission(ctx context.Context, userID int64, required enum.UserPermission) error {
	if userID <= 0 {
		return models.ErrUserIDRequired
	}
	request := connect.NewRequest(&mdmservice.UserFetchByIDRequest{Id: userID})
	request.Header().Set("X-Authenticated-User-ID", strconv.FormatInt(userID, 10))
	request.Header().Set("X-Gateway-Secret", m.sharedSecret)
	response, err := m.client.UserFetchByID(ctx, request)
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
