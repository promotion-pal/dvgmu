-- +goose Up
ALTER TABLE auth_test_identities RENAME TO auth_identities;

-- +goose Down
ALTER TABLE auth_identities RENAME TO auth_test_identities;
