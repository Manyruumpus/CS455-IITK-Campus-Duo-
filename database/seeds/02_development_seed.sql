\set ON_ERROR_STOP on

\echo 'DB-05 development seed: synthetic development data only; execution is intentionally explicit.'

BEGIN;

DO $$
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION 'DB-05 development seed requires campus_duo_dev, found %.', current_database();
    END IF;
    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'DB-05 development seed requires campus_duo_migrator, found %.', current_user;
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM pg_namespace
         WHERE nspname = 'campus_duo'
           AND nspowner = 'campus_duo_migrator'::regrole
    ) THEN
        RAISE EXCEPTION 'DB-05 development seed requires campus_duo owned by campus_duo_migrator.';
    END IF;
END
$$;

-- All IDs in this script use the DB-05 development namespace:
-- 00000000-0000-0000-0000-00000000D5xx.
INSERT INTO campus_duo.user_account (
    user_id, identity_subject, role, verification_status, onboarding_status,
    account_status, display_name, department, degree, year
)
VALUES
    ('00000000-0000-0000-0000-00000000D501', 'db05-dev-alex', 'ROLE_STUDENT',
     'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Alex', 'CSE', 'B.Tech', 4),
    ('00000000-0000-0000-0000-00000000D502', 'db05-dev-sam', 'ROLE_STUDENT',
     'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Sam', 'CSE', 'B.Tech', 4),
    ('00000000-0000-0000-0000-00000000D503', 'db05-dev-jordan', 'ROLE_STUDENT',
     'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Jordan', 'EE', 'B.Tech', 3)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO campus_duo.student_profile (
    user_id, social_bio, study_goals, study_style, preferred_pace
)
VALUES
    ('00000000-0000-0000-0000-00000000D501',
     '[SYNTHETIC DEV SEED] Systems practice and collaborative study.',
     '[SYNTHETIC DEV SEED] Prepare for networking assessments.',
     'QUIET_FOCUSED', 'STANDARD_REGULAR'),
    ('00000000-0000-0000-0000-00000000D502',
     '[SYNTHETIC DEV SEED] Structured study and peer review.',
     '[SYNTHETIC DEV SEED] Review distributed systems concepts.',
     'QUIET_FOCUSED', 'AHEAD_OF_CLASS'),
    ('00000000-0000-0000-0000-00000000D503',
     '[SYNTHETIC DEV SEED] Problem-solving practice.',
     '[SYNTHETIC DEV SEED] Work through foundational mathematics.',
     'PROBLEM_SOLVING', 'STANDARD_REGULAR')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO campus_duo.course (course_id, code, name, department, instructor)
VALUES
    ('00000000-0000-0000-0000-00000000D511', 'DB05-CS455',
     '[SYNTHETIC DEV SEED] Database Systems', 'CSE', '[SYNTHETIC]'),
    ('00000000-0000-0000-0000-00000000D512', 'DB05-MTH101',
     '[SYNTHETIC DEV SEED] Applied Mathematics', 'MTH', '[SYNTHETIC]')
ON CONFLICT (course_id) DO NOTHING;

INSERT INTO campus_duo.social_interest (
    interest_id, name, category, description
)
VALUES
    ('00000000-0000-0000-0000-00000000D521',
     '[SYNTHETIC DEV SEED] Robotics', 'TECH_ACADEMIC',
     '[SYNTHETIC DEV SEED] Fictional catalog interest.'),
    ('00000000-0000-0000-0000-00000000D522',
     '[SYNTHETIC DEV SEED] Chess', 'SPORTS_FITNESS',
     '[SYNTHETIC DEV SEED] Fictional catalog interest.')
ON CONFLICT (interest_id) DO NOTHING;

INSERT INTO campus_duo.profile_course (user_id, course_id)
VALUES
    ('00000000-0000-0000-0000-00000000D501', '00000000-0000-0000-0000-00000000D511'),
    ('00000000-0000-0000-0000-00000000D502', '00000000-0000-0000-0000-00000000D511'),
    ('00000000-0000-0000-0000-00000000D503', '00000000-0000-0000-0000-00000000D512')
ON CONFLICT (user_id, course_id) DO NOTHING;

INSERT INTO campus_duo.profile_interest (user_id, interest_id)
VALUES
    ('00000000-0000-0000-0000-00000000D501', '00000000-0000-0000-0000-00000000D521'),
    ('00000000-0000-0000-0000-00000000D502', '00000000-0000-0000-0000-00000000D521'),
    ('00000000-0000-0000-0000-00000000D503', '00000000-0000-0000-0000-00000000D522')
ON CONFLICT (user_id, interest_id) DO NOTHING;

