-- +goose Up
WITH queue_references AS (
    SELECT rule->>'queue_id' AS code,
           COALESCE(rule->'active' = 'true'::jsonb, TRUE) AS active
    FROM service_routes
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(rules) = 'array' THEN rules ELSE '[]'::jsonb END
    ) AS rule
    UNION ALL
    SELECT queue_id, FALSE FROM tasks
)
INSERT INTO queues (code, name, active)
SELECT code, code, bool_or(active)
FROM queue_references
WHERE char_length(code) BETWEEN 1 AND 64
GROUP BY code
ON CONFLICT (code) DO NOTHING;

-- +goose Down
-- Keep the imported queues so their later edits survive a rollback.
SELECT 1;
