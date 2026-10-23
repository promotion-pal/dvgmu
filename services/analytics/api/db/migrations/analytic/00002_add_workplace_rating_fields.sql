-- +goose Up
ALTER TABLE analytic_ratings
    ADD COLUMN workplace_pc_power_rating       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_os_boot_rating        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_software_stable_rating INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_network_speed_rating  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_monitor_rating        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_keyboard_mouse_rating INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_media_devices_rating  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_office_equipment_rating INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_furniture_rating      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_space_org_rating      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_environment_rating    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN workplace_has_network           BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE analytic_ratings
    DROP COLUMN workplace_pc_power_rating,
    DROP COLUMN workplace_os_boot_rating,
    DROP COLUMN workplace_software_stable_rating,
    DROP COLUMN workplace_network_speed_rating,
    DROP COLUMN workplace_monitor_rating,
    DROP COLUMN workplace_keyboard_mouse_rating,
    DROP COLUMN workplace_media_devices_rating,
    DROP COLUMN workplace_office_equipment_rating,
    DROP COLUMN workplace_furniture_rating,
    DROP COLUMN workplace_space_org_rating,
    DROP COLUMN workplace_environment_rating,
    DROP COLUMN workplace_has_network;
