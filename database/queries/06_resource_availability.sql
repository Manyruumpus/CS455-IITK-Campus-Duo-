-- DB-06 query contract: active locations, tables, and slot availability.
-- Parameters: $1 date; $2 date; $3 uuid location_id nullable; $4 integer limit (1..100).
-- Authorization: authenticated reader; public inventory fields only.
-- Confirmed occupancy is derived from booking.status = CONFIRMED. Cancelled history does not consume availability.
-- Ordering: local_date, start_time, location_id, table_id, slot_id.
-- Indexes: study_slot_location_date_status_ix, study_slot_table_date_start_ix, booking_confirmed_resource_uk.
SELECT
    s.slot_id,
    s.location_id,
    l.name AS location_name,
    l.building,
    s.table_id,
    t.table_number,
    s.local_date,
    s.start_time,
    s.end_time,
    s.zone,
    s.status,
    t.capacity,
    CASE WHEN confirmed.booking_id IS NULL THEN 0 ELSE 2 END AS reserved_count
FROM campus_duo.study_slot s
JOIN campus_duo.study_location l ON l.location_id = s.location_id AND l.active
JOIN campus_duo.study_table t ON t.table_id = s.table_id AND t.active
LEFT JOIN campus_duo.booking confirmed
  ON confirmed.table_id = s.table_id
 AND confirmed.local_date = s.local_date
 AND confirmed.slot_id = s.slot_id
 AND confirmed.status = 'CONFIRMED'
WHERE s.active
  AND s.status = 'AVAILABLE'
  AND $4 BETWEEN 1 AND 100
  AND $1 IS NOT NULL
  AND $2 IS NOT NULL
  AND $1 <= $2
  AND s.local_date BETWEEN $1 AND $2
  AND ($3::uuid IS NULL OR s.location_id = $3)
ORDER BY s.local_date, s.start_time, s.location_id, s.table_id, s.slot_id
LIMIT CASE
    WHEN $4::integer BETWEEN 1 AND 100 THEN $4::integer
    ELSE 0
END;
