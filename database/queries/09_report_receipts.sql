-- DB-06 query contract: reporter-safe report receipts.
-- Parameters: $1 uuid authenticated reporter; $2 integer limit (1..50); $3 timestamptz last_created_at nullable; $4 uuid last_report_id nullable.
-- Authorization: only reporter-owned rows; never expose review_reason, evidence_reference, or admin notes.
-- Index: moderation_report_reporter_time_ix.
SELECT
    r.report_id,
    r.reporter_user_id,
    r.reported_user_id,
    r.status,
    r.created_at
FROM campus_duo.moderation_report r
WHERE r.reporter_user_id = $1
  AND $2 BETWEEN 1 AND 50
  AND (($3::timestamptz IS NULL AND $4::uuid IS NULL)
       OR ($3::timestamptz IS NOT NULL AND $4::uuid IS NOT NULL
           AND (r.created_at, r.report_id) < ($3, $4)))
ORDER BY r.created_at DESC, r.report_id DESC
LIMIT CASE
    WHEN $2::integer BETWEEN 1 AND 50 THEN $2::integer
    ELSE 0
END;
