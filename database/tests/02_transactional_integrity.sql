\set ON_ERROR_STOP on

\echo 'DB-04C transactional integrity checks: synthetic fixtures are created inside one rollback-only transaction.'
\echo 'Execution requires an authenticated campus_duo_migrator owner session; a failed run must leave no fixtures committed.'

BEGIN;

CREATE FUNCTION pg_temp.campus_duo_expect_error(
    expected_sqlstate text,
    expected_constraint text,
    expected_column text,
    statement text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    actual_sqlstate text;
    actual_constraint text;
    actual_column text;
BEGIN
    IF expected_sqlstate IS NULL THEN
        RAISE EXCEPTION 'Expected SQLSTATE must not be NULL.';
    END IF;
    BEGIN
        EXECUTE statement;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            actual_sqlstate = RETURNED_SQLSTATE,
            actual_constraint = CONSTRAINT_NAME,
            actual_column = COLUMN_NAME;
        actual_sqlstate := NULLIF(actual_sqlstate, '');
        actual_constraint := NULLIF(actual_constraint, '');
        actual_column := NULLIF(actual_column, '');
        IF actual_sqlstate IS NOT DISTINCT FROM expected_sqlstate
           AND (
               expected_constraint IS NULL
               OR actual_constraint IS NOT DISTINCT FROM expected_constraint
           )
           AND (
               expected_column IS NULL
               OR actual_column IS NOT DISTINCT FROM expected_column
           ) THEN
            RETURN;
        END IF;
        RAISE EXCEPTION
            'Unexpected error: expected SQLSTATE %, constraint %, column %, got SQLSTATE %, constraint %, column %',
            expected_sqlstate, expected_constraint, expected_column,
            actual_sqlstate, actual_constraint, actual_column;
    END;

    RAISE EXCEPTION
        'Expected SQLSTATE %, constraint %, column %, but statement succeeded',
        expected_sqlstate, expected_constraint, expected_column;
END
$$;

INSERT INTO campus_duo.user_account (
    user_id, identity_subject, role, verification_status, onboarding_status
)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'db04c-test-a', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED'),
    ('00000000-0000-0000-0000-000000000002', 'db04c-test-b', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED'),
    ('00000000-0000-0000-0000-000000000003', 'db04c-test-admin', 'ROLE_ADMIN', 'VERIFIED', 'COMPLETED');

INSERT INTO campus_duo.student_profile (user_id)
VALUES
    ('00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002');

INSERT INTO campus_duo.course (course_id, code, name, department)
VALUES ('00000000-0000-0000-0000-000000000004', 'CS455', 'Database Systems', 'CSE');

INSERT INTO campus_duo.social_interest (interest_id, name, category)
VALUES ('00000000-0000-0000-0000-000000000005', 'Distributed Systems', 'TECH_ACADEMIC');

INSERT INTO campus_duo.connection (connection_id, user_a_id, user_b_id, mode)
VALUES (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'STUDY'
);

INSERT INTO campus_duo.study_location (
    location_id, name, building, open_time, close_time, noise_policy
)
VALUES
    ('00000000-0000-0000-0000-000000000010',
     'DB-04C Test Location', 'TEST', '08:00', '20:00', 'WHISPER_COLLAB'),
    ('00000000-0000-0000-0000-000000000020',
     'DB-04C Second Location', 'TEST-2', '08:00', '20:00', 'CONVERSATIONAL');

INSERT INTO campus_duo.study_table (table_id, location_id, table_number)
VALUES
    ('00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000010', 'TEST-01'),
    ('00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000020', 'TEST-02');

INSERT INTO campus_duo.study_slot (
    slot_id, table_id, location_id, local_date, start_time, end_time, zone
)
VALUES
    ('00000000-0000-0000-0000-000000000012',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000010',
     DATE '2099-01-01', TIME '10:00', TIME '12:00', 'COLLABORATIVE_STUDY'),
    ('00000000-0000-0000-0000-000000000015',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000010',
     DATE '2099-01-01', TIME '14:00', TIME '16:00', 'COLLABORATIVE_STUDY'),
    ('00000000-0000-0000-0000-000000000022',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000020',
     DATE '2099-01-01', TIME '10:00', TIME '12:00', 'SILENT_READING');

-- Required NULL values and invalid enumerated values.
SELECT pg_temp.campus_duo_expect_error(
    '23502', NULL, 'identity_subject',
    $$INSERT INTO campus_duo.user_account (role) VALUES ('ROLE_STUDENT')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23502', NULL, 'connection_id',
    $$INSERT INTO campus_duo.booking (booker_id, table_id, location_id, slot_id, local_date)
      VALUES ('00000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000011',
              '00000000-0000-0000-0000-000000000010',
              '00000000-0000-0000-0000-000000000012', DATE '2099-01-01')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'user_account_role_ck', NULL,
    $$INSERT INTO campus_duo.user_account (identity_subject, role)
      VALUES ('db04c-invalid-role', 'ROLE_UNKNOWN')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'connection_mode_ck', NULL,
    $$INSERT INTO campus_duo.connection (user_a_id, user_b_id, mode)
      VALUES ('00000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000002', 'UNKNOWN')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'booking_status_ck', NULL,
    $$INSERT INTO campus_duo.booking (
        connection_id, booker_id, table_id, location_id, slot_id, local_date, status
      ) VALUES ('00000000-0000-0000-0000-000000000013',
                '00000000-0000-0000-0000-000000000001',
                '00000000-0000-0000-0000-000000000011',
                '00000000-0000-0000-0000-000000000010',
                '00000000-0000-0000-0000-000000000012',
                DATE '2099-01-01', 'UNKNOWN')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'study_slot_status_ck', NULL,
    $$INSERT INTO campus_duo.study_slot (
        table_id, location_id, local_date, start_time, end_time, zone, status
      ) VALUES ('00000000-0000-0000-0000-000000000011',
                '00000000-0000-0000-0000-000000000010',
                DATE '2099-01-02', TIME '10:00', TIME '12:00',
                'COLLABORATIVE_STUDY', 'RESERVED')$$
);

-- Duplicate identity, catalog, and profile selections.
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'user_account_identity_subject_uk', NULL,
    $$INSERT INTO campus_duo.user_account (identity_subject)
      VALUES ('db04c-test-a')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'course_code_ci_uk', NULL,
    $$INSERT INTO campus_duo.course (code, name, department)
      VALUES ('cs455', 'Duplicate', 'CSE')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'social_interest_category_name_ci_uk', NULL,
    $$INSERT INTO campus_duo.social_interest (name, category)
      VALUES ('distributed systems', 'TECH_ACADEMIC')$$
);
INSERT INTO campus_duo.profile_course (user_id, course_id)
VALUES ('00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000004');
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'profile_course_pkey', NULL,
    $$INSERT INTO campus_duo.profile_course (user_id, course_id)
      VALUES ('00000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000004')$$
);
INSERT INTO campus_duo.profile_interest (user_id, interest_id)
VALUES ('00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000005');
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'profile_interest_pkey', NULL,
    $$INSERT INTO campus_duo.profile_interest (user_id, interest_id)
      VALUES ('00000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000005')$$
);

