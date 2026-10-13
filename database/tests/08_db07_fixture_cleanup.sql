\set ON_ERROR_STOP on

\echo 'DB-07 dedicated fixture cleanup: administrator-approved cleanup only.'
BEGIN;
SET LOCAL search_path = campus_duo, public;

DO $$
DECLARE
    report_count integer;
    outbox_count integer;
    locked_report uuid;
    locked_outbox uuid;
BEGIN
    IF current_database() <> 'campus_duo_dev'
       OR current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'DB-07 fixture cleanup requires campus_duo_migrator on campus_duo_dev.';
    END IF;

    SELECT report_id INTO locked_report
      FROM campus_duo.moderation_report
     WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DB-07 report fixture D7A1 is missing.';
    END IF;

    SELECT outbox_event_id INTO locked_outbox
      FROM campus_duo.outbox_event
     WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DB-07 outbox fixture D7B1 is missing.';
    END IF;

    SELECT count(*) INTO report_count
      FROM campus_duo.moderation_report
     WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid
       AND reporter_user_id = '00000000-0000-0000-0000-00000000D501'::uuid
       AND reported_user_id = '00000000-0000-0000-0000-00000000D502'::uuid
       AND category = 'OTHER'
       AND description = '[DB-07 FIXTURE] Dedicated moderation report; safe to remove with cleanup.'
       AND status = 'PENDING_REVIEW'
       AND reviewed_by IS NULL
       AND reviewed_at IS NULL
       AND review_reason IS NULL
       AND audit_event_id IS NULL;
    IF report_count <> 1 THEN
        RAISE EXCEPTION 'DB-07 report fixture identity/state mismatch; expected exactly one unchanged D7A1 row, found %.',
            report_count;
    END IF;

    SELECT count(*) INTO outbox_count
      FROM campus_duo.outbox_event
     WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid
       AND event_type = 'DB07_FIXTURE'
       AND aggregate_type = 'USER'
       AND aggregate_id = '00000000-0000-0000-0000-00000000D501'::uuid
       AND dedupe_key = 'db07-fixture-outbox'
       AND payload = '{"fixture":"DB07-1.1"}'::jsonb
       AND status = 'PENDING'
       AND attempts = 0
       AND next_attempt_at IS NULL
       AND dispatched_at IS NULL
       AND correlation_id = 'db07-fixture-correlation';
    IF outbox_count <> 1 THEN
        RAISE EXCEPTION 'DB-07 outbox fixture identity/state mismatch; expected exactly one unchanged D7B1 row, found %.',
            outbox_count;
    END IF;
END
$$;

DELETE FROM campus_duo.outbox_event
 WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid;

DELETE FROM campus_duo.moderation_report
 WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM campus_duo.moderation_report
                WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid)
       OR EXISTS (SELECT 1 FROM campus_duo.outbox_event
                   WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid) THEN
        RAISE EXCEPTION 'DB-07 dedicated fixture cleanup did not remove the verified fixtures.';
    END IF;
END
$$;

COMMIT;
\echo 'PASS: DB-07 dedicated fixture cleanup completed.'
