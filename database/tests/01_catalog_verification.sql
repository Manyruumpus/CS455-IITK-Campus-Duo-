\set ON_ERROR_STOP on

\echo 'DB-04C catalog verification: read-only catalog, definition, and privilege checks are running.'

BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = campus_duo, public;

DO $$
DECLARE
    expected_table_name text;
    expected_owner oid := 'campus_duo_migrator'::regrole;
    actual_table_owner oid;
    business_table_names text[] := ARRAY[
        'user_account', 'student_profile', 'profile_preferred_time', 'course',
        'profile_course', 'social_interest', 'profile_interest', 'consent_record',
        'consent_history', 'discovery_action', 'connection', 'block',
        'study_location', 'study_table', 'study_slot', 'booking',
        'booking_participant', 'idempotency_record', 'audit_event',
        'moderation_report', 'notification', 'outbox_event'
    ];
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_namespace namespace_catalog
         WHERE namespace_catalog.nspname = 'campus_duo'
           AND namespace_catalog.nspowner = expected_owner
    ) THEN
        RAISE EXCEPTION 'Catalog verification failed: campus_duo owner is not campus_duo_migrator.';
    END IF;

    FOREACH expected_table_name IN ARRAY business_table_names || ARRAY['flyway_schema_history']
    LOOP
        SELECT relation_catalog.relowner
          INTO actual_table_owner
          FROM pg_class relation_catalog
          JOIN pg_namespace namespace_catalog
            ON namespace_catalog.oid = relation_catalog.relnamespace
         WHERE namespace_catalog.nspname = 'campus_duo'
           AND relation_catalog.relname = expected_table_name
           AND relation_catalog.relkind = 'r';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Catalog verification failed: campus_duo.% is not an ordinary table.',
                expected_table_name;
        END IF;
        IF actual_table_owner IS DISTINCT FROM expected_owner THEN
            RAISE EXCEPTION
                'Catalog verification failed: campus_duo.% owner is incorrect.',
                expected_table_name;
        END IF;
    END LOOP;
END
$$;

DO $$
DECLARE
    expected_column record;
    actual_column record;
    normalized_default text;
    normalized_expression text;
