\set ON_ERROR_STOP on

\echo 'DB-05 exact manifest assertions: checking preserved synthetic records.'

DO $$
DECLARE
    r record;
    actual_count integer;
BEGIN
    -- Timestamps, created_at/updated_at values, notification created_at, and
    -- first-run slot local_date values are intentionally not asserted.
    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D501'::uuid, 'db05-dev-alex', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Alex', 'CSE', 'B.Tech', 4::smallint),
            ('00000000-0000-0000-0000-00000000D502'::uuid, 'db05-dev-sam', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Sam', 'CSE', 'B.Tech', 4::smallint),
            ('00000000-0000-0000-0000-00000000D503'::uuid, 'db05-dev-jordan', 'ROLE_STUDENT', 'VERIFIED', 'COMPLETED', 'ACTIVE', 'Dev Student Jordan', 'EE', 'B.Tech', 3::smallint)
        ) AS v(user_id, identity_subject, role, verification_status, onboarding_status, account_status, display_name, department, degree, year)
    LOOP
        SELECT count(*) INTO actual_count FROM campus_duo.user_account WHERE user_id = r.user_id;
        IF actual_count <> 1 OR EXISTS (
            SELECT 1 FROM campus_duo.user_account u
             WHERE u.user_id = r.user_id
               AND (u.identity_subject, u.role, u.verification_status, u.onboarding_status,
                    u.account_status, u.display_name, u.department, u.degree, u.year)
                   IS DISTINCT FROM (r.identity_subject, r.role, r.verification_status, r.onboarding_status,
                    r.account_status, r.display_name, r.department, r.degree, r.year)
        ) THEN
            RAISE EXCEPTION 'DB-05 user manifest mismatch for %.', r.user_id;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM campus_duo.user_account WHERE identity_subject LIKE 'db05-dev-%') <> 3 THEN
        RAISE EXCEPTION 'DB-05 synthetic identity manifest count mismatch.';
    END IF;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D501'::uuid, '[SYNTHETIC DEV SEED] Systems practice and collaborative study.', '[SYNTHETIC DEV SEED] Prepare for networking assessments.', 'QUIET_FOCUSED', 'STANDARD_REGULAR'),
            ('00000000-0000-0000-0000-00000000D502'::uuid, '[SYNTHETIC DEV SEED] Structured study and peer review.', '[SYNTHETIC DEV SEED] Review distributed systems concepts.', 'QUIET_FOCUSED', 'AHEAD_OF_CLASS'),
            ('00000000-0000-0000-0000-00000000D503'::uuid, '[SYNTHETIC DEV SEED] Problem-solving practice.', '[SYNTHETIC DEV SEED] Work through foundational mathematics.', 'PROBLEM_SOLVING', 'STANDARD_REGULAR')
        ) AS v(user_id, social_bio, study_goals, study_style, preferred_pace)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.student_profile p
             WHERE p.user_id = r.user_id
               AND (p.social_bio, p.study_goals, p.study_style, p.preferred_pace)
                   IS NOT DISTINCT FROM (r.social_bio, r.study_goals, r.study_style, r.preferred_pace)
        ) THEN
            RAISE EXCEPTION 'DB-05 profile manifest mismatch for %.', r.user_id;
        END IF;
    END LOOP;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D511'::uuid, 'DB05-CS455', '[SYNTHETIC DEV SEED] Database Systems', 'CSE', '[SYNTHETIC]'),
            ('00000000-0000-0000-0000-00000000D512'::uuid, 'DB05-MTH101', '[SYNTHETIC DEV SEED] Applied Mathematics', 'MTH', '[SYNTHETIC]')
        ) AS v(course_id, code, name, department, instructor)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.course c
             WHERE c.course_id = r.course_id
               AND (c.code, c.name, c.department, c.instructor, c.active)
                   IS NOT DISTINCT FROM (r.code, r.name, r.department, r.instructor, true)
        ) THEN
            RAISE EXCEPTION 'DB-05 course manifest mismatch for %.', r.course_id;
        END IF;
    END LOOP;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D521'::uuid, '[SYNTHETIC DEV SEED] Robotics', 'TECH_ACADEMIC', '[SYNTHETIC DEV SEED] Fictional catalog interest.'),
            ('00000000-0000-0000-0000-00000000D522'::uuid, '[SYNTHETIC DEV SEED] Chess', 'SPORTS_FITNESS', '[SYNTHETIC DEV SEED] Fictional catalog interest.')
        ) AS v(interest_id, name, category, description)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.social_interest i
             WHERE i.interest_id = r.interest_id
               AND (i.name, i.category, i.description, i.active)
                   IS NOT DISTINCT FROM (r.name, r.category, r.description, true)
        ) THEN
            RAISE EXCEPTION 'DB-05 interest manifest mismatch for %.', r.interest_id;
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM campus_duo.profile_course WHERE user_id IN ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid)) <> 3
       OR EXISTS (
           SELECT 1 FROM campus_duo.profile_course pc
           WHERE pc.user_id IN ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid)
             AND (pc.user_id, pc.course_id, pc.enrollment_status) NOT IN (
               ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D511'::uuid, 'ACTIVE'),
               ('00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D511'::uuid, 'ACTIVE'),
               ('00000000-0000-0000-0000-00000000D503'::uuid, '00000000-0000-0000-0000-00000000D512'::uuid, 'ACTIVE')
           )
       ) THEN
       RAISE EXCEPTION 'DB-05 profile_course manifest mismatch.';
    END IF;
    IF (SELECT count(*) FROM campus_duo.profile_interest WHERE user_id IN ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid)) <> 3
       OR EXISTS (
          SELECT 1 FROM campus_duo.profile_interest pi
           WHERE pi.user_id IN ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid)
             AND (pi.user_id, pi.interest_id) NOT IN (
               ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D521'::uuid),
               ('00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D521'::uuid),
               ('00000000-0000-0000-0000-00000000D503'::uuid, '00000000-0000-0000-0000-00000000D522'::uuid)
           )
       ) THEN
        RAISE EXCEPTION 'DB-05 profile_interest manifest mismatch.';
    END IF;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D531'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, 'STUDY', true, timestamptz '2026-10-01 10:00:00+05:30', NULL::timestamptz),
            ('00000000-0000-0000-0000-00000000D532'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, 'SOCIAL', false, timestamptz '2026-10-04 10:00:00+05:30', timestamptz '2026-10-05 10:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D533'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'STUDY', true, timestamptz '2026-10-02 11:00:00+05:30', NULL::timestamptz),
            ('00000000-0000-0000-0000-00000000D534'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'SOCIAL', true, timestamptz '2026-10-02 11:05:00+05:30', NULL::timestamptz),
            ('00000000-0000-0000-0000-00000000D535'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid, 'STUDY', true, timestamptz '2026-10-03 12:00:00+05:30', NULL::timestamptz),
            ('00000000-0000-0000-0000-00000000D536'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid, 'SOCIAL', false, NULL::timestamptz, NULL::timestamptz)
        ) AS v(consent_id, user_id, mode, has_consent, consented_at, revoked_at)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.consent_record c
             WHERE c.consent_id = r.consent_id
               AND (c.user_id, c.mode, c.has_consent, c.consented_at, c.revoked_at, c.policy_version)
                   IS NOT DISTINCT FROM (r.user_id, r.mode, r.has_consent, r.consented_at, r.revoked_at, 'db05-synthetic-v1')
        ) THEN
            RAISE EXCEPTION 'DB-05 consent manifest mismatch for %.', r.consent_id;
        END IF;
    END LOOP;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D541'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, 'STUDY', 'GRANTED', true, timestamptz '2026-10-01 10:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D547'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, 'SOCIAL', 'GRANTED', true, timestamptz '2026-10-04 10:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D542'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, 'SOCIAL', 'REVOKED', false, timestamptz '2026-10-05 10:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D543'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'STUDY', 'GRANTED', true, timestamptz '2026-10-02 11:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D544'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'SOCIAL', 'GRANTED', true, timestamptz '2026-10-02 11:05:00+05:30'),
            ('00000000-0000-0000-0000-00000000D545'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid, 'STUDY', 'GRANTED', true, timestamptz '2026-10-03 12:00:00+05:30'),
            ('00000000-0000-0000-0000-00000000D546'::uuid, '00000000-0000-0000-0000-00000000D503'::uuid, 'SOCIAL', 'UPDATED', false, timestamptz '2026-10-03 12:05:00+05:30')
        ) AS v(consent_event_id, user_id, mode, event_type, has_consent, occurred_at)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.consent_history h
             WHERE h.consent_event_id = r.consent_event_id
               AND (h.user_id, h.mode, h.event_type, h.has_consent, h.occurred_at, h.policy_version, h.source)
                   IS NOT DISTINCT FROM (
                       r.user_id, r.mode, r.event_type, r.has_consent, r.occurred_at,
                       'db05-synthetic-v1',
                       CASE WHEN r.consent_event_id = '00000000-0000-0000-0000-00000000D546'::uuid
                            THEN 'DB-05 development seed: initial consent-state capture'
                            ELSE 'DB-05 development seed'
                       END
                   )
        ) THEN
            RAISE EXCEPTION 'DB-05 consent history manifest mismatch for %.', r.consent_event_id;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM campus_duo.consent_history WHERE consent_event_id IN (
        '00000000-0000-0000-0000-00000000D541'::uuid, '00000000-0000-0000-0000-00000000D542'::uuid,
        '00000000-0000-0000-0000-00000000D543'::uuid, '00000000-0000-0000-0000-00000000D544'::uuid,
        '00000000-0000-0000-0000-00000000D545'::uuid, '00000000-0000-0000-0000-00000000D546'::uuid,
        '00000000-0000-0000-0000-00000000D547'::uuid)) <> 7 THEN
        RAISE EXCEPTION 'DB-05 consent history count mismatch.';
    END IF;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D551'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid),
            ('00000000-0000-0000-0000-00000000D552'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid)
        ) AS v(action_id, actor_user_id, target_user_id)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.discovery_action a
             WHERE a.action_id = r.action_id
               AND (a.actor_user_id, a.target_user_id, a.mode, a.action_type, a.policy_version)
                   IS NOT DISTINCT FROM (r.actor_user_id, r.target_user_id, 'STUDY', 'LIKE', 'db05-synthetic-v1')
        ) THEN
            RAISE EXCEPTION 'DB-05 discovery action manifest mismatch for %.', r.action_id;
        END IF;
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.connection c
         WHERE c.connection_id = '00000000-0000-0000-0000-00000000D561'
           AND (c.user_a_id, c.user_b_id, c.mode, c.status, c.note) IS NOT DISTINCT FROM
               ('00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'STUDY', 'MUTUAL_CONNECTED', '[SYNTHETIC DEV SEED] Reciprocal study match')
    ) THEN
        RAISE EXCEPTION 'DB-05 connection manifest mismatch.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.study_location l
         WHERE l.location_id = '00000000-0000-0000-0000-00000000D571'
           AND (l.name, l.building, l.open_time, l.close_time, l.has_power_outlets, l.has_wifi6, l.noise_policy, l.active)
               IS NOT DISTINCT FROM ('[SYNTHETIC DEV SEED] Campus Duo Test Library', '[SYNTHETIC] DEV-BUILDING', time '08:00', time '20:00', true, true, 'WHISPER_COLLAB', true)
    ) OR (SELECT count(*) FROM campus_duo.study_table WHERE table_id IN ('00000000-0000-0000-0000-00000000D572'::uuid, '00000000-0000-0000-0000-00000000D573'::uuid)) <> 2
       OR EXISTS (
           SELECT 1 FROM campus_duo.study_table t
            WHERE t.table_id IN ('00000000-0000-0000-0000-00000000D572'::uuid, '00000000-0000-0000-0000-00000000D573'::uuid)
              AND (t.location_id, t.table_number, t.capacity, t.active) IS DISTINCT FROM
                  ('00000000-0000-0000-0000-00000000D571'::uuid, CASE t.table_id WHEN '00000000-0000-0000-0000-00000000D572'::uuid THEN 'DB05-A' ELSE 'DB05-B' END, 2::smallint, true)
       ) THEN
        RAISE EXCEPTION 'DB-05 location/table manifest mismatch.';
    END IF;

    IF (SELECT count(*) FROM campus_duo.study_slot WHERE slot_id IN (
        '00000000-0000-0000-0000-00000000D574'::uuid, '00000000-0000-0000-0000-00000000D575'::uuid, '00000000-0000-0000-0000-00000000D576'::uuid)) <> 3
       OR EXISTS (
           SELECT 1 FROM campus_duo.study_slot s
            WHERE s.slot_id IN ('00000000-0000-0000-0000-00000000D574'::uuid, '00000000-0000-0000-0000-00000000D575'::uuid, '00000000-0000-0000-0000-00000000D576'::uuid)
              AND (s.table_id, s.location_id, s.start_time, s.end_time, s.zone, s.status, s.active) IS DISTINCT FROM
                  (CASE s.slot_id WHEN '00000000-0000-0000-0000-00000000D576'::uuid THEN '00000000-0000-0000-0000-00000000D573'::uuid ELSE '00000000-0000-0000-0000-00000000D572'::uuid END,
                   '00000000-0000-0000-0000-00000000D571'::uuid,
                   CASE s.slot_id WHEN '00000000-0000-0000-0000-00000000D574'::uuid THEN time '10:00' WHEN '00000000-0000-0000-0000-00000000D575'::uuid THEN time '12:00' ELSE time '14:00' END,
                   CASE s.slot_id WHEN '00000000-0000-0000-0000-00000000D574'::uuid THEN time '12:00' WHEN '00000000-0000-0000-0000-00000000D575'::uuid THEN time '14:00' ELSE time '16:00' END,
                   CASE s.slot_id WHEN '00000000-0000-0000-0000-00000000D576'::uuid THEN 'SILENT_READING' ELSE 'COLLABORATIVE_STUDY' END,
                   'AVAILABLE', true)
       ) THEN
        RAISE EXCEPTION 'DB-05 slot manifest mismatch.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM campus_duo.study_slot a JOIN campus_duo.study_slot b
          ON b.table_id = a.table_id AND b.slot_id <> a.slot_id AND a.active AND b.active
         AND b.slot_range && a.slot_range
         WHERE a.slot_id IN ('00000000-0000-0000-0000-00000000D574'::uuid, '00000000-0000-0000-0000-00000000D575'::uuid, '00000000-0000-0000-0000-00000000D576'::uuid)
    ) THEN
        RAISE EXCEPTION 'DB-05 active seed slots overlap.';
    END IF;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D581'::uuid, 'CONFIRMED', '00000000-0000-0000-0000-00000000D574'::uuid, NULL::text),
            ('00000000-0000-0000-0000-00000000D582'::uuid, 'CANCELLED', '00000000-0000-0000-0000-00000000D575'::uuid, '[SYNTHETIC DEV SEED] Historical cancellation')
        ) AS v(booking_id, status, slot_id, cancellation_reason)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.booking b
             WHERE b.booking_id = r.booking_id
               AND (b.connection_id, b.booker_id, b.table_id, b.location_id, b.slot_id, b.status, b.cancellation_reason)
                   IS NOT DISTINCT FROM ('00000000-0000-0000-0000-00000000D561'::uuid, '00000000-0000-0000-0000-00000000D501'::uuid, '00000000-0000-0000-0000-00000000D572'::uuid, '00000000-0000-0000-0000-00000000D571'::uuid, r.slot_id, r.status, r.cancellation_reason)
        ) THEN
            RAISE EXCEPTION 'DB-05 booking manifest mismatch for %.', r.booking_id;
        END IF;
        IF (SELECT count(*) FROM campus_duo.booking_participant p WHERE p.booking_id = r.booking_id) <> 2
           OR EXISTS (
               SELECT 1 FROM campus_duo.booking_participant p
                WHERE p.booking_id = r.booking_id
                  AND (p.user_id, p.participant_role, p.removed_at) IS DISTINCT FROM
                      (CASE WHEN p.participant_role = 'CREATOR' THEN '00000000-0000-0000-0000-00000000D501'::uuid ELSE '00000000-0000-0000-0000-00000000D502'::uuid END, p.participant_role, NULL::timestamptz)
           )
        THEN
            RAISE EXCEPTION 'DB-05 participant manifest mismatch for %.', r.booking_id;
        END IF;
    END LOOP;

    FOR r IN
        SELECT * FROM (VALUES
            ('00000000-0000-0000-0000-00000000D591'::uuid, 'CREATE_BOOKING', 'db05-dev-create-confirmed', 'db05-dev-fingerprint-confirmed', 'SUCCEEDED', '00000000-0000-0000-0000-00000000D581'::uuid),
            ('00000000-0000-0000-0000-00000000D592'::uuid, 'CANCEL_BOOKING', 'db05-dev-cancel-history', 'db05-dev-fingerprint-cancelled', 'SUCCEEDED', '00000000-0000-0000-0000-00000000D582'::uuid)
        ) AS v(idempotency_id, operation_type, client_operation_id, request_fingerprint, outcome_status, booking_id)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM campus_duo.idempotency_record i
             WHERE i.idempotency_id = r.idempotency_id
               AND (i.actor_user_id, i.operation_type, i.client_operation_id, i.request_fingerprint, i.outcome_status, i.booking_id)
                   IS NOT DISTINCT FROM ('00000000-0000-0000-0000-00000000D501'::uuid, r.operation_type, r.client_operation_id, r.request_fingerprint, r.outcome_status, r.booking_id)
        ) THEN
            RAISE EXCEPTION 'DB-05 idempotency manifest mismatch for %.', r.idempotency_id;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.notification n
         WHERE n.notification_id = '00000000-0000-0000-0000-00000000D5A1'
           AND (n.recipient_user_id, n.event_type, n.mode, n.title, n.body, n.dedupe_key)
               IS NOT DISTINCT FROM ('00000000-0000-0000-0000-00000000D501'::uuid, 'BOOKING_CREATED', 'BOOKING', '[SYNTHETIC DEV SEED] Study booking confirmed', '[SYNTHETIC DEV SEED] This notification is development-only.', 'db05-dev-booking-confirmed')
    ) THEN
        RAISE EXCEPTION 'DB-05 notification manifest mismatch.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM campus_duo.outbox_event
         WHERE status IN ('PENDING', 'FAILED', 'DEAD_LETTER')
           AND (
               dedupe_key LIKE 'db05-%' OR correlation_id LIKE 'db05-%'
               OR aggregate_id IN (
                   '00000000-0000-0000-0000-00000000D561'::uuid,
                   '00000000-0000-0000-0000-00000000D581'::uuid,
                   '00000000-0000-0000-0000-00000000D582'::uuid
               )
           )
    ) THEN
        RAISE EXCEPTION 'DB-05 manifest found dispatchable outbox work for seed fixtures.';
    END IF;
END
$$;
