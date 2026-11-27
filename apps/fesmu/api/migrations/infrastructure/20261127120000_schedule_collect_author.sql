-- +goose Up
ALTER TABLE schedule_collect_entries ADD COLUMN author_uuid UUID;
CREATE INDEX idx_schedulecollect_created_id ON schedule_collect_entries (created_at DESC, id DESC);

-- +goose Down
DROP INDEX idx_schedulecollect_created_id;
ALTER TABLE schedule_collect_entries DROP COLUMN author_uuid;
