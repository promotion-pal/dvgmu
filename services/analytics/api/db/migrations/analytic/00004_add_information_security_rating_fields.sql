-- +goose Up
ALTER TABLE analytic_ratings
    ADD COLUMN information_security_full_name                TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_office                   TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_position                 TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_info_type                INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN information_security_resources                JSONB   NOT NULL DEFAULT '[]',
    ADD COLUMN information_security_pdn_purpose              TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_nda_signed               BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_storage_form             TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_pdn_actions              TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_third_party_agreements   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_access_method            TEXT    NOT NULL DEFAULT '',
    ADD COLUMN information_security_pdn_destroyed_after_term BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_pdn_to_archive           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_pdn_archive_processing   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_os                       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN information_security_has_corporate_email      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN information_security_corporate_email_personal_use BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN information_security_full_name,
    DROP COLUMN information_security_office,
    DROP COLUMN information_security_position,
    DROP COLUMN information_security_info_type,
    DROP COLUMN information_security_resources,
    DROP COLUMN information_security_pdn_purpose,
    DROP COLUMN information_security_nda_signed,
    DROP COLUMN information_security_storage_form,
    DROP COLUMN information_security_pdn_actions,
    DROP COLUMN information_security_third_party_agreements,
    DROP COLUMN information_security_access_method,
    DROP COLUMN information_security_pdn_destroyed_after_term,
    DROP COLUMN information_security_pdn_to_archive,
    DROP COLUMN information_security_pdn_archive_processing,
    DROP COLUMN information_security_os,
    DROP COLUMN information_security_has_corporate_email,
    DROP COLUMN information_security_corporate_email_personal_use;
