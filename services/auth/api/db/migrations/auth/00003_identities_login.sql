-- +goose Up
-- +goose StatementBegin
ALTER TABLE identities ADD COLUMN IF NOT EXISTS login TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS identities_login_idx ON identities (login);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE identities DROP COLUMN IF EXISTS login;
-- +goose StatementEnd
