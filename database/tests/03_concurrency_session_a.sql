\set ON_ERROR_STOP on

\echo 'Session A: insert the winning booking and keep the transaction open while Session B waits.'
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
VALUES (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000109',
    DATE '2099-02-01'
);

INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
VALUES
    ('00000000-0000-0000-0000-000000000104',
     '00000000-0000-0000-0000-000000000101', 'CREATOR'),
    ('00000000-0000-0000-0000-000000000104',
     '00000000-0000-0000-0000-000000000102', 'COMPANION');

INSERT INTO campus_duo.idempotency_record (
    idempotency_id, actor_user_id, operation_type, client_operation_id,
    request_fingerprint, outcome_status, booking_id
)
VALUES (
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000101',
    'CREATE_BOOKING', 'db04c-race-a', 'db04c-race-a-fingerprint',
    'SUCCEEDED', '00000000-0000-0000-0000-000000000104'
);

INSERT INTO campus_duo.audit_event (
    audit_event_id, actor_user_id, actor_role, action, target_type, target_id,
    outcome, operation_id, safe_reason
)
VALUES (
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000101', 'ROLE_STUDENT',
    'BOOKING_CREATED', 'BOOKING', '00000000-0000-0000-0000-000000000104',
    'SUCCESS', 'db04c-race-a', 'Synthetic concurrency winner'
);

INSERT INTO campus_duo.outbox_event (
    outbox_event_id, event_type, aggregate_type, aggregate_id, dedupe_key, payload
)
VALUES (
    '00000000-0000-0000-0000-000000000110',
    'BOOKING_CREATED', 'BOOKING', '00000000-0000-0000-0000-000000000104',
    'db04c-race-a-outbox', '{"fixture":"db04c-race-a"}'::jsonb
);

\echo 'Session A is intentionally paused. Start Session B now; when its insert is visibly waiting, press Enter here to COMMIT A.'
\echo 'Keep Session B within its 5-second lock timeout: press Enter promptly after B is visibly waiting.'
\prompt 'Press Enter to commit Session A: ' commit_a
COMMIT;
\echo 'Session A committed the winner ID 00000000-0000-0000-0000-000000000104.'
