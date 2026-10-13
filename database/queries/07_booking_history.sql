-- DB-06 query contract: participant-authorized booking history/detail.
-- Parameters: $1 uuid authenticated viewer; $2 uuid booking_id nullable; $3 integer limit (1..50);
-- $4 timestamptz last_created_at nullable; $5 uuid last_booking_id nullable cursor.
-- Authorization: viewer must be booker or current booking participant; admin path is separate.
-- Participants aggregate to JSONB to prevent row multiplication. Empty result is valid.
-- Indexes: booking_participant_user_ix, booking_booker_status_date_ix, booking PK.
SELECT
    b.booking_id,
    b.booker_id,
    b.connection_id,
    b.table_id,
    b.location_id,
    l.name AS location_name,
    t.table_number,
    b.slot_id,
    b.local_date,
    s.start_time,
    s.end_time,
    b.status,
    b.partner_approval_status,
    b.booking_version,
    b.created_at,
    b.cancelled_at,
    b.rescheduled_from_booking_id,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'userId', p.user_id, 'role', p.participant_role, 'joinedAt', p.joined_at,
            'removedAt', p.removed_at
        ) ORDER BY p.participant_role, p.user_id)
        FROM campus_duo.booking_participant p
        WHERE p.booking_id = b.booking_id
    ), '[]'::jsonb) AS participants
FROM campus_duo.booking b
JOIN campus_duo.study_location l ON l.location_id = b.location_id
JOIN campus_duo.study_table t ON t.table_id = b.table_id
JOIN campus_duo.study_slot s ON s.slot_id = b.slot_id
WHERE ($2::uuid IS NULL OR b.booking_id = $2)
  AND (
      b.booker_id = $1
      OR EXISTS (
          SELECT 1 FROM campus_duo.booking_participant bp
          WHERE bp.booking_id = b.booking_id
            AND bp.user_id = $1
            AND bp.removed_at IS NULL
      )
  )
  AND $3 BETWEEN 1 AND 50
  AND (($4::timestamptz IS NULL AND $5::uuid IS NULL)
       OR ($4::timestamptz IS NOT NULL AND $5::uuid IS NOT NULL
           AND (b.created_at, b.booking_id) < ($4, $5)))
ORDER BY b.created_at DESC, b.booking_id DESC
LIMIT CASE
    WHEN $3::integer BETWEEN 1 AND 50 THEN $3::integer
    ELSE 0
END;
