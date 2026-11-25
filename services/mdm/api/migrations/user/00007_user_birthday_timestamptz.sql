-- +goose Up
ALTER TABLE users
    ALTER COLUMN birthday TYPE TIMESTAMPTZ USING NULLIF(birthday, '')::timestamptz;

-- +goose Down
ALTER TABLE users
    ALTER COLUMN birthday TYPE VARCHAR(32) USING to_char(birthday, 'YYYY-MM-DD');
