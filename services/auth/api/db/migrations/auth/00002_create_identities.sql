-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS identities (
    id           BIGSERIAL   PRIMARY KEY,
    mdm_id       BIGINT      NOT NULL DEFAULT 0,  -- 0 = связь с MDM ещё не установлена
    email        TEXT        NOT NULL DEFAULT '',
    object_guid  UUID        NOT NULL,
    synced_at    TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS identities_object_guid_idx ON identities (object_guid);
CREATE INDEX IF NOT EXISTS identities_email_idx ON identities (email);
CREATE INDEX IF NOT EXISTS identities_mdm_id_idx ON identities (mdm_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS identities;
-- +goose StatementEnd
