-- +goose Up
-- Доступ можно привязать к подразделениям: его права получают все сотрудники
-- этих подразделений (employees.department) без выдачи каждому вручную.
-- Перевели человека в другое подразделение — права меняются сами.
CREATE TABLE access_group_departments (
    group_id BIGINT NOT NULL REFERENCES access_groups (id) ON DELETE CASCADE,
    department INTEGER NOT NULL CHECK (department > 0),
    PRIMARY KEY (group_id, department)
);
CREATE INDEX idx_access_group_departments_department ON access_group_departments (department);

-- +goose Down
DROP TABLE access_group_departments;
