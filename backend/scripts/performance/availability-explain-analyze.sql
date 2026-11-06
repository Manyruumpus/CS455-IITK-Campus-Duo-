\set ON_ERROR_STOP on
\if :{?test_date}
\else
\echo 'test_date is required'
\quit 2
\endif
\if :{?location_id}
\else
\echo 'location_id is required'
\quit 2
\endif

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
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
  AND :'test_date'::date IS NOT NULL
  AND :'test_date'::date IS NOT NULL
  AND :'test_date'::date <= :'test_date'::date
  AND s.local_date BETWEEN :'test_date'::date AND :'test_date'::date
  AND s.location_id = :'location_id'::uuid
ORDER BY s.local_date, s.start_time, s.location_id, s.table_id, s.slot_id
LIMIT 100;