BEGIN
    FOR expected_column IN
        SELECT *
          FROM (VALUES
            ('user_account', 'user_id', 'uuid', true, 'uuid_default'),
            ('user_account', 'identity_subject', 'text', true, 'none'),
            ('user_account', 'role', 'text', true, 'role_student'),
            ('study_slot', 'slot_id', 'uuid', true, 'uuid_default'),
            ('study_slot', 'table_id', 'uuid', true, 'none'),
            ('study_slot', 'location_id', 'uuid', true, 'none'),
            ('study_slot', 'local_date', 'date', true, 'none'),
            ('study_slot', 'start_time', 'time without time zone', true, 'none'),
            ('study_slot', 'end_time', 'time without time zone', true, 'none'),
            ('study_slot', 'status', 'text', true, 'available'),
            ('booking', 'booking_id', 'uuid', true, 'uuid_default'),
            ('booking', 'connection_id', 'uuid', true, 'none'),
            ('booking', 'booker_id', 'uuid', true, 'none'),
            ('booking', 'table_id', 'uuid', true, 'none'),
            ('booking', 'location_id', 'uuid', true, 'none'),
            ('booking', 'slot_id', 'uuid', true, 'none'),
            ('booking', 'local_date', 'date', true, 'none'),
            ('booking', 'status', 'text', true, 'confirmed'),
            ('idempotency_record', 'actor_user_id', 'uuid', true, 'none'),
            ('idempotency_record', 'operation_type', 'text', true, 'none'),
            ('idempotency_record', 'client_operation_id', 'text', true, 'none'),
            ('idempotency_record', 'request_fingerprint', 'text', true, 'none'),
            ('idempotency_record', 'outcome_status', 'text', true, 'none'),
            ('outbox_event', 'event_type', 'text', true, 'none'),
            ('outbox_event', 'aggregate_type', 'text', true, 'none'),
            ('outbox_event', 'aggregate_id', 'uuid', true, 'none'),
            ('outbox_event', 'status', 'text', true, 'pending'),
            ('outbox_event', 'attempts', 'integer', true, 'zero')
          ) AS expected(
              table_name, column_name, data_type, required, default_kind
          )
    LOOP
        SELECT
            format_type(attribute_catalog.atttypid, attribute_catalog.atttypmod) AS data_type,
            attribute_catalog.attnotnull,
            pg_get_expr(default_catalog.adbin, default_catalog.adrelid) AS column_default
          INTO actual_column
          FROM pg_attribute attribute_catalog
          JOIN pg_class relation_catalog
            ON relation_catalog.oid = attribute_catalog.attrelid
          JOIN pg_namespace namespace_catalog
            ON namespace_catalog.oid = relation_catalog.relnamespace
          LEFT JOIN pg_attrdef default_catalog
            ON default_catalog.adrelid = attribute_catalog.attrelid
           AND default_catalog.adnum = attribute_catalog.attnum
         WHERE namespace_catalog.nspname = 'campus_duo'
           AND relation_catalog.relname = expected_column.table_name
           AND relation_catalog.relkind = 'r'
           AND attribute_catalog.attname = expected_column.column_name
           AND attribute_catalog.attnum > 0
           AND NOT attribute_catalog.attisdropped;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Catalog verification failed: missing %.%.',
                expected_column.table_name, expected_column.column_name;
        END IF;

        IF actual_column.data_type IS DISTINCT FROM expected_column.data_type
           OR actual_column.attnotnull IS DISTINCT FROM expected_column.required THEN
            RAISE EXCEPTION
                'Catalog verification failed: type/nullability of %.%.',
                expected_column.table_name, expected_column.column_name;
        END IF;

        normalized_default := lower(
            regexp_replace(coalesce(actual_column.column_default, ''), '\s+', '', 'g')
        );
        IF expected_column.default_kind = 'none'
           AND actual_column.column_default IS NOT NULL THEN
            RAISE EXCEPTION
                'Catalog verification failed: %.% unexpectedly has a default.',
                expected_column.table_name, expected_column.column_name;
        ELSIF expected_column.default_kind = 'uuid_default'
              AND normalized_default NOT IN ('gen_random_uuid()', 'pg_catalog.gen_random_uuid()') THEN
            RAISE EXCEPTION
                'Catalog verification failed: %.% does not use native gen_random_uuid().',
                expected_column.table_name, expected_column.column_name;
        ELSIF expected_column.default_kind = 'role_student'
              AND normalized_default IS DISTINCT FROM '''role_student''::text' THEN
            RAISE EXCEPTION 'Catalog verification failed: user_account.role default.';
        ELSIF expected_column.default_kind = 'available'
              AND normalized_default IS DISTINCT FROM '''available''::text' THEN
            RAISE EXCEPTION 'Catalog verification failed: study_slot.status default.';
        ELSIF expected_column.default_kind = 'confirmed'
              AND normalized_default IS DISTINCT FROM '''confirmed''::text' THEN
            RAISE EXCEPTION 'Catalog verification failed: booking.status default.';
        ELSIF expected_column.default_kind = 'pending'
              AND normalized_default IS DISTINCT FROM '''pending''::text' THEN
            RAISE EXCEPTION 'Catalog verification failed: outbox_event.status default.';
        ELSIF expected_column.default_kind = 'zero'
              AND normalized_default IS DISTINCT FROM '0' THEN
            RAISE EXCEPTION 'Catalog verification failed: outbox_event.attempts default.';
        END IF;
    END LOOP;

    SELECT
        format_type(attribute_catalog.atttypid, attribute_catalog.atttypmod) AS data_type,
        attribute_catalog.attgenerated,
        pg_get_expr(default_catalog.adbin, default_catalog.adrelid) AS generated_expression
      INTO actual_column
      FROM pg_attribute attribute_catalog
      JOIN pg_class relation_catalog
        ON relation_catalog.oid = attribute_catalog.attrelid
      JOIN pg_namespace namespace_catalog
        ON namespace_catalog.oid = relation_catalog.relnamespace
      LEFT JOIN pg_attrdef default_catalog
        ON default_catalog.adrelid = attribute_catalog.attrelid
       AND default_catalog.adnum = attribute_catalog.attnum
     WHERE namespace_catalog.nspname = 'campus_duo'
       AND relation_catalog.relname = 'study_slot'
       AND relation_catalog.relkind = 'r'
       AND attribute_catalog.attname = 'slot_range'
       AND attribute_catalog.attnum > 0
       AND NOT attribute_catalog.attisdropped;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: study_slot.slot_range is absent.';
    END IF;

    normalized_expression := lower(
        regexp_replace(coalesce(actual_column.generated_expression, ''), '\s+', '', 'g')
    );
    normalized_expression := replace(normalized_expression, '::timestampwithouttimezone', '');
    normalized_expression := replace(normalized_expression, '::text', '');
    IF actual_column.data_type IS DISTINCT FROM 'tsrange'
       OR actual_column.attgenerated IS DISTINCT FROM 's'
       OR normalized_expression NOT LIKE 'tsrange(%'
       OR normalized_expression NOT LIKE '%local_date+start_time%'
       OR normalized_expression NOT LIKE '%local_date+end_time%'
       OR normalized_expression NOT LIKE '%''[)''%' THEN
        RAISE EXCEPTION
            'Catalog verification failed: study_slot.slot_range generated definition.';
    END IF;
