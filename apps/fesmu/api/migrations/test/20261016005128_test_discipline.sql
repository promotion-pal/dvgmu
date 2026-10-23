-- +goose Up
-- modify "tests" table
ALTER TABLE "tests" ADD COLUMN "discipline" character varying(255) NOT NULL DEFAULT '';
-- create index "idx_tests_discipline" to table: "tests"
CREATE INDEX "idx_tests_discipline" ON "tests" ("discipline");

-- +goose Down
-- reverse: create index "idx_tests_discipline" to table: "tests"
DROP INDEX "idx_tests_discipline";
-- reverse: modify "tests" table
ALTER TABLE "tests" DROP COLUMN "discipline";
