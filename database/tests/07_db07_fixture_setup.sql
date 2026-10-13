\set ON_ERROR_STOP on

\echo 'DB-07 dedicated fixture setup: administrator-approved committed fixtures only.'
BEGIN;
SET LOCAL search_path = campus_duo, public;

DO $$
BEGIN
    IF current_database() <> 'campus_duo_dev'
       OR current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'DB-07 fixture setup requires campus_duo_migrator on campus_duo_dev.';
    END IF;
    IF EXISTS (SELECT 1 FROM campus_duo.moderation_report WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid)
       OR EXISTS (SELECT 1 FROM campus_duo.outbox_event WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid)
       OR EXISTS (SELECT 1 FROM campus_duo.audit_event WHERE audit_event_id = '00000000-0000-0000-0000-00000000D7C1'::uuid) THEN
        RAISE EXCEPTION 'DB-07 fixture identifiers already exist; refusing to overwrite unrelated records.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM campus_duo.user_account WHERE user_id = '00000000-0000-0000-0000-00000000D501'::uuid)
       OR NOT EXISTS (SELECT 1 FROM campus_duo.user_account WHERE user_id = '00000000-0000-0000-0000-00000000D502'::uuid)
       OR NOT EXISTS (SELECT 1 FROM campus_duo.user_account WHERE user_id = '00000000-0000-0000-0000-00000000D503'::uuid) THEN
        RAISE EXCEPTION 'DB-07 fixture setup requires the recorded DB-05 synthetic users.';
    END IF;
END
$$;

INSERT INTO campus_duo.moderation_report (
    report_id, reporter_user_id, reported_user_id, category, description
)
VALUES (
    '00000000-0000-0000-0000-00000000D7A1'::uuid,
    '00000000-0000-0000-0000-00000000D501'::uuid,
    '00000000-0000-0000-0000-00000000D502'::uuid,
    'OTHER',
    '[DB-07 FIXTURE] Dedicated moderation report; safe to remove with cleanup.'
);

INSERT INTO campus_duo.outbox_event (
    outbox_event_id, event_type, aggregate_type, aggregate_id, dedupe_key,
    payload, status, attempts, next_attempt_at, correlation_id
)
VALUES (
    '00000000-0000-0000-0000-00000000D7B1'::uuid,
    'DB07_FIXTURE', 'USER', '00000000-0000-0000-0000-00000000D501'::uuid,
    'db07-fixture-outbox', '{"fixture":"DB07-1.1"}'::jsonb,
    'PENDING', 0, NULL, 'db07-fixture-correlation'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.moderation_report
         WHERE report_id = '00000000-0000-0000-0000-00000000D7A1'::uuid
           AND reporter_user_id = '00000000-0000-0000-0000-00000000D501'::uuid
           AND reported_user_id = '00000000-0000-0000-0000-00000000D502'::uuid
           AND status = 'PENDING_REVIEW'
           AND audit_event_id IS NULL
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.outbox_event
         WHERE outbox_event_id = '00000000-0000-0000-0000-00000000D7B1'::uuid
           AND event_type = 'DB07_FIXTURE'
           AND aggregate_type = 'USER'
           AND aggregate_id = '00000000-0000-0000-0000-00000000D501'::uuid
           AND status = 'PENDING' AND attempts = 0
           AND next_attempt_at IS NULL AND dispatched_at IS NULL
    ) THEN
        RAISE EXCEPTION 'DB-07 dedicated fixture identity assertion failed.';
    END IF;
END
$$;

COMMIT;
\echo 'PASS: DB-07 dedicated fixtures committed; dispatcher isolation is required before runtime tests.'
