-- +goose Up
-- rename a column from "faculty" to "department": staff type in their department instead
ALTER TABLE "tests" RENAME COLUMN "faculty" TO "department";
-- rename an index from "idx_tests_faculty" to "idx_tests_department"
ALTER INDEX "idx_tests_faculty" RENAME TO "idx_tests_department";

-- +goose Down
-- reverse: rename an index from "idx_tests_faculty" to "idx_tests_department"
ALTER INDEX "idx_tests_department" RENAME TO "idx_tests_faculty";
-- reverse: rename a column from "faculty" to "department"
ALTER TABLE "tests" RENAME COLUMN "department" TO "faculty";
