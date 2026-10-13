-- DB-06 query contract: notification unread count.
-- Parameters: $1 uuid authenticated recipient.
-- Separate prepared statement from 08_notifications.sql list query.
-- Authorization: recipient comes only from validated server session.
SELECT count(*) AS unread_count
FROM campus_duo.notification
WHERE recipient_user_id = $1
  AND is_read = false;
