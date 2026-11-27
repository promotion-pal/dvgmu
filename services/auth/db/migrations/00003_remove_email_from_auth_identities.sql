-- +goose Up
ALTER TABLE auth_identities DROP COLUMN email;

-- +goose Down
ALTER TABLE auth_identities ADD COLUMN email VARCHAR(320);
