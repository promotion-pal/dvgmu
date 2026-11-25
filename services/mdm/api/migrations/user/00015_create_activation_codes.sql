-- +goose Up
-- Код активации новой учётки: админ выдаёт его в fesmu, человек вводит на
-- auth.fesmu.ru/activate и задаёт пароль в AD. Хранится только bcrypt-хеш.
CREATE TABLE activation_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- У пользователя не больше одного действующего кода.
CREATE UNIQUE INDEX activation_codes_one_active ON activation_codes (user_id) WHERE used_at IS NULL;

-- +goose Down
DROP TABLE activation_codes;
