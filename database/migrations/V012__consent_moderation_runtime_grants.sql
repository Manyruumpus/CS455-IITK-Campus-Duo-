SET LOCAL search_path = campus_duo, public;

-- Runtime application grants required by the authenticated consent,
-- moderation, and administrator read paths. This migration is additive and
-- does not alter data or weaken production authentication.
GRANT SELECT (
    user_id, email, display_name, role, account_status,
    verification_status, onboarding_status
) ON campus_duo.user_account TO campus_duo_app;
GRANT UPDATE (account_status) ON campus_duo.user_account TO campus_duo_app;

GRANT SELECT (
    report_id, reporter_user_id, reported_user_id, category, description,
    evidence_reference, status, reviewed_by, reviewed_at, review_reason,
    audit_event_id, created_at, updated_at
) ON campus_duo.moderation_report TO campus_duo_app;
GRANT UPDATE (
    status, reviewed_by, reviewed_at, review_reason, audit_event_id, updated_at
) ON campus_duo.moderation_report TO campus_duo_app;

GRANT SELECT (
    audit_event_id, actor_user_id, actor_role, action, target_type, target_id,
    outcome, correlation_id, operation_id, safe_reason, details, occurred_at,
    retention_class
) ON campus_duo.audit_event TO campus_duo_app;
