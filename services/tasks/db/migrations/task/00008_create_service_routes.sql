-- +goose Up
CREATE TABLE service_routes (
    service_id BIGINT PRIMARY KEY
        CONSTRAINT fk_service_routes_service REFERENCES services (id) ON DELETE CASCADE,
    version BIGINT NOT NULL,
    rules JSONB NOT NULL
);

-- +goose Down
DROP TABLE service_routes;
