-- +goose Up
ALTER TABLE passports
    ALTER COLUMN birth_place TYPE TEXT,
    ALTER COLUMN residential_address TYPE TEXT,
    ALTER COLUMN registration_address TYPE TEXT;

-- +goose Down
ALTER TABLE passports
    ALTER COLUMN birth_place TYPE VARCHAR(255),
    ALTER COLUMN residential_address TYPE VARCHAR(255),
    ALTER COLUMN registration_address TYPE VARCHAR(255);
