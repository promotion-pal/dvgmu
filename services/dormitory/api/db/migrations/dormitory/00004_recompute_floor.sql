-- +goose Up
-- этаж = номер комнаты без последних двух цифр (203 → 2, 1014 → 10)
-- на случай, если 00003 применялась старой формулой (первая цифра комнаты)

-- убрать дубли, которые всплывают при пересчёте (оставить самую раннюю запись)
DELETE FROM dormitory_registrations a USING dormitory_registrations b
WHERE a.room >= 100 AND b.room >= 100
  AND a.room / 100 = b.room / 100
  AND a.duty_date = b.duty_date
  AND a.id > b.id;

UPDATE dormitory_registrations SET floor = room / 100 WHERE room >= 100;

-- +goose Down
SELECT 1;
