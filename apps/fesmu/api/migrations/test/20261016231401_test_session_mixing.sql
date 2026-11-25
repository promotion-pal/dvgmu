-- +goose Up
-- modify "test_sessions" table
ALTER TABLE "test_sessions" ADD COLUMN "option_count" bigint NOT NULL DEFAULT 0, ADD COLUMN "pick_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "distinct_questions" bigint NOT NULL DEFAULT 0;

-- +goose Down
-- reverse: modify "test_sessions" table
ALTER TABLE "test_sessions" DROP COLUMN "distinct_questions", DROP COLUMN "pick_version", DROP COLUMN "option_count";
