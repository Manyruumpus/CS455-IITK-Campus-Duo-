\set ON_ERROR_STOP on

\echo 'DB-08 scratch restore verification (read-only).'
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = campus_duo, public;

SELECT set_config(
    'db08.expected_counts',
    jsonb_build_object(
        'user_account', :'expected_user_account_count'::bigint,
        'student_profile', :'expected_student_profile_count'::bigint,
        'profile_preferred_time', :'expected_profile_preferred_time_count'::bigint,
        'course', :'expected_course_count'::bigint,
        'profile_course', :'expected_profile_course_count'::bigint,
        'social_interest', :'expected_social_interest_count'::bigint,
        'profile_interest', :'expected_profile_interest_count'::bigint,
        'consent_record', :'expected_consent_record_count'::bigint,
        'consent_history', :'expected_consent_history_count'::bigint,
        'discovery_action', :'expected_discovery_action_count'::bigint,
        'connection', :'expected_connection_count'::bigint,
        'block', :'expected_block_count'::bigint,
        'study_location', :'expected_study_location_count'::bigint,
        'study_table', :'expected_study_table_count'::bigint,
        'study_slot', :'expected_study_slot_count'::bigint,
        'booking', :'expected_booking_count'::bigint,
        'booking_participant', :'expected_booking_participant_count'::bigint,
        'idempotency_record', :'expected_idempotency_record_count'::bigint,
        'notification', :'expected_notification_count'::bigint,
        'moderation_report', :'expected_moderation_report_count'::bigint,
        'audit_event', :'expected_audit_event_count'::bigint,
        'outbox_event', :'expected_outbox_event_count'::bigint
    )::text,
    true
);

DO $$
DECLARE
    object_name name;
    expected_count bigint;
    actual_count bigint;
    expected_counts jsonb := current_setting('db08.expected_counts')::jsonb;
    objects name[] := ARRAY[
        'user_account', 'student_profile', 'profile_preferred_time', 'course',
        'profile_course', 'social_interest', 'profile_interest', 'consent_record',
        'consent_history', 'discovery_action', 'connection', 'block',
        'study_location', 'study_table', 'study_slot', 'booking',
        'booking_participant', 'idempotency_record', 'notification',
        'moderation_report', 'audit_event', 'outbox_event'
    ];
BEGIN
    IF current_database() <> 'campus_duo_restore_check' THEN
        RAISE EXCEPTION 'DB-08 verifier requires campus_duo_restore_check, found %.', current_database();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_namespace n
        JOIN pg_roles r ON r.oid = n.nspowner
        WHERE n.nspname = 'campus_duo' AND r.rolname = 'campus_duo_migrator'
    ) THEN
        RAISE EXCEPTION 'campus_duo schema is not owned by campus_duo_migrator.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_roles r ON r.oid = c.relowner
        WHERE n.nspname = 'campus_duo'
          AND c.relname = ANY(objects)
          AND r.rolname <> 'campus_duo_migrator'
    ) THEN
        RAISE EXCEPTION 'A restored business table has an unexpected owner.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'btree_gist' AND n.nspname <> 'public'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
    ) THEN
        RAISE EXCEPTION 'btree_gist is missing or not in public.';
    END IF;
    IF (SELECT array_agg(version::text ORDER BY version::text)
          FROM campus_duo.flyway_schema_history)
       IS DISTINCT FROM ARRAY['001','002','003','004','005','006','007','008']::text[] THEN
        RAISE EXCEPTION 'Migration history does not show exactly successful versions 001 through 008.';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM campus_duo.flyway_schema_history
         WHERE success IS DISTINCT FROM true
    ) THEN
        RAISE EXCEPTION 'Migration history contains a row that did not succeed.';
    END IF;

    FOREACH object_name IN ARRAY objects LOOP
        EXECUTE format('SELECT count(*) FROM campus_duo.%I', object_name) INTO actual_count;
        expected_count := (expected_counts ->> object_name)::bigint;
        IF expected_count IS NULL THEN
            RAISE EXCEPTION 'No backup-time row count was supplied for %.', object_name;
        END IF;
        IF actual_count <> expected_count THEN
            RAISE EXCEPTION 'Backup-time row count mismatch for %: expected %, found %.',
                object_name, expected_count, actual_count;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.user_account
        WHERE user_id = '00000000-0000-0000-0000-00000000D501'::uuid
          AND identity_subject = 'db05-dev-alex'
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.user_account
        WHERE user_id = '00000000-0000-0000-0000-00000000D502'::uuid
          AND identity_subject = 'db05-dev-sam'
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.discovery_action
        WHERE action_id = '00000000-0000-0000-0000-00000000D551'::uuid
          AND actor_user_id = '00000000-0000-0000-0000-00000000D501'::uuid
          AND target_user_id = '00000000-0000-0000-0000-00000000D502'::uuid
          AND mode = 'STUDY'
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.study_slot
        WHERE slot_id = '00000000-0000-0000-0000-00000000D576'::uuid
          AND table_id = '00000000-0000-0000-0000-00000000D573'::uuid
    ) THEN
        RAISE EXCEPTION 'Selected DB-05 fixture identities were not restored.';
    END IF;
END
$$;

DO $$
BEGIN
    IF has_column_privilege('campus_duo_app', 'campus_duo.audit_event', 'details', 'SELECT')
       OR has_column_privilege('campus_duo_admin_service', 'campus_duo.audit_event', 'details', 'SELECT')
       OR has_column_privilege('campus_duo_app', 'campus_duo.audit_event', 'audit_event_id', 'SELECT')
       OR has_column_privilege('campus_duo_admin_service', 'campus_duo.audit_event', 'audit_event_id', 'UPDATE')
       OR has_column_privilege('campus_duo_worker', 'campus_duo.outbox_event', 'payload', 'UPDATE')
       OR has_any_column_privilege('campus_duo_worker', 'campus_duo.booking', 'SELECT')
       OR has_table_privilege('campus_duo_app', 'campus_duo.booking', 'DELETE')
       OR NOT has_table_privilege('campus_duo_app', 'campus_duo.profile_course', 'DELETE')
       OR NOT has_column_privilege('campus_duo_worker', 'campus_duo.outbox_event', 'status', 'UPDATE')
       OR NOT has_column_privilege('campus_duo_worker', 'campus_duo.outbox_event', 'attempts', 'UPDATE')
       OR NOT has_column_privilege('campus_duo_worker', 'campus_duo.outbox_event', 'next_attempt_at', 'UPDATE')
       OR NOT has_column_privilege('campus_duo_worker', 'campus_duo.outbox_event', 'dispatched_at', 'UPDATE')
       OR has_table_privilege('campus_duo_app', 'campus_duo.flyway_schema_history', 'SELECT')
       OR has_table_privilege('campus_duo_app', 'campus_duo.flyway_schema_history', 'INSERT')
       OR has_table_privilege('campus_duo_app', 'campus_duo.flyway_schema_history', 'UPDATE')
       OR has_table_privilege('campus_duo_app', 'campus_duo.flyway_schema_history', 'DELETE') THEN
        RAISE EXCEPTION 'Restored effective privilege boundary does not match DB-07.';
    END IF;
END
$$;

ROLLBACK;
\echo 'PASS: DB-08 scratch restore verification completed; no changes committed.'
