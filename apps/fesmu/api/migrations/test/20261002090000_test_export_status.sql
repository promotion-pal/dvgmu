-- +goose Up
-- modify "tests" table
ALTER TABLE "tests" ADD COLUMN "export_status" smallint NOT NULL DEFAULT 1;
-- create index "idx_tests_export_status" to table: "tests"
CREATE INDEX "idx_tests_export_status" ON "tests" ("export_status");

-- +goose Down
-- reverse: create index "idx_tests_export_status" to table: "tests"
DROP INDEX "idx_tests_export_status";
-- reverse: modify "tests" table
ALTER TABLE "tests" DROP COLUMN "export_status";
