-- +goose Up
CREATE INDEX tasks_author_created_uuid_idx ON tasks (author_id, created_at, uuid);

-- +goose Down
DROP INDEX tasks_author_created_uuid_idx;
