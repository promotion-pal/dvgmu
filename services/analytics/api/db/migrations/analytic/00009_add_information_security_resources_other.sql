-- +goose Up
-- Свободный ввод ресурсов/программ, которых нет в списке-enum (#2 ревью).
ALTER TABLE analytic_ratings
    ADD COLUMN information_security_resources_other TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN IF EXISTS information_security_resources_other;
