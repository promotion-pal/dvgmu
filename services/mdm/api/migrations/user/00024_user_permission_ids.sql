-- +goose Up
ALTER TABLE user_permissions ADD COLUMN id BIGSERIAL;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_id_key UNIQUE (id);

-- +goose Down
ALTER TABLE user_permissions DROP CONSTRAINT user_permissions_id_key;
ALTER TABLE user_permissions DROP COLUMN id;
