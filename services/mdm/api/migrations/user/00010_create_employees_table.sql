-- +goose Up
CREATE TABLE employees (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,

    department INTEGER NOT NULL,

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_employees_user_id ON employees (user_id);

-- +goose Down
DROP TABLE employees;
