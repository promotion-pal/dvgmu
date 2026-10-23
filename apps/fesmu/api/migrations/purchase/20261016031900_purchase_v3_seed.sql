-- +goose Up
-- Purchases v3 start from the directories kept for v2: the vice-rectors
-- (with the portal users bound to them) become directions under the same
-- ids, so each department keeps its vice-rector; the categories keep their
-- implementing departments.
INSERT INTO "purchase_v3_curators" ("id", "title", "short_title", "user_uuid", "user_name", "sort_order")
SELECT "id", "name", "position", "user_uuid", "user_name", "sort_order" FROM "purchase_v2_curators";
SELECT setval(pg_get_serial_sequence('purchase_v3_curators', 'id'), GREATEST((SELECT MAX("id") FROM "purchase_v3_curators"), 1));

INSERT INTO "purchase_v3_departments" ("id", "name", "curator_id")
SELECT "id", "name", "curator_id" FROM "purchase_v2_departments";

INSERT INTO "purchase_v3_categories" ("name", "okpd2_prefix", "implementing_department")
SELECT "name", "okpd2_prefix", "department" FROM "purchase_v2_categories";

-- +goose Down
DELETE FROM "purchase_v3_categories";
DELETE FROM "purchase_v3_departments";
DELETE FROM "purchase_v3_curators";
