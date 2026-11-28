-- +goose Up
CREATE INDEX queue_view_access_user_queue_idx ON queue_view_access (user_uuid, queue_code);

-- +goose Down
DROP INDEX queue_view_access_user_queue_idx;
