-- +goose Up
CREATE TABLE employee_roster_seed (
    source_key VARCHAR(120) PRIMARY KEY,
    source_row INTEGER NOT NULL UNIQUE,
    full_name VARCHAR(512) NOT NULL,
    department INTEGER NOT NULL,
    department_title TEXT NOT NULL,
    position INTEGER NOT NULL,
    position_title TEXT NOT NULL,
    status INTEGER NOT NULL,
    source_status TEXT NOT NULL,
    employment_details TEXT NOT NULL DEFAULT '',
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    match_count INTEGER NOT NULL DEFAULT 0,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_roster_seed_user_id ON employee_roster_seed(user_id);
CREATE INDEX idx_employee_roster_seed_match_count ON employee_roster_seed(match_count);

-- +goose Down
DROP TABLE IF EXISTS employee_roster_seed;
