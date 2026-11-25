-- +goose Up
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,

    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    patronymic VARCHAR(255),

    email VARCHAR(255) NOT NULL UNIQUE,
    birthday VARCHAR(32),
    phone VARCHAR(32),

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- +goose Down
DROP TABLE users;
