-- +goose Up
CREATE TABLE analytic_ips (
    id BIGSERIAL PRIMARY KEY,
    analytic_id BIGINT NOT NULL REFERENCES analytics (id) ON DELETE CASCADE,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytic_ips_lookup ON analytic_ips (analytic_id, ip, created_at DESC);

-- +goose Down
DROP TABLE analytic_ips;
