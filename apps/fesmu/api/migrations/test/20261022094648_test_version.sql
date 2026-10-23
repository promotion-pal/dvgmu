-- +goose Up
-- modify "test_sessions" table
ALTER TABLE "test_sessions" ADD COLUMN "version" smallint NOT NULL DEFAULT 1;
-- sessions made before versions mixed right and wrong answers (pick version 1+): keep that
UPDATE "test_sessions" SET "version" = 2 WHERE "pick_version" >= 1;
-- modify "tests" table
ALTER TABLE "tests" ADD COLUMN "version" smallint NOT NULL DEFAULT 1;
-- create "test_v2_answers" table
CREATE TABLE "test_v2_answers" (
  "id" bigserial NOT NULL,
  "question_id" bigint NOT NULL,
  "position" bigint NOT NULL,
  "text" text NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_test_questions_answers_v2" FOREIGN KEY ("question_id") REFERENCES "test_questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_test_v2_answers_question_id" to table: "test_v2_answers"
CREATE INDEX "idx_test_v2_answers_question_id" ON "test_v2_answers" ("question_id");

-- +goose Down
-- reverse: create index "idx_test_v2_answers_question_id" to table: "test_v2_answers"
DROP INDEX "idx_test_v2_answers_question_id";
-- reverse: create "test_v2_answers" table
DROP TABLE "test_v2_answers";
-- reverse: modify "tests" table
ALTER TABLE "tests" DROP COLUMN "version";
-- reverse: modify "test_sessions" table
ALTER TABLE "test_sessions" DROP COLUMN "version";
