-- +goose Up
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    phone TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    patronymic TEXT NOT NULL DEFAULT '',
    record_book TEXT NOT NULL DEFAULT '',
    "group" TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone <> '';
CREATE INDEX idx_users_record_book ON users (record_book);

-- +goose Down
DROP TABLE users;
