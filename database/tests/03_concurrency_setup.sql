\set ON_ERROR_STOP on

\echo 'DB-04C concurrency setup: committed synthetic fixture namespace 00000000-0000-0000-0000-000000000101 through 00000000-0000-0000-0000-000000000109.'

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM campus_duo.user_account
         WHERE user_id IN (
             '00000000-0000-0000-0000-000000000101',
             '00000000-0000-0000-0000-000000000102'
         )
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.connection
         WHERE connection_id = '00000000-0000-0000-0000-000000000103'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.study_location
         WHERE location_id = '00000000-0000-0000-0000-000000000107'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.study_table
         WHERE table_id = '00000000-0000-0000-0000-000000000108'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.study_slot
         WHERE slot_id = '00000000-0000-0000-0000-000000000109'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.booking
         WHERE booking_id IN (
             '00000000-0000-0000-0000-000000000104',
             '00000000-0000-0000-0000-000000000111'
         )
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.idempotency_record
         WHERE idempotency_id = '00000000-0000-0000-0000-000000000105'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.audit_event
         WHERE audit_event_id = '00000000-0000-0000-0000-000000000106'
    ) OR EXISTS (
        SELECT 1 FROM campus_duo.outbox_event
         WHERE outbox_event_id = '00000000-0000-0000-0000-000000000110'
    ) THEN
        RAISE EXCEPTION 'Concurrency fixture IDs already exist; setup stopped without changing them.';
    END IF;
END
$$;

INSERT INTO campus_duo.user_account (user_id, identity_subject, role, verification_status, onboarding_status)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'db04c-concurrency-a', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED'),
    ('00000000-0000-0000-0000-000000000102', 'db04c-concurrency-b', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED');

INSERT INTO campus_duo.student_profile (user_id)
VALUES
    ('00000000-0000-0000-0000-000000000101'),
    ('00000000-0000-0000-0000-000000000102');

INSERT INTO campus_duo.connection (connection_id, user_a_id, user_b_id, mode)
VALUES (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    'STUDY'
);

INSERT INTO campus_duo.study_location (
    location_id, name, building, open_time, close_time, noise_policy
)
VALUES (
    '00000000-0000-0000-0000-000000000107',
    'DB-04C Concurrency Location', 'TEST-CONCURRENCY',
    '08:00', '20:00', 'WHISPER_COLLAB'
);

INSERT INTO campus_duo.study_table (table_id, location_id, table_number)
VALUES (
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000107',
    'CONCURRENCY-01'
);

INSERT INTO campus_duo.study_slot (
    slot_id, table_id, location_id, local_date, start_time, end_time, zone
)
VALUES (
    '00000000-0000-0000-0000-000000000109',
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000107',
    DATE '2099-02-01', TIME '10:00', TIME '12:00', 'COLLABORATIVE_STUDY'
);

COMMIT;
\echo 'Committed setup complete. Both race sessions can now see the exact synthetic references.'
