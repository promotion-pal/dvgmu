-- +goose Up
-- The vice-rectors who curate purchases. Positions only: put the names in
-- "name" once they are known (UPDATE purchase_v2_curators SET name = ...).
INSERT INTO "purchase_v2_curators" ("name", "position", "sort_order") VALUES
  ('Проректор по учебной работе', 'Учебная работа', 1),
  ('Проректор по научной работе', 'Научная работа', 2),
  ('Проректор по лечебной работе', 'Лечебная работа', 3),
  ('Проректор по административно-хозяйственной работе', 'АХР', 4),
  ('Проректор по воспитательной работе и молодёжной политике', 'Воспитательная работа', 5),
  ('Проректор по цифровому развитию', 'Цифровое развитие', 6);

-- +goose Down
DELETE FROM "purchase_v2_curators";
