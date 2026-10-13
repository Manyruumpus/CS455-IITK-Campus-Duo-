SET LOCAL search_path = campus_duo, public;

DO $$
BEGIN
    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'V008 must run as campus_duo_migrator, not %. ', current_user;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_namespace
         WHERE nspname = 'campus_duo'
           AND nspowner = 'campus_duo_migrator'::regrole
    ) THEN
        RAISE EXCEPTION 'V008 prerequisite failed: campus_duo must be migrator-owned.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campus_duo_app')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campus_duo_admin_service')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campus_duo_worker') THEN
        RAISE EXCEPTION 'V008 prerequisite failed: all runtime roles must exist before grants.';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA campus_duo
    TO campus_duo_app, campus_duo_admin_service, campus_duo_worker;

GRANT SELECT (
    user_id, email, roll_number, display_name, department, degree, year,
    role, verification_status, onboarding_status, account_status
) ON campus_duo.user_account TO campus_duo_app;
GRANT UPDATE (
    email, roll_number, department, degree, year, display_name,
    onboarding_status, account_status, updated_at
) ON campus_duo.user_account TO campus_duo_app;

GRANT SELECT (
    user_id, social_bio, study_goals, preferred_location, study_style,
    preferred_pace, profile_version, created_at, updated_at
) ON campus_duo.student_profile TO campus_duo_app;
GRANT INSERT (
    user_id, social_bio, study_goals, preferred_location, study_style,
    preferred_pace
) ON campus_duo.student_profile TO campus_duo_app;
GRANT UPDATE (
    social_bio, study_goals, preferred_location, study_style,
    preferred_pace, profile_version, updated_at
) ON campus_duo.student_profile TO campus_duo_app;

GRANT SELECT (user_id, time_code, created_at)
    ON campus_duo.profile_preferred_time TO campus_duo_app;
GRANT INSERT (user_id, time_code)
    ON campus_duo.profile_preferred_time TO campus_duo_app;
GRANT DELETE ON campus_duo.profile_preferred_time TO campus_duo_app;

GRANT SELECT (course_id, code, name, department, active)
    ON campus_duo.course TO campus_duo_app;
GRANT SELECT (user_id, course_id, enrolled_at, enrollment_status)
    ON campus_duo.profile_course TO campus_duo_app;
GRANT INSERT (user_id, course_id, enrolled_at, enrollment_status)
    ON campus_duo.profile_course TO campus_duo_app;
GRANT UPDATE (enrolled_at, enrollment_status)
    ON campus_duo.profile_course TO campus_duo_app;
GRANT DELETE ON campus_duo.profile_course TO campus_duo_app;

GRANT SELECT (interest_id, name, category, description, active)
    ON campus_duo.social_interest TO campus_duo_app;
GRANT SELECT (user_id, interest_id, selected_at)
    ON campus_duo.profile_interest TO campus_duo_app;
GRANT INSERT (user_id, interest_id, selected_at)
    ON campus_duo.profile_interest TO campus_duo_app;
GRANT UPDATE (selected_at)
    ON campus_duo.profile_interest TO campus_duo_app;
GRANT DELETE ON campus_duo.profile_interest TO campus_duo_app;

GRANT SELECT (
    consent_id, user_id, mode, has_consent, consented_at, revoked_at,
    policy_version, updated_at
) ON campus_duo.consent_record TO campus_duo_app;
GRANT INSERT (
    user_id, mode, has_consent, consented_at, revoked_at, policy_version
) ON campus_duo.consent_record TO campus_duo_app;
GRANT UPDATE (
    has_consent, consented_at, revoked_at, policy_version, updated_at
) ON campus_duo.consent_record TO campus_duo_app;
GRANT SELECT (
    consent_event_id, user_id, mode, event_type, has_consent,
    policy_version, source, occurred_at
) ON campus_duo.consent_history TO campus_duo_app;
GRANT INSERT (
    user_id, mode, event_type, has_consent, policy_version, source, occurred_at
) ON campus_duo.consent_history TO campus_duo_app;

