-- +goose Up
CREATE TABLE auth_test_identities (
    id BIGSERIAL PRIMARY KEY,
    mdm_user_id BIGINT NOT NULL UNIQUE,
    subject VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE auth_test_identities;
