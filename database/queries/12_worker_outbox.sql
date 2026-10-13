-- DB-07 worker query contract: pending dispatch/retry work.
-- Parameters: $1 integer limit (1..100).
-- Authorization: only campus_duo_worker; backend worker ownership is separate
-- from application actor authorization.
SELECT
    outbox_event_id,
    event_type,
    aggregate_type,
    aggregate_id,
    dedupe_key,
    payload,
    status,
    attempts,
    next_attempt_at,
    created_at,
    dispatched_at,
    correlation_id
FROM campus_duo.outbox_event
WHERE status IN ('PENDING', 'FAILED')
  AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp())
  AND $1 BETWEEN 1 AND 100
ORDER BY COALESCE(next_attempt_at, created_at), outbox_event_id
LIMIT CASE
    WHEN $1::integer BETWEEN 1 AND 100 THEN $1::integer
    ELSE 0
END;
