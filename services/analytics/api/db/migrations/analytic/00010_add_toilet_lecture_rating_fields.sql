-- +goose Up
-- Оценки туалетов и лекционных залов: анкеты их собирали, но полей не было —
-- сохранялись только респондент и комментарий.
ALTER TABLE analytic_ratings
    ADD COLUMN purity_rating    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN smell_rating     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN has_toilet_paper BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_soap         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN comfort          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN equipment        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN cleanliness      INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN purity_rating,
    DROP COLUMN smell_rating,
    DROP COLUMN has_toilet_paper,
    DROP COLUMN has_soap,
    DROP COLUMN comfort,
    DROP COLUMN equipment,
    DROP COLUMN cleanliness;
