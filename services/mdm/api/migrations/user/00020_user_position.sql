-- +goose Up
-- Должность сотрудника («Начальник отдела»): видна в профиле и в разделах
-- портала, задаётся на странице «Роли». Пусто — не задана.
ALTER TABLE users ADD COLUMN position VARCHAR(255) NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE users DROP COLUMN position;
