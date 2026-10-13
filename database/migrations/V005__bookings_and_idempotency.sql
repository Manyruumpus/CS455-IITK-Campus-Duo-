SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.booking (
    booking_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    connection_id uuid NOT NULL,
    booker_id uuid NOT NULL,
    table_id uuid NOT NULL,
    location_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    local_date date NOT NULL,
    status text NOT NULL DEFAULT 'CONFIRMED',
    partner_approval_status text NOT NULL DEFAULT 'NOT_REQUIRED',
    booking_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    cancelled_by uuid,
    cancellation_reason text,
    completed_at timestamptz,
    rescheduled_from_booking_id uuid,
    CONSTRAINT booking_connection_fk
        FOREIGN KEY (connection_id) REFERENCES campus_duo.connection (connection_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_booker_fk
        FOREIGN KEY (booker_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_table_fk
        FOREIGN KEY (table_id) REFERENCES campus_duo.study_table (table_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_location_fk
        FOREIGN KEY (location_id) REFERENCES campus_duo.study_location (location_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_slot_resource_fk
        FOREIGN KEY (slot_id, table_id, location_id, local_date)
        REFERENCES campus_duo.study_slot (slot_id, table_id, location_id, local_date)
        ON DELETE RESTRICT,
    CONSTRAINT booking_cancelled_by_fk
        FOREIGN KEY (cancelled_by) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_rescheduled_from_fk
        FOREIGN KEY (rescheduled_from_booking_id)
        REFERENCES campus_duo.booking (booking_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_status_ck CHECK (
        status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT booking_approval_status_ck CHECK (
        partner_approval_status = 'NOT_REQUIRED'
    ),
    CONSTRAINT booking_version_ck CHECK (booking_version > 0),
    CONSTRAINT booking_self_lineage_ck CHECK (
        rescheduled_from_booking_id IS NULL OR rescheduled_from_booking_id <> booking_id
    ),
    CONSTRAINT booking_cancel_fields_ck CHECK (
        (status = 'CANCELLED'
            AND cancelled_at IS NOT NULL
            AND cancelled_by IS NOT NULL
            AND cancellation_reason IS NOT NULL
            AND length(btrim(cancellation_reason)) > 0)
        OR (status <> 'CANCELLED'
            AND cancelled_at IS NULL
            AND cancelled_by IS NULL
            AND cancellation_reason IS NULL)
    ),
    CONSTRAINT booking_completed_fields_ck CHECK (
        (status = 'COMPLETED' AND completed_at IS NOT NULL)
        OR (status <> 'COMPLETED' AND completed_at IS NULL)
    )
);

CREATE UNIQUE INDEX booking_confirmed_resource_uk
    ON campus_duo.booking (table_id, local_date, slot_id)
    WHERE status = 'CONFIRMED';

CREATE UNIQUE INDEX booking_direct_successor_uk
    ON campus_duo.booking (rescheduled_from_booking_id)
    WHERE rescheduled_from_booking_id IS NOT NULL;

CREATE INDEX booking_booker_status_date_ix
    ON campus_duo.booking (booker_id, status, local_date);

CREATE INDEX booking_connection_status_ix
    ON campus_duo.booking (connection_id, status);

CREATE INDEX booking_resource_ix
    ON campus_duo.booking (table_id, local_date, slot_id);

CREATE TABLE campus_duo.booking_participant (
    booking_id uuid NOT NULL,
    user_id uuid NOT NULL,
    participant_role text NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz,
    PRIMARY KEY (booking_id, user_id),
    CONSTRAINT booking_participant_booking_fk
        FOREIGN KEY (booking_id) REFERENCES campus_duo.booking (booking_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_participant_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT booking_participant_role_ck CHECK (
        participant_role IN ('CREATOR', 'COMPANION')
    ),
    CONSTRAINT booking_participant_timestamps_ck CHECK (
        removed_at IS NULL OR removed_at >= joined_at
    )
);

CREATE UNIQUE INDEX booking_creator_once_uk
    ON campus_duo.booking_participant (booking_id)
    WHERE participant_role = 'CREATOR' AND removed_at IS NULL;

CREATE INDEX booking_participant_user_ix
    ON campus_duo.booking_participant (user_id, booking_id);

CREATE TABLE campus_duo.idempotency_record (
    idempotency_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_user_id uuid NOT NULL,
    operation_type text NOT NULL,
    client_operation_id text NOT NULL,
    request_fingerprint text NOT NULL,
    outcome_status text NOT NULL,
    booking_id uuid,
    response_reference jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    CONSTRAINT idempotency_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT idempotency_booking_fk
        FOREIGN KEY (booking_id) REFERENCES campus_duo.booking (booking_id)
        ON DELETE RESTRICT,
    CONSTRAINT idempotency_operation_ck CHECK (
        operation_type IN ('CREATE_BOOKING', 'RESCHEDULE_BOOKING', 'CANCEL_BOOKING')
    ),
    CONSTRAINT idempotency_outcome_ck CHECK (
        outcome_status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CONFLICT')
    ),
    CONSTRAINT idempotency_operation_id_not_blank_ck CHECK (
        length(btrim(client_operation_id)) > 0
    ),
    CONSTRAINT idempotency_fingerprint_not_blank_ck CHECK (
        length(btrim(request_fingerprint)) > 0
    ),
    CONSTRAINT idempotency_actor_operation_key_uk
        UNIQUE (actor_user_id, operation_type, client_operation_id)
);

CREATE INDEX idempotency_actor_status_created_ix
    ON campus_duo.idempotency_record (actor_user_id, outcome_status, created_at);
