-- +goose Up
-- modify "test_sessions" table
ALTER TABLE "test_sessions" ADD COLUMN "opens_at" timestamptz NULL;

-- +goose Down
-- reverse: modify "test_sessions" table
ALTER TABLE "test_sessions" DROP COLUMN "opens_at";
