-- +goose Up
ALTER TABLE analytic_ratings
    ADD COLUMN information_security_computer_proficiency INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN information_security_computer_proficiency;