-- STUDY and SOCIAL consent are separate records. Alex intentionally differs by mode.
INSERT INTO campus_duo.consent_record (
    consent_id, user_id, mode, has_consent, consented_at, revoked_at, policy_version
)
VALUES
    ('00000000-0000-0000-0000-00000000D531', '00000000-0000-0000-0000-00000000D501',
     'STUDY', true, timestamptz '2026-10-01 10:00:00+05:30', NULL, 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D532', '00000000-0000-0000-0000-00000000D501',
     'SOCIAL', false, timestamptz '2026-10-04 10:00:00+05:30',
     timestamptz '2026-10-05 10:00:00+05:30', 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D533', '00000000-0000-0000-0000-00000000D502',
     'STUDY', true, timestamptz '2026-10-02 11:00:00+05:30', NULL, 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D534', '00000000-0000-0000-0000-00000000D502',
     'SOCIAL', true, timestamptz '2026-10-02 11:05:00+05:30', NULL, 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D535', '00000000-0000-0000-0000-00000000D503',
     'STUDY', true, timestamptz '2026-10-03 12:00:00+05:30', NULL, 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D536', '00000000-0000-0000-0000-00000000D503',
     'SOCIAL', false, NULL, NULL, 'db05-synthetic-v1')
ON CONFLICT (consent_id) DO NOTHING;

