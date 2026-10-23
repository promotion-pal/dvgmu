-- +goose Up

-- пометка записей, созданных админом (не считаются в лимите «один в месяц»)
ALTER TABLE dormitory_registrations
    ADD COLUMN IF NOT EXISTS by_admin BOOLEAN NOT NULL DEFAULT false;

-- лимит «одно дежурство в месяц» — только для студенческих записей;
-- админ может добавить второй день
DROP INDEX IF EXISTS uq_dorm_reg_user_month;
CREATE UNIQUE INDEX uq_dorm_reg_user_month
    ON dormitory_registrations (user_id, (date_trunc('month', duty_date::timestamp)))
    WHERE NOT by_admin;

-- +goose Down
DROP INDEX IF EXISTS uq_dorm_reg_user_month;
CREATE UNIQUE INDEX uq_dorm_reg_user_month
    ON dormitory_registrations (user_id, (date_trunc('month', duty_date::timestamp)));
ALTER TABLE dormitory_registrations DROP COLUMN IF EXISTS by_admin;
