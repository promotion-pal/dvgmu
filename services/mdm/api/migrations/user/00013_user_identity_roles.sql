-- +goose Up
-- uuid — публичный идентификатор пользователя (mdm_uuid). id остаётся
-- внутренним ключом: на него ссылаются passports/educations/students/...
ALTER TABLE users
    ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN username VARCHAR(50),
    ADD COLUMN ad_object_id UUID;

ALTER TABLE users ADD CONSTRAINT users_uuid_key UNIQUE (uuid);
ALTER TABLE users ADD CONSTRAINT users_ad_object_id_key UNIQUE (ad_object_id);
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

-- username = local-part корпоративного email (как его генерирует GenEmail).
-- Пропускаем тех, у кого local-part без учёта регистра совпал бы с чужим.
WITH candidates AS (
    SELECT id, lower(split_part(email, '@', 1)) AS login
    FROM users
    WHERE lower(email) LIKE '%@fesmu.ru'
), unique_logins AS (
    SELECT login FROM candidates GROUP BY login HAVING count(*) = 1
)
UPDATE users u
SET username = c.login
FROM candidates c
JOIN unique_logins ul ON ul.login = c.login
WHERE u.id = c.id AND length(c.login) BETWEEN 1 AND 50;

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role SMALLINT NOT NULL CHECK (role IN (1, 2, 3)), -- contract.enum.UserRole
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

-- +goose Down
DROP TABLE user_roles;
DROP INDEX users_username_lower_key;
ALTER TABLE users
    DROP COLUMN ad_object_id,
    DROP COLUMN username,
    DROP COLUMN uuid;
