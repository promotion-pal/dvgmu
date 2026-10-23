-- +goose Up
-- modify "computer_class_sessions" table: what takes place — 1 lesson, 2 testing
-- (enum ComputerClassSessionKind). Every row so far is a lesson.
ALTER TABLE "computer_class_sessions" ADD COLUMN "kind" smallint NOT NULL DEFAULT 1;

-- +goose Down
-- reverse: modify "computer_class_sessions" table
ALTER TABLE "computer_class_sessions" DROP COLUMN "kind";
