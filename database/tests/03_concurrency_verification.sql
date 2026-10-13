\set ON_ERROR_STOP on

\echo 'Concurrency verification: checking exact resource, winner, loser absence, source references, and atomic fixture records.'

DO $$
DECLARE
    confirmed_count integer;
BEGIN
    SELECT count(*) INTO confirmed_count
      FROM campus_duo.booking
     WHERE table_id = '00000000-0000-0000-0000-000000000108'
       AND location_id = '00000000-0000-0000-0000-000000000107'
       AND slot_id = '00000000-0000-0000-0000-000000000109'
       AND local_date = DATE '2099-02-01'
       AND status = 'CONFIRMED';

    IF confirmed_count <> 1
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.booking
            WHERE booking_id = '00000000-0000-0000-0000-000000000104'
              AND status = 'CONFIRMED'
       )
       OR EXISTS (
           SELECT 1 FROM campus_duo.booking
            WHERE booking_id = '00000000-0000-0000-0000-000000000111'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.connection
            WHERE connection_id = '00000000-0000-0000-0000-000000000103'
              AND user_a_id = '00000000-0000-0000-0000-000000000101'
              AND user_b_id = '00000000-0000-0000-0000-000000000102'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.study_location
            WHERE location_id = '00000000-0000-0000-0000-000000000107'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.study_table
            WHERE table_id = '00000000-0000-0000-0000-000000000108'
              AND location_id = '00000000-0000-0000-0000-000000000107'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.study_slot
            WHERE slot_id = '00000000-0000-0000-0000-000000000109'
              AND table_id = '00000000-0000-0000-0000-000000000108'
              AND location_id = '00000000-0000-0000-0000-000000000107'
              AND local_date = DATE '2099-02-01'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.idempotency_record
            WHERE idempotency_id = '00000000-0000-0000-0000-000000000105'
              AND booking_id = '00000000-0000-0000-0000-000000000104'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.audit_event
            WHERE audit_event_id = '00000000-0000-0000-0000-000000000106'
              AND target_id = '00000000-0000-0000-0000-000000000104'
       )
       OR NOT EXISTS (
           SELECT 1 FROM campus_duo.outbox_event
            WHERE outbox_event_id = '00000000-0000-0000-0000-000000000110'
              AND aggregate_id = '00000000-0000-0000-0000-000000000104'
       ) THEN
        RAISE EXCEPTION 'Concurrency verification failed for exact winner, loser absence, references, or atomic fixture records.';
    END IF;
END
$$;

SELECT booking_id, table_id, location_id, slot_id, local_date, status
  FROM campus_duo.booking
 WHERE booking_id = '00000000-0000-0000-0000-000000000104';

\echo 'Concurrency verification completed successfully for the committed synthetic fixture.'
