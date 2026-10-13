SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.audit_event (
    audit_event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_user_id uuid,
    actor_role text,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    outcome text NOT NULL,
    correlation_id text,
    operation_id text,
    safe_reason text,
    details jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    retention_class text,
    CONSTRAINT audit_event_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT audit_event_actor_role_ck CHECK (
        actor_role IS NULL OR actor_role IN ('ROLE_STUDENT', 'ROLE_ADMIN', 'SYSTEM')
    ),
    CONSTRAINT audit_event_outcome_ck CHECK (outcome IN ('SUCCESS', 'REJECTED')),
    CONSTRAINT audit_event_action_not_blank_ck CHECK (length(btrim(action)) > 0),
    CONSTRAINT audit_event_target_not_blank_ck CHECK (length(btrim(target_type)) > 0),
    CONSTRAINT audit_event_safe_reason_not_blank_ck CHECK (
        safe_reason IS NULL OR length(btrim(safe_reason)) > 0
    )
);

CREATE INDEX audit_event_target_time_ix
    ON campus_duo.audit_event (target_type, target_id, occurred_at);

CREATE INDEX audit_event_correlation_ix
    ON campus_duo.audit_event (correlation_id);

CREATE INDEX audit_event_actor_time_ix
    ON campus_duo.audit_event (actor_user_id, occurred_at);

CREATE TABLE campus_duo.moderation_report (
    report_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    reporter_user_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    category text NOT NULL,
    description text,
    evidence_reference text,
    status text NOT NULL DEFAULT 'PENDING_REVIEW',
    reviewed_by uuid,
    reviewed_at timestamptz,
    review_reason text,
    audit_event_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT moderation_report_reporter_fk
        FOREIGN KEY (reporter_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT moderation_report_reported_fk
        FOREIGN KEY (reported_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT moderation_report_reviewer_fk
        FOREIGN KEY (reviewed_by) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT moderation_report_audit_fk
        FOREIGN KEY (audit_event_id) REFERENCES campus_duo.audit_event (audit_event_id)
        ON DELETE RESTRICT,
    CONSTRAINT moderation_report_not_self_ck CHECK (reporter_user_id <> reported_user_id),
    CONSTRAINT moderation_report_category_ck CHECK (
        category IN (
            'HARASSMENT', 'UNAUTHORIZED_PROMOTION', 'ACADEMIC_DISHONESTY',
            'IMPERSONATION', 'OTHER'
        )
    ),
    CONSTRAINT moderation_report_status_ck CHECK (
        status IN ('PENDING_REVIEW', 'WARNED', 'SUSPENDED', 'DISMISSED')
    ),
    CONSTRAINT moderation_report_review_fields_ck CHECK (
        (status = 'PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR         (
            status <> 'PENDING_REVIEW'
            AND reviewed_by IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND review_reason IS NOT NULL
            AND length(btrim(review_reason)) > 0
        )
    )
);

CREATE INDEX moderation_report_status_time_ix
    ON campus_duo.moderation_report (status, created_at);

CREATE INDEX moderation_report_reporter_time_ix
    ON campus_duo.moderation_report (reporter_user_id, created_at);

CREATE INDEX moderation_report_reported_time_ix
    ON campus_duo.moderation_report (reported_user_id, created_at);

CREATE TABLE campus_duo.notification (
    notification_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    recipient_user_id uuid NOT NULL,
    event_type text NOT NULL,
    mode text,
    title text NOT NULL,
    body text NOT NULL,
    destination_type text,
    destination_id uuid,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    dedupe_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_recipient_fk
        FOREIGN KEY (recipient_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT notification_event_type_not_blank_ck CHECK (length(btrim(event_type)) > 0),
    CONSTRAINT notification_title_not_blank_ck CHECK (length(btrim(title)) > 0),
    CONSTRAINT notification_body_not_blank_ck CHECK (length(btrim(body)) > 0),
    CONSTRAINT notification_mode_ck CHECK (
        mode IS NULL OR mode IN ('STUDY', 'SOCIAL', 'BOOKING', 'MODERATION', 'SYSTEM')
    ),
    CONSTRAINT notification_read_fields_ck CHECK (
        (is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)
    ),
    CONSTRAINT notification_destination_type_ck CHECK (
        destination_type IS NULL OR destination_type IN ('BOOKING', 'CONNECTION', 'REPORT', 'SETTINGS')
    ),
    CONSTRAINT notification_dedupe_key_not_blank_ck CHECK (
        dedupe_key IS NULL OR length(btrim(dedupe_key)) > 0
    )
);

CREATE UNIQUE INDEX notification_recipient_dedupe_uk
    ON campus_duo.notification (recipient_user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX notification_recipient_read_time_ix
    ON campus_duo.notification (recipient_user_id, is_read, created_at DESC);
