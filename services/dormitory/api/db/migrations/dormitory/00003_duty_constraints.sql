-- +goose Up

-- телефон всегда обязателен -> обычный уникальный индекс (нужен для UPSERT)
DROP INDEX IF EXISTS idx_users_phone;
CREATE UNIQUE INDEX uq_users_phone ON users (phone);

ALTER TABLE dormitory_registrations
    ADD COLUMN IF NOT EXISTS floor INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS duty_date DATE;

UPDATE dormitory_registrations
SET floor = room / 100,
    duty_date = data::date
WHERE duty_date IS NULL;

ALTER TABLE dormitory_registrations ALTER COLUMN duty_date SET NOT NULL;

-- если в данных уже есть дубли — оставляем самую раннюю запись
DELETE FROM dormitory_registrations a USING dormitory_registrations b
WHERE a.floor = b.floor AND a.duty_date = b.duty_date AND a.id > b.id;

-- один дежурный на этаж в конкретный день
CREATE UNIQUE INDEX uq_dorm_reg_floor_date
    ON dormitory_registrations (floor, duty_date);

DELETE FROM dormitory_registrations a USING dormitory_registrations b
WHERE a.user_id = b.user_id
  AND date_trunc('month', a.duty_date::timestamp) = date_trunc('month', b.duty_date::timestamp)
  AND a.id > b.id;

-- один студент — одно дежурство в месяц
CREATE UNIQUE INDEX uq_dorm_reg_user_month
    ON dormitory_registrations (user_id, (date_trunc('month', duty_date::timestamp)));

-- +goose Down
DROP INDEX IF EXISTS uq_dorm_reg_user_month;
DROP INDEX IF EXISTS uq_dorm_reg_floor_date;
ALTER TABLE dormitory_registrations DROP COLUMN IF EXISTS duty_date;
ALTER TABLE dormitory_registrations DROP COLUMN IF EXISTS floor;
DROP INDEX IF EXISTS uq_users_phone;
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone <> '';
