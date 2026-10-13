SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.consent_record (
    consent_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL,
    mode text NOT NULL,
    has_consent boolean NOT NULL DEFAULT false,
    consented_at timestamptz,
    revoked_at timestamptz,
    policy_version text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT consent_record_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT consent_record_mode_ck CHECK (mode IN ('STUDY', 'SOCIAL')),
    CONSTRAINT consent_record_timestamps_ck CHECK (
        (has_consent AND consented_at IS NOT NULL AND revoked_at IS NULL)
        OR (
            NOT has_consent
            AND (
                (consented_at IS NULL AND revoked_at IS NULL)
                OR (consented_at IS NOT NULL AND revoked_at IS NOT NULL)
            )
        )
    ),
    CONSTRAINT consent_record_user_mode_uk UNIQUE (user_id, mode)
);

CREATE INDEX consent_record_eligibility_ix
    ON campus_duo.consent_record (mode, has_consent, user_id);

CREATE TABLE campus_duo.consent_history (
    consent_event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL,
    mode text NOT NULL,
    event_type text NOT NULL,
    has_consent boolean NOT NULL,
    policy_version text,
    source text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT consent_history_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT consent_history_mode_ck CHECK (mode IN ('STUDY', 'SOCIAL')),
    CONSTRAINT consent_history_event_ck CHECK (event_type IN ('GRANTED', 'REVOKED', 'UPDATED'))
);

CREATE INDEX consent_history_user_mode_time_ix
    ON campus_duo.consent_history (user_id, mode, occurred_at DESC);

CREATE TABLE campus_duo.discovery_action (
    action_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    mode text NOT NULL,
    action_type text NOT NULL,
    discovery_round_id uuid,
    policy_version text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT discovery_action_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT discovery_action_target_fk
        FOREIGN KEY (target_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT discovery_action_not_self_ck CHECK (actor_user_id <> target_user_id),
    CONSTRAINT discovery_action_mode_ck CHECK (mode IN ('STUDY', 'SOCIAL')),
    CONSTRAINT discovery_action_type_ck CHECK (action_type IN ('LIKE', 'PASS', 'HIDE')),
    CONSTRAINT discovery_action_actor_target_mode_uk
        UNIQUE (actor_user_id, target_user_id, mode)
);

CREATE INDEX discovery_action_actor_mode_type_ix
    ON campus_duo.discovery_action (actor_user_id, mode, action_type);

CREATE INDEX discovery_action_target_mode_ix
    ON campus_duo.discovery_action (target_user_id, mode);

CREATE TABLE campus_duo.connection (
    connection_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_a_id uuid NOT NULL,
    user_b_id uuid NOT NULL,
    mode text NOT NULL,
    status text NOT NULL DEFAULT 'MUTUAL_CONNECTED',
    note text,
    restricted_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT connection_user_a_fk
        FOREIGN KEY (user_a_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT connection_user_b_fk
        FOREIGN KEY (user_b_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT connection_users_order_ck CHECK (user_a_id < user_b_id),
    CONSTRAINT connection_mode_ck CHECK (mode IN ('STUDY', 'SOCIAL')),
    CONSTRAINT connection_status_ck CHECK (
        status IN ('MUTUAL_CONNECTED', 'DISCONNECTED')
    ),
    CONSTRAINT connection_pair_mode_uk UNIQUE (user_a_id, user_b_id, mode)
);

CREATE INDEX connection_user_a_mode_status_ix
    ON campus_duo.connection (user_a_id, mode, status);

CREATE INDEX connection_user_b_mode_status_ix
    ON campus_duo.connection (user_b_id, mode, status);

CREATE TABLE campus_duo.block (
    block_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    policy_version text,
    CONSTRAINT block_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT block_target_fk
        FOREIGN KEY (target_user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT block_not_self_ck CHECK (actor_user_id <> target_user_id),
    CONSTRAINT block_active_timestamp_ck CHECK (
        (active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX block_active_pair_uk
    ON campus_duo.block (actor_user_id, target_user_id)
    WHERE active;

CREATE INDEX block_target_active_ix
    ON campus_duo.block (target_user_id, active);