END
$$;

DO $$
DECLARE
    resource_fk record;
    exclusion_constraint record;
    exclusion_index record;
    expected_source_columns text[] := ARRAY['slot_id', 'table_id', 'location_id', 'local_date'];
    expected_target_columns text[] := ARRAY['slot_id', 'table_id', 'location_id', 'local_date'];
    actual_source_columns text[];
    actual_target_columns text[];
    actual_exclusion_columns text[];
    actual_exclusion_operators oid[];
    uuid_equal_operator oid;
    tsrange_overlap_operator oid;
    uuid_equal_operator_count integer;
    tsrange_overlap_operator_count integer;
    exclusion_predicate text;
BEGIN
    SELECT constraint_catalog.*
      INTO resource_fk
      FROM pg_constraint constraint_catalog
     WHERE constraint_catalog.conname = 'booking_slot_resource_fk'
       AND constraint_catalog.conrelid = 'campus_duo.booking'::regclass
       AND constraint_catalog.contype = 'f';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: booking_slot_resource_fk is absent.';
    END IF;

    actual_source_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(resource_fk.conkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = resource_fk.conrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    actual_target_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(resource_fk.confkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = resource_fk.confrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    IF resource_fk.confrelid IS DISTINCT FROM 'campus_duo.study_slot'::regclass
       OR resource_fk.confdeltype IS DISTINCT FROM 'r'
       OR actual_source_columns IS DISTINCT FROM expected_source_columns
       OR actual_target_columns IS DISTINCT FROM expected_target_columns THEN
        RAISE EXCEPTION 'Catalog verification failed: complete booking resource FK definition.';
    END IF;

    SELECT constraint_catalog.*
      INTO exclusion_constraint
      FROM pg_constraint constraint_catalog
     WHERE constraint_catalog.conname = 'study_slot_no_overlap_excl'
       AND constraint_catalog.conrelid = 'campus_duo.study_slot'::regclass
       AND constraint_catalog.contype = 'x';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: study_slot_no_overlap_excl is absent.';
    END IF;

    SELECT count(*), min(operator_catalog.oid)
      INTO uuid_equal_operator_count, uuid_equal_operator
      FROM pg_operator operator_catalog
      JOIN pg_namespace operator_namespace
        ON operator_namespace.oid = operator_catalog.oprnamespace
     WHERE operator_namespace.nspname = 'pg_catalog'
       AND operator_catalog.oprname = '='
       AND operator_catalog.oprleft = 'uuid'::regtype
       AND operator_catalog.oprright = 'uuid'::regtype;
    IF uuid_equal_operator_count <> 1 THEN
        RAISE EXCEPTION
            'Catalog verification failed: expected one pg_catalog UUID equality operator, found %.',
            uuid_equal_operator_count;
    END IF;

    SELECT count(*), min(operator_catalog.oid)
      INTO tsrange_overlap_operator_count, tsrange_overlap_operator
      FROM pg_operator operator_catalog
      JOIN pg_namespace operator_namespace
        ON operator_namespace.oid = operator_catalog.oprnamespace
     WHERE operator_namespace.nspname = 'pg_catalog'
       AND operator_catalog.oprname = '&&'
       AND operator_catalog.oprleft = 'anyrange'::regtype
       AND operator_catalog.oprright = 'anyrange'::regtype;
    IF tsrange_overlap_operator_count <> 1 THEN
        RAISE EXCEPTION
            'Catalog verification failed: expected one pg_catalog anyrange overlap operator, found %.',
            tsrange_overlap_operator_count;
    END IF;

    actual_exclusion_operators := ARRAY(
        SELECT operator_oid
          FROM unnest(exclusion_constraint.conexclop) WITH ORDINALITY
               AS exclusion_operators(operator_oid, ordinal)
         ORDER BY ordinal
    );
    actual_exclusion_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(exclusion_constraint.conkey) WITH ORDINALITY
               AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = exclusion_constraint.conrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    IF actual_exclusion_operators IS DISTINCT FROM
           ARRAY[uuid_equal_operator, tsrange_overlap_operator]
       OR actual_exclusion_columns IS DISTINCT FROM ARRAY['table_id', 'slot_range'] THEN
        RAISE EXCEPTION 'Catalog verification failed: exclusion operators or columns.';
    END IF;

    SELECT index_catalog.*, access_method.amname
      INTO exclusion_index
      FROM pg_index index_catalog
      JOIN pg_class index_relation
        ON index_relation.oid = index_catalog.indexrelid
      JOIN pg_am access_method
        ON access_method.oid = index_relation.relam
     WHERE index_catalog.indexrelid = exclusion_constraint.conindid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: exclusion supporting index is absent.';
    END IF;

    exclusion_predicate := lower(
        regexp_replace(coalesce(pg_get_expr(exclusion_index.indpred, exclusion_index.indrelid), ''),
                       '\s+', '', 'g')
    );
    exclusion_predicate := regexp_replace(exclusion_predicate, '^\((.*)\)$', '\1');
    IF exclusion_index.indrelid IS DISTINCT FROM 'campus_duo.study_slot'::regclass
       OR exclusion_index.amname IS DISTINCT FROM 'gist'
       OR exclusion_index.indisvalid IS DISTINCT FROM true
       OR exclusion_index.indisready IS DISTINCT FROM true
       OR exclusion_predicate IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'Catalog verification failed: exclusion supporting index definition.';
    END IF;
END
$$;

DO $$
DECLARE
    booking_index record;
    index_columns text[];
    index_predicate text;
    idempotency_constraint record;
    idempotency_columns text[];
    outbox_dedupe_index record;
    outbox_poll_index record;
BEGIN
    SELECT index_catalog.*
      INTO booking_index
      FROM pg_index index_catalog
      JOIN pg_class index_relation
        ON index_relation.oid = index_catalog.indexrelid
      JOIN pg_namespace namespace_catalog
        ON namespace_catalog.oid = index_relation.relnamespace
     WHERE namespace_catalog.nspname = 'campus_duo'
       AND index_relation.relname = 'booking_confirmed_resource_uk'
       AND index_relation.relkind = 'i';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: confirmed-resource index is absent.';
    END IF;
    index_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(booking_index.indkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = booking_index.indrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    index_predicate := lower(
        regexp_replace(coalesce(pg_get_expr(booking_index.indpred, booking_index.indrelid), ''),
                       '\s+', '', 'g')
    );
    index_predicate := regexp_replace(index_predicate, '^\((.*)\)$', '\1');
    IF booking_index.indrelid IS DISTINCT FROM 'campus_duo.booking'::regclass
       OR booking_index.indisunique IS DISTINCT FROM true
       OR booking_index.indisvalid IS DISTINCT FROM true
       OR index_columns IS DISTINCT FROM ARRAY['table_id', 'local_date', 'slot_id']
       OR index_predicate IS DISTINCT FROM 'status=''confirmed''::text' THEN
        RAISE EXCEPTION 'Catalog verification failed: confirmed-resource index definition.';
    END IF;

    SELECT index_catalog.*
      INTO booking_index
      FROM pg_index index_catalog
      JOIN pg_class index_relation
        ON index_relation.oid = index_catalog.indexrelid
      JOIN pg_namespace namespace_catalog
        ON namespace_catalog.oid = index_relation.relnamespace
     WHERE namespace_catalog.nspname = 'campus_duo'
       AND index_relation.relname = 'booking_direct_successor_uk'
       AND index_relation.relkind = 'i';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: direct-successor index is absent.';
    END IF;
    index_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(booking_index.indkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = booking_index.indrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    index_predicate := lower(
        regexp_replace(coalesce(pg_get_expr(booking_index.indpred, booking_index.indrelid), ''),
                       '\s+', '', 'g')
    );
    index_predicate := regexp_replace(index_predicate, '^\((.*)\)$', '\1');
    IF booking_index.indrelid IS DISTINCT FROM 'campus_duo.booking'::regclass
       OR booking_index.indisunique IS DISTINCT FROM true
       OR booking_index.indisvalid IS DISTINCT FROM true
       OR index_columns IS DISTINCT FROM ARRAY['rescheduled_from_booking_id']
       OR index_predicate IS DISTINCT FROM 'rescheduled_from_booking_idisnotnull' THEN
        RAISE EXCEPTION 'Catalog verification failed: direct-successor index definition.';
    END IF;

    SELECT constraint_catalog.*
      INTO idempotency_constraint
      FROM pg_constraint constraint_catalog
     WHERE constraint_catalog.conname = 'idempotency_actor_operation_key_uk'
       AND constraint_catalog.conrelid = 'campus_duo.idempotency_record'::regclass
       AND constraint_catalog.contype = 'u';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: idempotency uniqueness is absent.';
    END IF;
    idempotency_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(idempotency_constraint.conkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = idempotency_constraint.conrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    IF idempotency_columns IS DISTINCT FROM
           ARRAY['actor_user_id', 'operation_type', 'client_operation_id'] THEN
        RAISE EXCEPTION 'Catalog verification failed: actor-scoped idempotency key columns.';
    END IF;

    IF (SELECT count(*)
          FROM pg_constraint constraint_catalog
         WHERE constraint_catalog.conrelid = 'campus_duo.outbox_event'::regclass
           AND constraint_catalog.conname IN (
               'outbox_event_status_ck', 'outbox_event_attempts_ck',
               'outbox_event_dispatched_fields_ck'
           )
           AND constraint_catalog.contype = 'c') <> 3 THEN
        RAISE EXCEPTION 'Catalog verification failed: outbox checks.';
    END IF;

    SELECT index_catalog.*
      INTO outbox_dedupe_index
      FROM pg_index index_catalog
      JOIN pg_class index_relation
        ON index_relation.oid = index_catalog.indexrelid
     WHERE index_relation.oid = 'campus_duo.outbox_event_dedupe_uk'::regclass;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: outbox dedupe index is absent.';
    END IF;
    index_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(outbox_dedupe_index.indkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = outbox_dedupe_index.indrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    index_predicate := lower(
        regexp_replace(coalesce(pg_get_expr(outbox_dedupe_index.indpred,
                                             outbox_dedupe_index.indrelid), ''),
                       '\s+', '', 'g')
    );
    index_predicate := regexp_replace(index_predicate, '^\((.*)\)$', '\1');
    IF outbox_dedupe_index.indrelid IS DISTINCT FROM 'campus_duo.outbox_event'::regclass
       OR outbox_dedupe_index.indisunique IS DISTINCT FROM true
       OR outbox_dedupe_index.indisvalid IS DISTINCT FROM true
       OR index_columns IS DISTINCT FROM ARRAY['dedupe_key']
       OR index_predicate IS DISTINCT FROM 'dedupe_keyisnotnull' THEN
        RAISE EXCEPTION 'Catalog verification failed: outbox dedupe index definition.';
    END IF;

    SELECT index_catalog.*
      INTO outbox_poll_index
      FROM pg_index index_catalog
      JOIN pg_class index_relation
        ON index_relation.oid = index_catalog.indexrelid
     WHERE index_relation.oid = 'campus_duo.outbox_event_dispatch_poll_ix'::regclass;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog verification failed: outbox dispatch index is absent.';
    END IF;
    index_columns := ARRAY(
        SELECT attribute_catalog.attname
          FROM unnest(outbox_poll_index.indkey) WITH ORDINALITY AS key_parts(attnum, ordinal)
          JOIN pg_attribute attribute_catalog
            ON attribute_catalog.attrelid = outbox_poll_index.indrelid
           AND attribute_catalog.attnum = key_parts.attnum
         ORDER BY key_parts.ordinal
    );
    IF outbox_poll_index.indrelid IS DISTINCT FROM 'campus_duo.outbox_event'::regclass
       OR outbox_poll_index.indisvalid IS DISTINCT FROM true
       OR index_columns IS DISTINCT FROM ARRAY['status', 'next_attempt_at', 'created_at'] THEN
        RAISE EXCEPTION 'Catalog verification failed: outbox dispatch index definition.';
    END IF;
END
$$;

DO $$
DECLARE
    expected_table_name text;
    privilege_name text;
    business_table_names text[] := ARRAY[
        'user_account', 'student_profile', 'profile_preferred_time', 'course',
        'profile_course', 'social_interest', 'profile_interest', 'consent_record',
        'consent_history', 'discovery_action', 'connection', 'block',
        'study_location', 'study_table', 'study_slot', 'booking',
        'booking_participant', 'idempotency_record', 'audit_event',
        'moderation_report', 'notification', 'outbox_event',
        'flyway_schema_history'
    ];
BEGIN
    IF NOT has_database_privilege('campus_duo_app', 'campus_duo_dev', 'CONNECT') THEN
        RAISE EXCEPTION 'Catalog verification failed: app CONNECT privilege is absent.';
    END IF;
    IF NOT has_schema_privilege('campus_duo_app', 'campus_duo', 'USAGE') THEN
        RAISE EXCEPTION 'Catalog verification failed: app schema USAGE privilege is absent.';
    END IF;
    IF has_database_privilege('campus_duo_app', 'campus_duo_dev', 'CREATE')
       OR has_schema_privilege('campus_duo_app', 'campus_duo', 'CREATE') THEN
        RAISE EXCEPTION 'Catalog verification failed: app CREATE privilege is present.';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM pg_auth_members membership_catalog
          JOIN pg_roles granted_role
            ON granted_role.oid = membership_catalog.roleid
          JOIN pg_roles member_role
            ON member_role.oid = membership_catalog.member
         WHERE member_role.rolname = 'campus_duo_app'
           AND granted_role.rolname IN ('campus_duo_migrator', 'campus_duo')
    ) THEN
        RAISE EXCEPTION 'Catalog verification failed: app is a member of an owner role.';
    END IF;

    FOREACH expected_table_name IN ARRAY business_table_names
    LOOP
        FOREACH privilege_name IN ARRAY ARRAY[
            'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
        ]
        LOOP
            IF has_table_privilege(
                'campus_duo_app',
                'campus_duo.' || expected_table_name,
                privilege_name
            ) THEN
                RAISE EXCEPTION
                    'Catalog verification failed: app has % on campus_duo.%.',
                    privilege_name, expected_table_name;
            END IF;
        END LOOP;
    END LOOP;
END
$$;

ROLLBACK;
\echo 'DB-04C catalog verification completed successfully (read-only transaction rolled back).'
