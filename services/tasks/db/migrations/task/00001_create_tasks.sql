-- +goose Up
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    number TEXT NOT NULL,
    title VARCHAR(150) NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX tasks_uuid_key ON tasks (uuid);
CREATE UNIQUE INDEX tasks_number_key ON tasks (number);

-- +goose Down
DROP TABLE tasks;