INSERT INTO campus_duo.consent_history (
    consent_event_id, user_id, mode, event_type, has_consent, policy_version, source, occurred_at
)
VALUES
    ('00000000-0000-0000-0000-00000000D541', '00000000-0000-0000-0000-00000000D501',
     'STUDY', 'GRANTED', true, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-01 10:00:00+05:30'),
    ('00000000-0000-0000-0000-00000000D547', '00000000-0000-0000-0000-00000000D501',
     'SOCIAL', 'GRANTED', true, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-04 10:00:00+05:30'),
    ('00000000-0000-0000-0000-00000000D542', '00000000-0000-0000-0000-00000000D501',
     'SOCIAL', 'REVOKED', false, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-05 10:00:00+05:30'),
    ('00000000-0000-0000-0000-00000000D543', '00000000-0000-0000-0000-00000000D502',
     'STUDY', 'GRANTED', true, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-02 11:00:00+05:30'),
    ('00000000-0000-0000-0000-00000000D544', '00000000-0000-0000-0000-00000000D502',
     'SOCIAL', 'GRANTED', true, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-02 11:05:00+05:30'),
    ('00000000-0000-0000-0000-00000000D545', '00000000-0000-0000-0000-00000000D503',
     'STUDY', 'GRANTED', true, 'db05-synthetic-v1', 'DB-05 development seed',
     timestamptz '2026-10-03 12:00:00+05:30'),
    ('00000000-0000-0000-0000-00000000D546', '00000000-0000-0000-0000-00000000D503',
     'SOCIAL', 'UPDATED', false, 'db05-synthetic-v1',
     'DB-05 development seed: initial consent-state capture',
     timestamptz '2026-10-03 12:05:00+05:30')
ON CONFLICT (consent_event_id) DO NOTHING;

INSERT INTO campus_duo.discovery_action (
    action_id, actor_user_id, target_user_id, mode, action_type, policy_version
)
VALUES
    ('00000000-0000-0000-0000-00000000D551',
     '00000000-0000-0000-0000-00000000D501',
     '00000000-0000-0000-0000-00000000D502',
     'STUDY', 'LIKE', 'db05-synthetic-v1'),
    ('00000000-0000-0000-0000-00000000D552',
     '00000000-0000-0000-0000-00000000D502',
     '00000000-0000-0000-0000-00000000D501',
     'STUDY', 'LIKE', 'db05-synthetic-v1')
ON CONFLICT (action_id) DO NOTHING;

INSERT INTO campus_duo.connection (
    connection_id, user_a_id, user_b_id, mode, status, note
)
VALUES (
    '00000000-0000-0000-0000-00000000D561',
    '00000000-0000-0000-0000-00000000D501',
    '00000000-0000-0000-0000-00000000D502',
    'STUDY', 'MUTUAL_CONNECTED', '[SYNTHETIC DEV SEED] Reciprocal study match'
)
ON CONFLICT (connection_id) DO NOTHING;

INSERT INTO campus_duo.study_location (
    location_id, name, building, open_time, close_time,
    has_power_outlets, has_wifi6, noise_policy
)
VALUES (
    '00000000-0000-0000-0000-00000000D571',
    '[SYNTHETIC DEV SEED] Campus Duo Test Library',
    '[SYNTHETIC] DEV-BUILDING', '08:00', '20:00',
    true, true, 'WHISPER_COLLAB'
)
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO campus_duo.study_table (table_id, location_id, table_number)
VALUES
    ('00000000-0000-0000-0000-00000000D572',
     '00000000-0000-0000-0000-00000000D571', 'DB05-A'),
    ('00000000-0000-0000-0000-00000000D573',
     '00000000-0000-0000-0000-00000000D571', 'DB05-B')
ON CONFLICT (table_id) DO NOTHING;

INSERT INTO campus_duo.study_slot (
    slot_id, table_id, location_id, local_date, start_time, end_time, zone
)
SELECT seed_slot.slot_id, seed_slot.table_id, seed_slot.location_id,
       seed_slot.local_date, seed_slot.start_time, seed_slot.end_time, seed_slot.zone
  FROM (
    SELECT
        '00000000-0000-0000-0000-00000000D574'::uuid AS slot_id,
        '00000000-0000-0000-0000-00000000D572'::uuid AS table_id,
        '00000000-0000-0000-0000-00000000D571'::uuid AS location_id,
        coalesce(
            (SELECT local_date FROM campus_duo.study_slot
              WHERE slot_id = '00000000-0000-0000-0000-00000000D574'),
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 30
        ) AS local_date,
        time '10:00' AS start_time, time '12:00' AS end_time,
        'COLLABORATIVE_STUDY'::text AS zone
    UNION ALL
    SELECT
        '00000000-0000-0000-0000-00000000D575'::uuid,
        '00000000-0000-0000-0000-00000000D572'::uuid,
        '00000000-0000-0000-0000-00000000D571'::uuid,
        coalesce(
            (SELECT local_date FROM campus_duo.study_slot
              WHERE slot_id = '00000000-0000-0000-0000-00000000D575'),
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 30
        ),
        time '12:00', time '14:00', 'COLLABORATIVE_STUDY'
    UNION ALL
    SELECT
        '00000000-0000-0000-0000-00000000D576'::uuid,
        '00000000-0000-0000-0000-00000000D573'::uuid,
        '00000000-0000-0000-0000-00000000D571'::uuid,
        coalesce(
            (SELECT local_date FROM campus_duo.study_slot
              WHERE slot_id = '00000000-0000-0000-0000-00000000D576'),
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 30
        ),
        time '14:00', time '16:00', 'SILENT_READING'
  ) AS seed_slot
ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
)
SELECT
    '00000000-0000-0000-0000-00000000D581',
    '00000000-0000-0000-0000-00000000D561',
    '00000000-0000-0000-0000-00000000D501',
    '00000000-0000-0000-0000-00000000D572',
    '00000000-0000-0000-0000-00000000D571',
    '00000000-0000-0000-0000-00000000D574',
    local_date
  FROM campus_duo.study_slot
 WHERE slot_id = '00000000-0000-0000-0000-00000000D574'
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
VALUES
    ('00000000-0000-0000-0000-00000000D581',
     '00000000-0000-0000-0000-00000000D501', 'CREATOR'),
    ('00000000-0000-0000-0000-00000000D581',
     '00000000-0000-0000-0000-00000000D502', 'COMPANION')
ON CONFLICT (booking_id, user_id) DO NOTHING;

INSERT INTO campus_duo.booking (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id,
    local_date, status, cancelled_at, cancelled_by, cancellation_reason
)
SELECT
    '00000000-0000-0000-0000-00000000D582',
    '00000000-0000-0000-0000-00000000D561',
    '00000000-0000-0000-0000-00000000D501',
    '00000000-0000-0000-0000-00000000D572',
    '00000000-0000-0000-0000-00000000D571',
    '00000000-0000-0000-0000-00000000D575',
    local_date, 'CANCELLED', now(),
    '00000000-0000-0000-0000-00000000D501',
    '[SYNTHETIC DEV SEED] Historical cancellation'
  FROM campus_duo.study_slot
 WHERE slot_id = '00000000-0000-0000-0000-00000000D575'
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role)
VALUES
    ('00000000-0000-0000-0000-00000000D582',
     '00000000-0000-0000-0000-00000000D501', 'CREATOR'),
    ('00000000-0000-0000-0000-00000000D582',
     '00000000-0000-0000-0000-00000000D502', 'COMPANION')
ON CONFLICT (booking_id, user_id) DO NOTHING;

INSERT INTO campus_duo.idempotency_record (
    idempotency_id, actor_user_id, operation_type, client_operation_id,
    request_fingerprint, outcome_status, booking_id
)
VALUES
    ('00000000-0000-0000-0000-00000000D591',
     '00000000-0000-0000-0000-00000000D501',
     'CREATE_BOOKING', 'db05-dev-create-confirmed',
     'db05-dev-fingerprint-confirmed', 'SUCCEEDED',
     '00000000-0000-0000-0000-00000000D581'),
    ('00000000-0000-0000-0000-00000000D592',
     '00000000-0000-0000-0000-00000000D501',
     'CANCEL_BOOKING', 'db05-dev-cancel-history',
     'db05-dev-fingerprint-cancelled', 'SUCCEEDED',
     '00000000-0000-0000-0000-00000000D582')
ON CONFLICT (idempotency_id) DO NOTHING;

INSERT INTO campus_duo.notification (
    notification_id, recipient_user_id, event_type, mode, title, body, dedupe_key
)
VALUES (
    '00000000-0000-0000-0000-00000000D5A1',
    '00000000-0000-0000-0000-00000000D501',
    'BOOKING_CREATED', 'BOOKING',
    '[SYNTHETIC DEV SEED] Study booking confirmed',
    '[SYNTHETIC DEV SEED] This notification is development-only.',
    'db05-dev-booking-confirmed'
)
ON CONFLICT (notification_id) DO NOTHING;

\ir 00_manifest_assertions.sql

COMMIT;
\echo 'DB-05 development seed committed: synthetic records only; no outbox work was seeded.'
