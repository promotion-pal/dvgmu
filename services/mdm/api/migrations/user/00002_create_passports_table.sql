-- +goose Up
CREATE TABLE passports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,

    series VARCHAR(16),
    number VARCHAR(16),

    authority VARCHAR(255),
    issue_date VARCHAR(32),
    expiry_date VARCHAR(32),
    department_code VARCHAR(16),

    snils VARCHAR(32),
    birth_place VARCHAR(255),
    gender INTEGER NOT NULL,
    nationality INTEGER NOT NULL,

    registration_date VARCHAR(32),
    residential_address VARCHAR(255),
    registration_address VARCHAR(255),

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- +goose Down
DROP TABLE passports;
