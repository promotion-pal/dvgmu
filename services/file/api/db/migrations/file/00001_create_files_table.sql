-- +goose Up
CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    type INT NOT NULL DEFAULT 0,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_user_id ON files (user_id);

-- +goose Down
DROP TABLE files;
