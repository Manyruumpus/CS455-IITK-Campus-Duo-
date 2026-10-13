-- DB-06 query contract: administrator-safe audit reads.
-- Parameters: $1 uuid target actor nullable; $2 text target_type nullable; $3 integer limit (1..50);
-- $4 timestamptz last_occurred_at nullable; $5 uuid cursor.
-- Backend must require ROLE_ADMIN and must redact details according to the approved safe-audit policy.
-- Never use this template to expose credentials, tokens, cookies, private profiles, schedules, messages,
-- raw prompts, or report descriptions.
-- Indexes: audit_event_actor_time_ix and audit_event_target_time_ix.
SELECT
    a.audit_event_id AS log_id,
    a.actor_user_id AS admin_id,
    a.actor_role,
    a.action,
    a.target_type,
    a.target_id,
    a.outcome,
    a.correlation_id,
    a.operation_id,
    a.safe_reason,
    a.occurred_at,
    a.retention_class
FROM campus_duo.audit_event a
WHERE ($1::uuid IS NULL OR a.actor_user_id = $1)
  AND ($2::text IS NULL OR a.target_type = $2)
  AND $3 BETWEEN 1 AND 50
  AND (($4::timestamptz IS NULL AND $5::uuid IS NULL)
       OR ($4::timestamptz IS NOT NULL AND $5::uuid IS NOT NULL
           AND (a.occurred_at, a.audit_event_id) < ($4, $5)))
ORDER BY a.occurred_at DESC, a.audit_event_id DESC
LIMIT CASE
    WHEN $3::integer BETWEEN 1 AND 50 THEN $3::integer
    ELSE 0
END;
