-- DB-06 query contract: administrator report/resource reads.
-- Each statement requires a backend authorization check that the session role is ROLE_ADMIN.
-- Parameters: $1 text status nullable; $2 integer limit (1..50);
-- $3 timestamptz last_created_at nullable; $4 uuid cursor.
-- Authorization: backend must require ROLE_ADMIN; this parameter does not authenticate.
-- Report queue: $1 text status nullable; $2 integer limit (1..50); $3 timestamptz last_created_at nullable; $4 uuid cursor.
SELECT
    r.report_id, r.reporter_user_id, r.reported_user_id,
    reported.display_name AS reported_user_name, r.category, r.description,
    r.evidence_reference, r.status, r.reviewed_by, r.reviewed_at,
    r.review_reason, r.audit_event_id, r.created_at, r.updated_at
FROM campus_duo.moderation_report r
JOIN campus_duo.user_account reported ON reported.user_id = r.reported_user_id
WHERE ($1::text IS NULL OR r.status = $1)
  AND $2 BETWEEN 1 AND 50
  AND (($3::timestamptz IS NULL AND $4::uuid IS NULL)
       OR ($3::timestamptz IS NOT NULL AND $4::uuid IS NOT NULL
           AND (r.created_at, r.report_id) < ($3, $4)))
ORDER BY r.created_at DESC, r.report_id DESC
LIMIT CASE
    WHEN $2::integer BETWEEN 1 AND 50 THEN $2::integer
    ELSE 0
END;
