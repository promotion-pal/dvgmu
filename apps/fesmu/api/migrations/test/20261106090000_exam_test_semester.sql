-- +goose Up
-- modify "tests" table
ALTER TABLE "tests" ADD COLUMN "semester" smallint NOT NULL DEFAULT 0;
-- create index "idx_tests_semester" to table: "tests"
CREATE INDEX "idx_tests_semester" ON "tests" ("semester");

-- +goose Down
DROP INDEX "idx_tests_semester";
ALTER TABLE "tests" DROP COLUMN "semester";
