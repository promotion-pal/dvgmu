-- +goose Up
-- Stored files live on disk (storage.base_path); the row keeps where and what.
ALTER TABLE files ADD COLUMN relative_path TEXT NOT NULL DEFAULT '';
ALTER TABLE files ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE files ALTER COLUMN content DROP NOT NULL;

-- +goose Down
ALTER TABLE files ALTER COLUMN content SET NOT NULL;
ALTER TABLE files DROP COLUMN mime_type;
ALTER TABLE files DROP COLUMN relative_path;
