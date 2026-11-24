-- +goose Up
CREATE TABLE service_settings (
    service_id BIGINT PRIMARY KEY
        CONSTRAINT fk_service_settings_service REFERENCES services (id) ON DELETE CASCADE,
    initial_status_id BIGINT NOT NULL
        CONSTRAINT fk_service_settings_initial_status REFERENCES statuses (id) ON DELETE RESTRICT,
    default_priority_id BIGINT NOT NULL
        CONSTRAINT fk_service_settings_default_priority REFERENCES priorities (id) ON DELETE RESTRICT
);

CREATE INDEX service_settings_initial_status_id_idx ON service_settings (initial_status_id);
CREATE INDEX service_settings_default_priority_id_idx ON service_settings (default_priority_id);

-- +goose Down
DROP TABLE service_settings;
