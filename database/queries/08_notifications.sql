-- DB-06 query contract: recipient-owned notifications and unread count.
-- List parameters: $1 uuid authenticated recipient; $2 boolean unread_only; $3 text event_type nullable;
-- $4 integer limit (1..50); $5 timestamptz last_created_at nullable; $6 uuid last_notification_id nullable cursor.
-- The unread-count statement below is a separate prepared statement signature:
-- count($1 uuid authenticated recipient). Bind it independently from the list statement.
-- Authorization: recipient comes only from validated session; caller-supplied recipient IDs are ignored.
-- Index: notification_recipient_read_time_ix.
SELECT
    n.notification_id,
    n.recipient_user_id,
    n.event_type,
    n.mode,
    n.title,
    n.body,
    n.destination_type,
    n.destination_id,
    n.is_read,
    n.created_at
FROM campus_duo.notification n
WHERE n.recipient_user_id = $1
  AND (NOT $2 OR n.is_read = false)
  AND ($3::text IS NULL OR n.event_type = $3)
  AND $4 BETWEEN 1 AND 50
  AND (($5::timestamptz IS NULL AND $6::uuid IS NULL)
       OR ($5::timestamptz IS NOT NULL AND $6::uuid IS NOT NULL
           AND (n.created_at, n.notification_id) < ($5, $6)))
ORDER BY n.created_at DESC, n.notification_id DESC
LIMIT CASE
    WHEN $4::integer BETWEEN 1 AND 50 THEN $4::integer
    ELSE 0
END;
