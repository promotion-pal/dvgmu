-- +goose Up
CREATE TABLE mentor_questions (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    patronymic TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    course_id BIGINT NOT NULL REFERENCES mentor_courses (id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE mentor_questions;
