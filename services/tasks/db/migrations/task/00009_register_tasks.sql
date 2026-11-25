-- +goose Up
ALTER TABLE tasks
    ADD COLUMN direction_id BIGINT CONSTRAINT fk_tasks_direction REFERENCES directions(id) ON DELETE RESTRICT,
    ADD COLUMN service_id BIGINT CONSTRAINT fk_tasks_service REFERENCES services(id) ON DELETE RESTRICT,
    ADD COLUMN status_id BIGINT CONSTRAINT fk_tasks_status REFERENCES statuses(id) ON DELETE RESTRICT,
    ADD COLUMN priority_id BIGINT CONSTRAINT fk_tasks_priority REFERENCES priorities(id) ON DELETE RESTRICT,
    ADD COLUMN form_version BIGINT,
    ADD COLUMN description TEXT NOT NULL DEFAULT '',
    ADD COLUMN author_id TEXT,
    ADD COLUMN author_department_id_at_creation TEXT,
    ADD COLUMN extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN queue_id TEXT,
    ADD COLUMN routing_outcome TEXT,
    ADD CONSTRAINT fk_tasks_service_form FOREIGN KEY (service_id, form_version)
        REFERENCES service_form_versions(service_id, version) ON DELETE RESTRICT;

CREATE TABLE task_number_counters (
    year INTEGER PRIMARY KEY,
    last_value BIGINT NOT NULL
);

INSERT INTO task_number_counters (year, last_value)
SELECT split_part(number, '-', 2)::integer, MAX(split_part(number, '-', 3)::bigint)
FROM tasks
WHERE number ~ '^REQ-[0-9]{4}-[0-9]{1,18}$'
GROUP BY split_part(number, '-', 2)::integer;

CREATE TABLE task_events (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL CONSTRAINT fk_task_events_task REFERENCES tasks(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL,
    actor_id TEXT,
    internal BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX task_events_task_id_id_idx ON task_events (task_id, id);

-- +goose Down
DROP TABLE task_events;
DROP TABLE task_number_counters;
ALTER TABLE tasks
    DROP CONSTRAINT fk_tasks_service_form,
    DROP COLUMN routing_outcome,
    DROP COLUMN queue_id,
    DROP COLUMN extra_fields,
    DROP COLUMN author_department_id_at_creation,
    DROP COLUMN author_id,
    DROP COLUMN description,
    DROP COLUMN form_version,
    DROP COLUMN priority_id,
    DROP COLUMN status_id,
    DROP COLUMN service_id,
    DROP COLUMN direction_id;
