-- +goose Up
CREATE TABLE directions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX directions_code_key ON directions (code);

-- +goose Down
DROP TABLE directions;
