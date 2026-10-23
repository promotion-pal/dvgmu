-- +goose Up
CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,

    "group" VARCHAR(255),
    record_book VARCHAR(255),

    status INTEGER NOT NULL,
    education_form INTEGER NOT NULL,

    needs_dormitory BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_students_user_id ON students (user_id);

-- +goose Down
DROP TABLE students;