-- Self-actions, invalid canonical ordering, and missing references.
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'discovery_action_not_self_ck', NULL,
    $$INSERT INTO campus_duo.discovery_action (actor_user_id, target_user_id, mode, action_type)
      VALUES ('00000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000001', 'STUDY', 'LIKE')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'connection_users_order_ck', NULL,
    $$INSERT INTO campus_duo.connection (user_a_id, user_b_id, mode)
      VALUES ('00000000-0000-0000-0000-000000000002',
              '00000000-0000-0000-0000-000000000001', 'STUDY')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23503', 'student_profile_user_fk', NULL,
    $$INSERT INTO campus_duo.student_profile (user_id)
      VALUES ('00000000-0000-0000-0000-000000009999')$$
);

-- Resource identity, table/location/date mismatches, overlap, and adjacency.
SELECT pg_temp.campus_duo_expect_error(
    '23503', 'booking_slot_resource_fk', NULL,
    $$INSERT INTO campus_duo.booking (
        connection_id, booker_id, table_id, location_id, slot_id, local_date
      ) VALUES ('00000000-0000-0000-0000-000000000013',
                '00000000-0000-0000-0000-000000000001',
                '00000000-0000-0000-0000-000000000021',
                '00000000-0000-0000-0000-000000000020',
                '00000000-0000-0000-0000-000000000012',
                DATE '2099-01-01')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23503', 'booking_slot_resource_fk', NULL,
    $$INSERT INTO campus_duo.booking (
        connection_id, booker_id, table_id, location_id, slot_id, local_date
      ) VALUES ('00000000-0000-0000-0000-000000000013',
                '00000000-0000-0000-0000-000000000001',
                '00000000-0000-0000-0000-000000000011',
                '00000000-0000-0000-0000-000000000010',
                '00000000-0000-0000-0000-000000000012',
                DATE '2099-01-02')$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23P01', 'study_slot_no_overlap_excl', NULL,
    $$INSERT INTO campus_duo.study_slot (
        table_id, location_id, local_date, start_time, end_time, zone
      ) VALUES ('00000000-0000-0000-0000-000000000011',
                '00000000-0000-0000-0000-000000000010',
                DATE '2099-01-01', TIME '11:00', TIME '13:00',
                'COLLABORATIVE_STUDY')$$
);
INSERT INTO campus_duo.study_slot (
    table_id, location_id, local_date, start_time, end_time, zone
)
VALUES ('00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000010',
        DATE '2099-01-01', TIME '12:00', TIME '14:00',
        'COLLABORATIVE_STUDY');

