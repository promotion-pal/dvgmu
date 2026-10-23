-- +goose Up
ALTER TABLE mentor_questions RENAME TO mentor_technical_questions;

CREATE TABLE mentor_questions (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    patronymic TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE mentor_questions;

ALTER TABLE mentor_technical_questions RENAME TO mentor_questions;
