-- +goose Up
ALTER TABLE analytic_ratings
    ADD COLUMN technical_supply_has_internet        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_headset         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_workplace       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_corporate_email BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_computer        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_monitor         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_phone           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_printer_access  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_software        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN technical_supply_has_domain_account  BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN technical_supply_has_internet,
    DROP COLUMN technical_supply_has_headset,
    DROP COLUMN technical_supply_has_workplace,
    DROP COLUMN technical_supply_has_corporate_email,
    DROP COLUMN technical_supply_has_computer,
    DROP COLUMN technical_supply_has_monitor,
    DROP COLUMN technical_supply_has_phone,
    DROP COLUMN technical_supply_has_printer_access,
    DROP COLUMN technical_supply_has_software,
    DROP COLUMN technical_supply_has_domain_account;
