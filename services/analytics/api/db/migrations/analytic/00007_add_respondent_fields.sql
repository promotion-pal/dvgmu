-- +goose Up
ALTER TABLE analytic_ratings
    ADD COLUMN respondent_last_name   TEXT NOT NULL DEFAULT '',
    ADD COLUMN respondent_first_name  TEXT NOT NULL DEFAULT '',
    ADD COLUMN respondent_middle_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN respondent_office      TEXT NOT NULL DEFAULT '',
    ADD COLUMN respondent_department  TEXT NOT NULL DEFAULT '';

-- Общий блок респондента заменяет ФИО/кабинет из анкеты ИБ.
ALTER TABLE analytic_ratings
    DROP COLUMN IF EXISTS information_security_full_name,
    DROP COLUMN IF EXISTS information_security_office;

-- +goose Down
ALTER TABLE analytic_ratings
    ADD COLUMN information_security_full_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN information_security_office    TEXT NOT NULL DEFAULT '';

ALTER TABLE analytic_ratings
    DROP COLUMN respondent_last_name,
    DROP COLUMN respondent_first_name,
    DROP COLUMN respondent_middle_name,
    DROP COLUMN respondent_office,
    DROP COLUMN respondent_department;
