-- +goose Up
CREATE TABLE dormitory_registrations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    room INTEGER NOT NULL DEFAULT 0,
    record_book TEXT NOT NULL DEFAULT '',
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dormitory_registrations_user_id ON dormitory_registrations (user_id);

-- +goose Down
DROP TABLE dormitory_registrations;
