-- +goose Up
ALTER TABLE travel_times DROP CONSTRAINT travel_times_minutes_check;
ALTER TABLE travel_times ADD CONSTRAINT travel_times_minutes_check CHECK (minutes BETWEEN 0 AND 1440);

-- +goose Down
ALTER TABLE travel_times DROP CONSTRAINT travel_times_minutes_check;
ALTER TABLE travel_times ADD CONSTRAINT travel_times_minutes_check CHECK (minutes > 0);
