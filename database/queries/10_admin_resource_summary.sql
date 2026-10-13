-- DB-06 query contract: administrator resource summary.
-- Parameters: $1 date lower bound (required); $2 integer limit (1..100, required).
-- Authorization: backend must require ROLE_ADMIN; this parameter does not authenticate.
SELECT
    l.location_id, l.name AS location_name, l.building, l.active,
    count(DISTINCT t.table_id) FILTER (WHERE t.active) AS table_count,
    count(DISTINCT b.booking_id) FILTER (WHERE b.status = 'CONFIRMED') AS future_confirmed_bookings
FROM campus_duo.study_location l
LEFT JOIN campus_duo.study_table t ON t.location_id = l.location_id
LEFT JOIN campus_duo.booking b ON b.table_id = t.table_id
    AND b.local_date >= $1 AND b.status = 'CONFIRMED'
WHERE $1 IS NOT NULL
GROUP BY l.location_id, l.name, l.building, l.active
HAVING $2 BETWEEN 1 AND 100
ORDER BY l.building, l.name, l.location_id
LIMIT CASE
    WHEN $2::integer BETWEEN 1 AND 100 THEN $2::integer
    ELSE 0
END;