-- Cancellation/rebooking and reschedule lineage remain separate.
INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
VALUES (
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000012',
    DATE '2099-01-01'
);
INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
VALUES
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'CREATOR'),
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', 'COMPANION');
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'booking_confirmed_resource_uk', NULL,
    $$INSERT INTO campus_duo.booking (
        connection_id, booker_id, table_id, location_id, slot_id, local_date
      ) VALUES ('00000000-0000-0000-0000-000000000013',
                '00000000-0000-0000-0000-000000000002',
                '00000000-0000-0000-0000-000000000011',
                '00000000-0000-0000-0000-000000000010',
                '00000000-0000-0000-0000-000000000012',
                DATE '2099-01-01')$$
);
UPDATE campus_duo.booking
   SET status = 'CANCELLED', cancelled_at = now(),
       cancelled_by = '00000000-0000-0000-0000-000000000001',
       cancellation_reason = 'TEST_CANCELLED'
 WHERE booking_id = '00000000-0000-0000-0000-000000000014';
INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
VALUES (
    '00000000-0000-0000-0000-000000000016',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000012',
    DATE '2099-01-01'
);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.booking
         WHERE booking_id = '00000000-0000-0000-0000-000000000014'
           AND status = 'CANCELLED' AND cancellation_reason = 'TEST_CANCELLED'
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.booking
         WHERE booking_id = '00000000-0000-0000-0000-000000000016'
           AND status = 'CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'Cancellation history or cancelled-resource reuse was not retained.';
    END IF;
END
$$;

INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
VALUES (
    '00000000-0000-0000-0000-000000000018',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000015',
    DATE '2099-01-01'
);
UPDATE campus_duo.booking
   SET status = 'CANCELLED', cancelled_at = now(),
       cancelled_by = '00000000-0000-0000-0000-000000000001',
       cancellation_reason = 'RESCHEDULED'
 WHERE booking_id = '00000000-0000-0000-0000-000000000018';
INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date,
    rescheduled_from_booking_id
)
VALUES (
    '00000000-0000-0000-0000-000000000019',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000015',
    DATE '2099-01-01',
    '00000000-0000-0000-0000-000000000018'
);
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'booking_direct_successor_uk', NULL,
    $$INSERT INTO campus_duo.booking (
        booking_id, connection_id, booker_id, table_id, location_id, slot_id,
        local_date, status, cancelled_at, cancelled_by, cancellation_reason,
        rescheduled_from_booking_id
      ) VALUES (
        '00000000-0000-0000-0000-000000000017',
        '00000000-0000-0000-0000-000000000013',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000022',
        DATE '2099-01-01', 'CANCELLED', now(),
        '00000000-0000-0000-0000-000000000001', 'TEST_DUPLICATE_SUCCESSOR',
        '00000000-0000-0000-0000-000000000018')$$
);

-- Completed timestamp coherence and self-lineage.
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'booking_completed_fields_ck', NULL,
    $$UPDATE campus_duo.booking
         SET status = 'COMPLETED', completed_at = NULL
       WHERE booking_id = '00000000-0000-0000-0000-000000000016'$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'booking_completed_fields_ck', NULL,
    $$UPDATE campus_duo.booking
         SET completed_at = now()
       WHERE booking_id = '00000000-0000-0000-0000-000000000016'$$
);
INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000022',
    DATE '2099-01-01'
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'booking_self_lineage_ck', NULL,
    $$UPDATE campus_duo.booking
         SET rescheduled_from_booking_id = booking_id
       WHERE booking_id = '00000000-0000-0000-0000-000000000020'$$
);

-- Actor-scoped idempotency uniqueness; a different actor may use the same operation key.
INSERT INTO campus_duo.idempotency_record (
    actor_user_id, operation_type, client_operation_id, request_fingerprint,
    outcome_status, booking_id
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'CREATE_BOOKING', 'db04c-create-1', 'fingerprint-1', 'SUCCEEDED',
    '00000000-0000-0000-0000-000000000016'
);
SELECT pg_temp.campus_duo_expect_error(
    '23505', 'idempotency_actor_operation_key_uk', NULL,
    $$INSERT INTO campus_duo.idempotency_record (
        actor_user_id, operation_type, client_operation_id, request_fingerprint,
        outcome_status, booking_id
      ) VALUES ('00000000-0000-0000-0000-000000000001',
                'CREATE_BOOKING', 'db04c-create-1', 'different-fingerprint',
                'CONFLICT', '00000000-0000-0000-0000-000000000016')$$
);
INSERT INTO campus_duo.idempotency_record (
    actor_user_id, operation_type, client_operation_id, request_fingerprint, outcome_status
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'CREATE_BOOKING', 'db04c-create-1', 'fingerprint-b', 'PENDING'
);

-- Outbox constraints are database-enforced; workflow dispatch remains BACKEND REQUIRED.
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'outbox_event_attempts_ck', NULL,
    $$INSERT INTO campus_duo.outbox_event (event_type, aggregate_type, aggregate_id, attempts)
      VALUES ('BOOKING_CREATED', 'BOOKING',
              '00000000-0000-0000-0000-000000000016', -1)$$
);
SELECT pg_temp.campus_duo_expect_error(
    '23514', 'outbox_event_dispatched_fields_ck', NULL,
    $$INSERT INTO campus_duo.outbox_event (
        event_type, aggregate_type, aggregate_id, status, dispatched_at
      ) VALUES ('BOOKING_CREATED', 'BOOKING',
                '00000000-0000-0000-0000-000000000016',
                'PENDING', now())$$
);

ROLLBACK;

\echo 'Transactional integrity checks completed successfully; the outer transaction was rolled back and fixtures remain uncommitted.'
