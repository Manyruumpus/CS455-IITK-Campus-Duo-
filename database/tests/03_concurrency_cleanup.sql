\set ON_ERROR_STOP on

\echo 'Concurrency cleanup: deleting only explicit DB-04C fixture IDs, children before parents.'
BEGIN;

DELETE FROM campus_duo.outbox_event
 WHERE outbox_event_id = '00000000-0000-0000-0000-000000000110';
DELETE FROM campus_duo.audit_event
 WHERE audit_event_id = '00000000-0000-0000-0000-000000000106';
DELETE FROM campus_duo.idempotency_record
 WHERE idempotency_id IN ('00000000-0000-0000-0000-000000000105');
DELETE FROM campus_duo.booking_participant
 WHERE booking_id IN ('00000000-0000-0000-0000-000000000104',
                      '00000000-0000-0000-0000-000000000111');
DELETE FROM campus_duo.booking
 WHERE booking_id IN ('00000000-0000-0000-0000-000000000104',
                      '00000000-0000-0000-0000-000000000111');
DELETE FROM campus_duo.study_slot
 WHERE slot_id = '00000000-0000-0000-0000-000000000109';
DELETE FROM campus_duo.study_table
 WHERE table_id = '00000000-0000-0000-0000-000000000108';
DELETE FROM campus_duo.study_location
 WHERE location_id = '00000000-0000-0000-0000-000000000107';
DELETE FROM campus_duo.connection
 WHERE connection_id = '00000000-0000-0000-0000-000000000103';
DELETE FROM campus_duo.student_profile
 WHERE user_id IN ('00000000-0000-0000-0000-000000000101',
                   '00000000-0000-0000-0000-000000000102');
DELETE FROM campus_duo.user_account
 WHERE user_id IN ('00000000-0000-0000-0000-000000000101',
                   '00000000-0000-0000-0000-000000000102');

COMMIT;
\echo 'Concurrency cleanup committed for explicit synthetic IDs only; unrelated records were not targeted.'
