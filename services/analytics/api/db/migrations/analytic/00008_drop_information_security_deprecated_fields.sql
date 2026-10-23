-- +goose Up
-- Убраны из анкеты ИБ: ответственность за неразглашение ПДн (#4),
-- способ доступа к ресурсам (#7), обработка при передаче в архив (#8).
ALTER TABLE analytic_ratings
    DROP COLUMN IF EXISTS information_security_nda_signed,
    DROP COLUMN IF EXISTS information_security_access_method,
    DROP COLUMN IF EXISTS information_security_pdn_archive_processing;

-- +goose Down
ALTER TABLE analytic_ratings
    ADD COLUMN information_security_nda_signed             BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_access_method          TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_pdn_archive_processing BOOLEAN NOT NULL DEFAULT false;
