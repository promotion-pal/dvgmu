-- +goose Up
CREATE TABLE service_form_versions (
    service_id BIGINT NOT NULL CONSTRAINT fk_service_form_versions_service REFERENCES services (id) ON DELETE CASCADE,
    version BIGINT NOT NULL,
    schema JSONB NOT NULL,
    PRIMARY KEY (service_id, version)
);

-- +goose Down
DROP TABLE service_form_versions;
