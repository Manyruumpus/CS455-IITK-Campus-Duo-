-- DB-06 query contract: viewer connections.
-- Parameters: $1 uuid authenticated viewer; $2 text mode nullable; $3 integer limit (1..50);
-- $4 timestamptz last_updated_at nullable; $5 uuid last_connection_id nullable cursor.
-- Authorization: viewer must be a participant; backend must validate session and mode.
-- Ordering: updated_at DESC, connection_id DESC. Empty result is valid.
-- Indexes: connection_user_a_mode_status_ix and connection_user_b_mode_status_ix.
SELECT
    c.connection_id,
    c.user_a_id AS student_a_id,
    c.user_b_id AS student_b_id,
    c.mode,
    c.status,
    c.note,
    (c.restricted_reason IS NOT NULL) AS is_restricted,
    c.restricted_reason,
    c.created_at,
    c.updated_at,
    peer.user_id AS peer_id,
    peer.display_name AS peer_display_name,
    peer.department AS peer_department,
    peer.degree AS peer_degree,
    peer.year AS peer_year
FROM campus_duo.connection c
JOIN campus_duo.user_account peer
  ON peer.user_id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
  AND ($2::text IS NULL OR c.mode = $2)
  AND $3 BETWEEN 1 AND 50
  AND (($4::timestamptz IS NULL AND $5::uuid IS NULL)
       OR ($4::timestamptz IS NOT NULL AND $5::uuid IS NOT NULL
           AND (c.updated_at, c.connection_id) < ($4, $5)))
ORDER BY c.updated_at DESC, c.connection_id DESC
LIMIT CASE
    WHEN $3::integer BETWEEN 1 AND 50 THEN $3::integer
    ELSE 0
END;
