-- +goose Up
CREATE TABLE educations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,

    type INTEGER NOT NULL,
    status INTEGER NOT NULL,

    series VARCHAR(16),
    number VARCHAR(16),
    registration_number VARCHAR(64),
    issue_date TIMESTAMPTZ,

    institution_inn VARCHAR(16),
    institution_name VARCHAR(255),
    institution_city VARCHAR(255),
    institution_region VARCHAR(255),
    institution_country_code VARCHAR(8),

    specialty_code VARCHAR(32),
    specialty_name VARCHAR(255),
    qualification VARCHAR(255),
    honors VARCHAR(64),

    supplement_series VARCHAR(16),
    supplement_number VARCHAR(16),

    is_original BOOLEAN NOT NULL DEFAULT false,
    is_verified_via_frdo BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_educations_user_id ON educations (user_id);

-- +goose Down
DROP TABLE educations;