GRANT SELECT (
    action_id, actor_user_id, target_user_id, mode, action_type,
    discovery_round_id, policy_version, created_at, updated_at
) ON campus_duo.discovery_action TO campus_duo_app;
GRANT INSERT (
    actor_user_id, target_user_id, mode, action_type,
    discovery_round_id, policy_version
) ON campus_duo.discovery_action TO campus_duo_app;
GRANT UPDATE (action_type, policy_version, updated_at)
    ON campus_duo.discovery_action TO campus_duo_app;

GRANT SELECT (
    connection_id, user_a_id, user_b_id, mode, status, note,
    restricted_reason, created_at, updated_at
) ON campus_duo.connection TO campus_duo_app;
GRANT INSERT (
    user_a_id, user_b_id, mode, status, note, restricted_reason
) ON campus_duo.connection TO campus_duo_app;
GRANT UPDATE (status, note, restricted_reason, updated_at)
    ON campus_duo.connection TO campus_duo_app;

GRANT SELECT (
    block_id, actor_user_id, target_user_id, active, created_at,
    revoked_at, policy_version
) ON campus_duo.block TO campus_duo_app;
GRANT INSERT (actor_user_id, target_user_id, policy_version)
    ON campus_duo.block TO campus_duo_app;
GRANT UPDATE (active, revoked_at, policy_version)
    ON campus_duo.block TO campus_duo_app;

GRANT SELECT (
    location_id, name, building, open_time, close_time, has_power_outlets,
    has_wifi6, noise_policy, active
) ON campus_duo.study_location TO campus_duo_app;
GRANT SELECT (
    table_id, location_id, table_number, capacity, active
) ON campus_duo.study_table TO campus_duo_app;
GRANT SELECT (
    slot_id, table_id, location_id, local_date, start_time, end_time,
    zone, status, active
) ON campus_duo.study_slot TO campus_duo_app;

GRANT SELECT (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id,
    local_date, status, partner_approval_status, booking_version,
    created_at, updated_at, cancelled_at, cancelled_by, cancellation_reason,
    completed_at, rescheduled_from_booking_id
) ON campus_duo.booking TO campus_duo_app;
GRANT UPDATE (
    status, booking_version, updated_at, cancelled_at, cancelled_by,
    cancellation_reason, completed_at
) ON campus_duo.booking TO campus_duo_app;
GRANT INSERT (
    connection_id, booker_id, table_id, location_id, slot_id, local_date,
    status, partner_approval_status, booking_version, rescheduled_from_booking_id
) ON campus_duo.booking TO campus_duo_app;
GRANT SELECT (
    booking_id, user_id, participant_role, joined_at, removed_at
) ON campus_duo.booking_participant TO campus_duo_app;
GRANT INSERT (booking_id, user_id, participant_role, joined_at)
    ON campus_duo.booking_participant TO campus_duo_app;
GRANT UPDATE (removed_at) ON campus_duo.booking_participant TO campus_duo_app;
GRANT SELECT (
    idempotency_id, actor_user_id, operation_type, client_operation_id,
    request_fingerprint, outcome_status, booking_id, response_reference,
    created_at, expires_at
) ON campus_duo.idempotency_record TO campus_duo_app;
GRANT INSERT (
    actor_user_id, operation_type, client_operation_id, request_fingerprint,
    outcome_status, booking_id, response_reference, expires_at
) ON campus_duo.idempotency_record TO campus_duo_app;

GRANT SELECT (
    notification_id, recipient_user_id, event_type, mode, title, body,
    destination_type, destination_id, is_read, read_at, dedupe_key, created_at
) ON campus_duo.notification TO campus_duo_app;
GRANT INSERT (
    recipient_user_id, event_type, mode, title, body, destination_type,
    destination_id, dedupe_key
) ON campus_duo.notification TO campus_duo_app;
GRANT UPDATE (is_read, read_at) ON campus_duo.notification TO campus_duo_app;

