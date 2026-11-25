-- +goose Up
-- Приводит уже сохранённые телефоны к единому виду (+7XXXXXXXXXX для РФ,
-- +<цифры> для иностранных). То, что на телефон не похоже, не трогаем.
UPDATE users u
SET phone = CASE
    WHEN s.d ~ '^[78][0-9]{10}$' THEN '+7' || substr(s.d, 2)
    WHEN s.d ~ '^[0-9]{10}$'     THEN '+7' || s.d
    WHEN s.d ~ '^[0-9]{11,15}$'  THEN '+' || s.d
    ELSE u.phone
END
FROM (
    SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS d
    FROM users
    WHERE phone IS NOT NULL AND phone <> ''
) s
WHERE u.id = s.id;

-- +goose Down
-- Прежний разнородный формат не восстановить; откат ничего не делает.
SELECT 1;
