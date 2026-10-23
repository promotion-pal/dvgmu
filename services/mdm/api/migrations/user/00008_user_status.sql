-- +goose Up
ALTER TABLE users
    ADD COLUMN status INTEGER NOT NULL DEFAULT 1;

-- +goose Down
ALTER TABLE users
    DROP COLUMN status;
