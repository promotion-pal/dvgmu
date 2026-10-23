-- +goose Up
-- modify "tests" table
ALTER TABLE "tests" ADD COLUMN "faculty" character varying(255) NOT NULL DEFAULT '';
-- create index "idx_tests_faculty" to table: "tests"
CREATE INDEX "idx_tests_faculty" ON "tests" ("faculty");

-- +goose Down
-- reverse: create index "idx_tests_faculty" to table: "tests"
DROP INDEX "idx_tests_faculty";
-- reverse: modify "tests" table
ALTER TABLE "tests" DROP COLUMN "faculty";
