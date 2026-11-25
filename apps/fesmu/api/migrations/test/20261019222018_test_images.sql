-- +goose Up
-- modify "test_questions" table
ALTER TABLE "test_questions" ADD COLUMN "image" character varying(64) NOT NULL DEFAULT '', ADD COLUMN "image_width" bigint NOT NULL DEFAULT 0, ADD COLUMN "image_height" bigint NOT NULL DEFAULT 0;
-- create "test_images" table
CREATE TABLE "test_images" (
  "hash" character varying(64) NOT NULL,
  "file_id" bigint NOT NULL,
  "mime" character varying(32) NOT NULL,
  "width" bigint NOT NULL,
  "height" bigint NOT NULL,
  "created_at" timestamptz NULL,
  PRIMARY KEY ("hash")
);

-- +goose Down
-- reverse: create "test_images" table
DROP TABLE "test_images";
-- reverse: modify "test_questions" table
ALTER TABLE "test_questions" DROP COLUMN "image_height", DROP COLUMN "image_width", DROP COLUMN "image";
