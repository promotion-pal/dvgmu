-- +goose Up
CREATE INDEX tasks_queue_created_uuid_idx ON tasks (queue_id, created_at, uuid);

-- +goose Down
DROP INDEX tasks_queue_created_uuid_idx;
