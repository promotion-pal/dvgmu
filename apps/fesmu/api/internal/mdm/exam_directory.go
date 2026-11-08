package mdm

import (
	"connectrpc.com/connect"
	"context"
	pb "fesmu/contract/mdm/service"
	rpc "fesmu/contract/mdm/service/serviceconnect"
	"net/http"
	"time"
)

// Directory reads filtered MDM projections without fetching full user profiles.
type Directory struct {
	client rpc.UserDirectoryServiceClient
}

func NewDirectory(url string) *Directory {
	return &Directory{client: rpc.NewUserDirectoryServiceClient(&http.Client{Timeout: 5 * time.Second}, url)}
}
func (d *Directory) Fetch(ctx context.Context, q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	response, err := d.client.UserDirectoryFetch(ctx, connect.NewRequest(q))
	if err != nil {
		return nil, err
	}
	return response.Msg, nil
}
