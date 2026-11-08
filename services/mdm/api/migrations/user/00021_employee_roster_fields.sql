-- +goose Up
ALTER TABLE employees
    ADD COLUMN status INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN position INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN source_key VARCHAR(120);

DROP INDEX IF EXISTS idx_employees_user_department;
CREATE UNIQUE INDEX idx_employees_manual_assignment
    ON employees (user_id, department, position)
    WHERE source_key IS NULL;
CREATE UNIQUE INDEX idx_employees_source_key
    ON employees (source_key)
    WHERE source_key IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_employees_source_key;
DROP INDEX IF EXISTS idx_employees_manual_assignment;
ALTER TABLE employees
    DROP COLUMN source_key,
    DROP COLUMN position,
    DROP COLUMN status;
CREATE UNIQUE INDEX idx_employees_user_department ON employees (user_id, department);