GRANT SELECT (report_id, reporter_user_id, reported_user_id, status, created_at)
    ON campus_duo.moderation_report TO campus_duo_app;
GRANT INSERT (
    reporter_user_id, reported_user_id, category, description, evidence_reference
) ON campus_duo.moderation_report TO campus_duo_app;

GRANT INSERT (
    actor_user_id, actor_role, action, target_type, target_id, outcome,
    correlation_id, operation_id, safe_reason, occurred_at, retention_class
) ON campus_duo.audit_event TO campus_duo_app;

GRANT INSERT (
    event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id
) ON campus_duo.outbox_event TO campus_duo_app;

GRANT SELECT (
    user_id, display_name, role, account_status
) ON campus_duo.user_account TO campus_duo_admin_service;
GRANT SELECT (
    report_id, reporter_user_id, reported_user_id, category, description,
    evidence_reference, status, reviewed_by, reviewed_at, review_reason,
    audit_event_id, created_at, updated_at
) ON campus_duo.moderation_report TO campus_duo_admin_service;
GRANT UPDATE (
    status, reviewed_by, reviewed_at, review_reason, audit_event_id, updated_at
) ON campus_duo.moderation_report TO campus_duo_admin_service;
GRANT SELECT (
    location_id, name, building, active
) ON campus_duo.study_location TO campus_duo_admin_service;
GRANT UPDATE (
    name, building, open_time, close_time, has_power_outlets,
    has_wifi6, noise_policy, active, updated_at
) ON campus_duo.study_location TO campus_duo_admin_service;
GRANT SELECT (table_id, location_id, table_number, capacity, active)
    ON campus_duo.study_table TO campus_duo_admin_service;
GRANT UPDATE (table_number, capacity, active, updated_at)
    ON campus_duo.study_table TO campus_duo_admin_service;
GRANT SELECT (
    slot_id, table_id, location_id, local_date, start_time, end_time,
    zone, status, active
) ON campus_duo.study_slot TO campus_duo_admin_service;
GRANT UPDATE (start_time, end_time, zone, status, active, updated_at)
    ON campus_duo.study_slot TO campus_duo_admin_service;
GRANT SELECT (
    booking_id, connection_id, booker_id, table_id, location_id, slot_id,
    local_date, status, booking_version, cancelled_at, cancelled_by,
    cancellation_reason, completed_at, rescheduled_from_booking_id
) ON campus_duo.booking TO campus_duo_admin_service;
GRANT UPDATE (
    status, booking_version, updated_at, cancelled_at, cancelled_by,
    cancellation_reason, completed_at
) ON campus_duo.booking TO campus_duo_admin_service;
GRANT SELECT (
    audit_event_id, actor_user_id, actor_role, action, target_type, target_id,
    outcome, correlation_id, operation_id, safe_reason, occurred_at, retention_class
) ON campus_duo.audit_event TO campus_duo_admin_service;
GRANT INSERT (
    actor_user_id, actor_role, action, target_type, target_id, outcome,
    correlation_id, operation_id, safe_reason, occurred_at, retention_class
) ON campus_duo.audit_event TO campus_duo_admin_service;
GRANT INSERT (
    recipient_user_id, event_type, mode, title, body, destination_type,
    destination_id, dedupe_key
) ON campus_duo.notification TO campus_duo_admin_service;
GRANT INSERT (
    event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id
) ON campus_duo.outbox_event TO campus_duo_admin_service;

GRANT SELECT (
    outbox_event_id, event_type, aggregate_type, aggregate_id, dedupe_key,
    payload, status, attempts, next_attempt_at, created_at, dispatched_at,
    correlation_id
) ON campus_duo.outbox_event TO campus_duo_worker;
GRANT UPDATE (
    status, attempts, next_attempt_at, dispatched_at
) ON campus_duo.outbox_event TO campus_duo_worker;
