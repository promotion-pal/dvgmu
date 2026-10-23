-- +goose Up
ALTER TABLE mentor_courses
    DROP COLUMN title,
    DROP COLUMN description;

ALTER TABLE mentor_courses
    RENAME COLUMN date TO start_date;

ALTER TABLE mentor_courses
    ADD COLUMN end_date TIMESTAMPTZ;

-- +goose Down
ALTER TABLE mentor_courses
    DROP COLUMN end_date;

ALTER TABLE mentor_courses
    RENAME COLUMN start_date TO date;

ALTER TABLE mentor_courses
    ADD COLUMN title TEXT NOT NULL DEFAULT '',
    ADD COLUMN description TEXT NOT NULL DEFAULT '';
