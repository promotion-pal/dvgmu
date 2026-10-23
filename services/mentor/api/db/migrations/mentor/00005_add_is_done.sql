-- +goose Up
ALTER TABLE mentor_applications ADD COLUMN is_done BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mentor_questions ADD COLUMN is_done BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mentor_technical_questions ADD COLUMN is_done BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE mentor_applications DROP COLUMN is_done;
ALTER TABLE mentor_questions DROP COLUMN is_done;
ALTER TABLE mentor_technical_questions DROP COLUMN is_done;
