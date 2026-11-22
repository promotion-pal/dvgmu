-- +goose Up
ALTER TABLE tasks ADD COLUMN user_id BIGINT;
CREATE INDEX idx_tasks_user_id ON tasks (user_id);

-- +goose Down
DROP INDEX idx_tasks_user_id;
ALTER TABLE tasks DROP COLUMN user_id;
