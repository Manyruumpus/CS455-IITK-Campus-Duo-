SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.outbox_event (
    outbox_event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    dedupe_key text,
    payload jsonb,
    status text NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    dispatched_at timestamptz,
    correlation_id text,
    CONSTRAINT outbox_event_type_not_blank_ck CHECK (length(btrim(event_type)) > 0),
    CONSTRAINT outbox_event_aggregate_type_not_blank_ck CHECK (length(btrim(aggregate_type)) > 0),
    CONSTRAINT outbox_event_dedupe_key_not_blank_ck CHECK (
        dedupe_key IS NULL OR length(btrim(dedupe_key)) > 0
    ),
    CONSTRAINT outbox_event_correlation_id_not_blank_ck CHECK (
        correlation_id IS NULL OR length(btrim(correlation_id)) > 0
    ),
    CONSTRAINT outbox_event_status_ck CHECK (
        status IN ('PENDING', 'DISPATCHED', 'FAILED', 'DEAD_LETTER')
    ),
    CONSTRAINT outbox_event_attempts_ck CHECK (attempts >= 0),
    CONSTRAINT outbox_event_dispatched_fields_ck CHECK (
        (status = 'DISPATCHED' AND dispatched_at IS NOT NULL)
        OR (status <> 'DISPATCHED' AND dispatched_at IS NULL)
    )
);

CREATE UNIQUE INDEX outbox_event_dedupe_uk
    ON campus_duo.outbox_event (dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX outbox_event_dispatch_poll_ix
    ON campus_duo.outbox_event (status, next_attempt_at, created_at);

COMMENT ON TABLE campus_duo.outbox_event IS
    'Written in the same transaction as approved business changes; dispatch occurs after commit.';
