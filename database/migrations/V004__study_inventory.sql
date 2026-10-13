SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.study_location (
    location_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    name text NOT NULL,
    building text NOT NULL,
    open_time time NOT NULL,
    close_time time NOT NULL,
    has_power_outlets boolean NOT NULL DEFAULT false,
    has_wifi6 boolean NOT NULL DEFAULT false,
    noise_policy text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT study_location_name_not_blank_ck CHECK (length(btrim(name)) > 0),
    CONSTRAINT study_location_building_not_blank_ck CHECK (length(btrim(building)) > 0),
    CONSTRAINT study_location_hours_ck CHECK (open_time < close_time),
    CONSTRAINT study_location_noise_policy_ck CHECK (
        noise_policy IN ('ABSOLUTE_SILENCE', 'WHISPER_COLLAB', 'CONVERSATIONAL')
    ),
    CONSTRAINT study_location_id_location_uk UNIQUE (location_id)
);

CREATE INDEX study_location_active_building_ix
    ON campus_duo.study_location (active, building);

CREATE TABLE campus_duo.study_table (
    table_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    location_id uuid NOT NULL,
    table_number text NOT NULL,
    capacity smallint NOT NULL DEFAULT 2,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT study_table_location_fk
        FOREIGN KEY (location_id) REFERENCES campus_duo.study_location (location_id)
        ON DELETE RESTRICT,
    CONSTRAINT study_table_capacity_ck CHECK (capacity = 2),
    CONSTRAINT study_table_number_not_blank_ck CHECK (length(btrim(table_number)) > 0),
    CONSTRAINT study_table_location_number_uk UNIQUE (location_id, table_number),
    CONSTRAINT study_table_id_location_uk UNIQUE (table_id, location_id)
);

CREATE INDEX study_table_location_active_ix
    ON campus_duo.study_table (location_id, active);

CREATE TABLE campus_duo.study_slot (
    slot_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    table_id uuid NOT NULL,
    location_id uuid NOT NULL,
    local_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    zone text NOT NULL,
    status text NOT NULL DEFAULT 'AVAILABLE',
    active boolean NOT NULL DEFAULT true,
    slot_range tsrange GENERATED ALWAYS AS (
        tsrange(
            (local_date + start_time)::timestamp,
            (local_date + end_time)::timestamp,
            '[)'
        )
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT study_slot_table_location_fk
        FOREIGN KEY (table_id, location_id)
        REFERENCES campus_duo.study_table (table_id, location_id)
        ON DELETE RESTRICT,
    CONSTRAINT study_slot_location_fk
        FOREIGN KEY (location_id) REFERENCES campus_duo.study_location (location_id)
        ON DELETE RESTRICT,
    CONSTRAINT study_slot_time_ck CHECK (start_time < end_time),
    CONSTRAINT study_slot_zone_ck CHECK (
        zone IN ('SILENT_READING', 'COLLABORATIVE_STUDY', 'DISCUSSION_POD', 'LAB_TERMINAL')
    ),
    CONSTRAINT study_slot_status_ck CHECK (
        status IN ('AVAILABLE', 'LOCKED_MAINTENANCE')
    ),
    CONSTRAINT study_slot_identity_uk
        UNIQUE (slot_id, table_id, location_id, local_date),
    CONSTRAINT study_slot_table_date_times_uk
        UNIQUE (table_id, local_date, start_time, end_time),
    CONSTRAINT study_slot_no_overlap_excl
        EXCLUDE USING gist (
            table_id WITH =,
            slot_range WITH &&
        )
        WHERE (active)
);

CREATE INDEX study_slot_table_date_start_ix
    ON campus_duo.study_slot (table_id, local_date, start_time);

CREATE INDEX study_slot_location_date_status_ix
    ON campus_duo.study_slot (location_id, local_date, status);

COMMENT ON COLUMN campus_duo.study_slot.local_date IS
    'Campus local calendar date in Asia/Kolkata; not a UTC-derived browser date.';
COMMENT ON COLUMN campus_duo.study_slot.slot_range IS
    'Half-open [start,end) range; adjacent slots are allowed. Requires btree_gist.';
COMMENT ON COLUMN campus_duo.study_slot.status IS
    'Administrative availability only. Booking occupancy is derived from booking.status; frontend RESERVED/OCCUPIED values are adapter projections.';

COMMENT ON CONSTRAINT study_slot_no_overlap_excl ON campus_duo.study_slot IS
    'Uses the public btree_gist operator classes resolved by V004 search_path: campus_duo, public.';
