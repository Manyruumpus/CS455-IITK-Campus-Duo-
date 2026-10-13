\set ON_ERROR_STOP on

\echo 'DB-07B systematic effective privilege verification (read-only).'
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = campus_duo, public;

DO $$
DECLARE
    expected record;
    column_name name;
    runtime_role name;
    actual_allowed boolean;
    roles name[] := ARRAY[
        'campus_duo_app', 'campus_duo_admin_service', 'campus_duo_worker'
    ];
    objects name[] := ARRAY[
        'user_account', 'student_profile', 'profile_preferred_time', 'course',
        'profile_course', 'social_interest', 'profile_interest', 'consent_record',
        'consent_history', 'discovery_action', 'connection', 'block',
        'study_location', 'study_table', 'study_slot', 'booking',
        'booking_participant', 'idempotency_record', 'notification',
        'moderation_report', 'audit_event', 'outbox_event'
    ];
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION 'Privilege verification target is %, expected campus_duo_dev.', current_database();
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_namespace n
          JOIN pg_roles r ON r.oid = n.nspowner
         WHERE n.nspname = 'campus_duo'
           AND r.rolname = 'campus_duo_migrator'
    ) THEN
        RAISE EXCEPTION 'Privilege verification requires migrator-owned campus_duo schema.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'campus_duo'
          AND c.relname = 'flyway_schema_history'
          AND c.relkind IN ('r', 'p')
    ) THEN
        RAISE EXCEPTION 'Privilege verification requires campus_duo.flyway_schema_history.';
    END IF;

    FOR expected IN
        SELECT r.role_name, o.object_name,
               COALESCE(m.select_columns, ARRAY[]::name[]) AS select_columns,
               COALESCE(m.insert_columns, ARRAY[]::name[]) AS insert_columns,
               COALESCE(m.update_columns, ARRAY[]::name[]) AS update_columns,
               COALESCE(m.delete_allowed, false) AS delete_allowed
          FROM unnest(roles) AS r(role_name)
          CROSS JOIN unnest(objects) AS o(object_name)
          LEFT JOIN (
            SELECT * FROM (VALUES
                ('campus_duo_app'::name, 'user_account'::name,
                 ARRAY['user_id','email','roll_number','display_name','department','degree','year','role','verification_status','onboarding_status','account_status']::name[],
                 ARRAY[]::name[], ARRAY['email','roll_number','department','degree','year','display_name','onboarding_status','account_status','updated_at']::name[], false),
                ('campus_duo_app'::name, 'student_profile'::name,
                 ARRAY['user_id','social_bio','study_goals','preferred_location','study_style','preferred_pace','profile_version','created_at','updated_at']::name[],
                 ARRAY['user_id','social_bio','study_goals','preferred_location','study_style','preferred_pace']::name[], ARRAY['social_bio','study_goals','preferred_location','study_style','preferred_pace','profile_version','updated_at']::name[], false),
                ('campus_duo_app'::name, 'profile_preferred_time'::name,
                 ARRAY['user_id','time_code','created_at']::name[], ARRAY['user_id','time_code']::name[], ARRAY[]::name[], true),
                ('campus_duo_app'::name, 'course'::name,
                 ARRAY['course_id','code','name','department','active']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'profile_course'::name,
                 ARRAY['user_id','course_id','enrolled_at','enrollment_status']::name[], ARRAY['user_id','course_id','enrolled_at','enrollment_status']::name[], ARRAY['enrolled_at','enrollment_status']::name[], true),
                ('campus_duo_app'::name, 'social_interest'::name,
                 ARRAY['interest_id','name','category','description','active']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'profile_interest'::name,
                 ARRAY['user_id','interest_id','selected_at']::name[], ARRAY['user_id','interest_id','selected_at']::name[], ARRAY['selected_at']::name[], true),
                ('campus_duo_app'::name, 'consent_record'::name,
                 ARRAY['consent_id','user_id','mode','has_consent','consented_at','revoked_at','policy_version','updated_at']::name[], ARRAY['user_id','mode','has_consent','consented_at','revoked_at','policy_version']::name[], ARRAY['has_consent','consented_at','revoked_at','policy_version','updated_at']::name[], false),
                ('campus_duo_app'::name, 'consent_history'::name,
                 ARRAY['consent_event_id','user_id','mode','event_type','has_consent','policy_version','source','occurred_at']::name[], ARRAY['user_id','mode','event_type','has_consent','policy_version','source','occurred_at']::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'discovery_action'::name,
                 ARRAY['action_id','actor_user_id','target_user_id','mode','action_type','discovery_round_id','policy_version','created_at','updated_at']::name[], ARRAY['actor_user_id','target_user_id','mode','action_type','discovery_round_id','policy_version']::name[], ARRAY['action_type','policy_version','updated_at']::name[], false),
                ('campus_duo_app'::name, 'connection'::name,
                 ARRAY['connection_id','user_a_id','user_b_id','mode','status','note','restricted_reason','created_at','updated_at']::name[], ARRAY['user_a_id','user_b_id','mode','status','note','restricted_reason']::name[], ARRAY['status','note','restricted_reason','updated_at']::name[], false),
                ('campus_duo_app'::name, 'block'::name,
                 ARRAY['block_id','actor_user_id','target_user_id','active','created_at','revoked_at','policy_version']::name[], ARRAY['actor_user_id','target_user_id','policy_version']::name[], ARRAY['active','revoked_at','policy_version']::name[], false),
                ('campus_duo_app'::name, 'study_location'::name,
                 ARRAY['location_id','name','building','open_time','close_time','has_power_outlets','has_wifi6','noise_policy','active']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'study_table'::name,
                 ARRAY['table_id','location_id','table_number','capacity','active']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'study_slot'::name,
                 ARRAY['slot_id','table_id','location_id','local_date','start_time','end_time','zone','status','active']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'booking'::name,
                 ARRAY['booking_id','connection_id','booker_id','table_id','location_id','slot_id','local_date','status','partner_approval_status','booking_version','created_at','updated_at','cancelled_at','cancelled_by','cancellation_reason','completed_at','rescheduled_from_booking_id']::name[],
                 ARRAY['connection_id','booker_id','table_id','location_id','slot_id','local_date','status','partner_approval_status','booking_version','rescheduled_from_booking_id']::name[],
                 ARRAY['status','booking_version','updated_at','cancelled_at','cancelled_by','cancellation_reason','completed_at']::name[], false),
                ('campus_duo_app'::name, 'booking_participant'::name,
                 ARRAY['booking_id','user_id','participant_role','joined_at','removed_at']::name[], ARRAY['booking_id','user_id','participant_role','joined_at']::name[], ARRAY['removed_at']::name[], false),
                ('campus_duo_app'::name, 'idempotency_record'::name,
                 ARRAY['idempotency_id','actor_user_id','operation_type','client_operation_id','request_fingerprint','outcome_status','booking_id','response_reference','created_at','expires_at']::name[],
                 ARRAY['actor_user_id','operation_type','client_operation_id','request_fingerprint','outcome_status','booking_id','response_reference','expires_at']::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'notification'::name,
                 ARRAY['notification_id','recipient_user_id','event_type','mode','title','body','destination_type','destination_id','is_read','read_at','dedupe_key','created_at']::name[],
                 ARRAY['recipient_user_id','event_type','mode','title','body','destination_type','destination_id','dedupe_key']::name[], ARRAY['is_read','read_at']::name[], false),
                ('campus_duo_app'::name, 'moderation_report'::name,
                 ARRAY['report_id','reporter_user_id','reported_user_id','status','created_at']::name[], ARRAY['reporter_user_id','reported_user_id','category','description','evidence_reference']::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'audit_event'::name,
                 ARRAY[]::name[], ARRAY['actor_user_id','actor_role','action','target_type','target_id','outcome','correlation_id','operation_id','safe_reason','occurred_at','retention_class']::name[], ARRAY[]::name[], false),
                ('campus_duo_app'::name, 'outbox_event'::name,
                 ARRAY[]::name[], ARRAY['event_type','aggregate_type','aggregate_id','dedupe_key','payload','correlation_id']::name[], ARRAY[]::name[], false),
                ('campus_duo_admin_service'::name, 'user_account'::name,
                 ARRAY['user_id','display_name','role','account_status']::name[], ARRAY[]::name[], ARRAY[]::name[], false),
                ('campus_duo_admin_service'::name, 'moderation_report'::name,
                 ARRAY['report_id','reporter_user_id','reported_user_id','category','description','evidence_reference','status','reviewed_by','reviewed_at','review_reason','audit_event_id','created_at','updated_at']::name[],
                 ARRAY[]::name[], ARRAY['status','reviewed_by','reviewed_at','review_reason','audit_event_id','updated_at']::name[], false),
                ('campus_duo_admin_service'::name, 'study_location'::name,
                 ARRAY['location_id','name','building','active']::name[], ARRAY[]::name[], ARRAY['name','building','open_time','close_time','has_power_outlets','has_wifi6','noise_policy','active','updated_at']::name[], false),
                ('campus_duo_admin_service'::name, 'study_table'::name,
                 ARRAY['table_id','location_id','table_number','capacity','active']::name[], ARRAY[]::name[], ARRAY['table_number','capacity','active','updated_at']::name[], false),
                ('campus_duo_admin_service'::name, 'study_slot'::name,
                 ARRAY['slot_id','table_id','location_id','local_date','start_time','end_time','zone','status','active']::name[], ARRAY[]::name[], ARRAY['start_time','end_time','zone','status','active','updated_at']::name[], false),
                ('campus_duo_admin_service'::name, 'booking'::name,
                 ARRAY['booking_id','connection_id','booker_id','table_id','location_id','slot_id','local_date','status','booking_version','cancelled_at','cancelled_by','cancellation_reason','completed_at','rescheduled_from_booking_id']::name[],
                 ARRAY[]::name[], ARRAY['status','booking_version','updated_at','cancelled_at','cancelled_by','cancellation_reason','completed_at']::name[], false),
                ('campus_duo_admin_service'::name, 'audit_event'::name,
                 ARRAY['audit_event_id','actor_user_id','actor_role','action','target_type','target_id','outcome','correlation_id','operation_id','safe_reason','occurred_at','retention_class']::name[],
                 ARRAY['actor_user_id','actor_role','action','target_type','target_id','outcome','correlation_id','operation_id','safe_reason','occurred_at','retention_class']::name[], ARRAY[]::name[], false),
                ('campus_duo_admin_service'::name, 'notification'::name,
                 ARRAY[]::name[], ARRAY['recipient_user_id','event_type','mode','title','body','destination_type','destination_id','dedupe_key']::name[], ARRAY[]::name[], false),
                ('campus_duo_admin_service'::name, 'outbox_event'::name,
                 ARRAY[]::name[], ARRAY['event_type','aggregate_type','aggregate_id','dedupe_key','payload','correlation_id']::name[], ARRAY[]::name[], false),
                ('campus_duo_worker'::name, 'outbox_event'::name,
                 ARRAY['outbox_event_id','event_type','aggregate_type','aggregate_id','dedupe_key','payload','status','attempts','next_attempt_at','created_at','dispatched_at','correlation_id']::name[],
                 ARRAY[]::name[], ARRAY['status','attempts','next_attempt_at','dispatched_at']::name[], false)
            ) AS x(role_name, object_name, select_columns, insert_columns, update_columns, delete_allowed)
        ) m ON m.role_name = r.role_name AND m.object_name = o.object_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_roles owner_role ON owner_role.oid = c.relowner
            WHERE n.nspname = 'campus_duo'
              AND c.relname = expected.object_name
              AND c.relkind IN ('r', 'p')
              AND owner_role.rolname = 'campus_duo_migrator'
        ) THEN
            RAISE EXCEPTION 'Business object campus_duo.% is missing or not migrator-owned.', expected.object_name;
        END IF;

        FOR column_name IN
            SELECT a.attname
              FROM pg_attribute a
              JOIN pg_class c ON c.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'campus_duo'
               AND c.relname = expected.object_name
               AND a.attnum > 0
               AND NOT a.attisdropped
        LOOP
            actual_allowed := column_name = ANY(expected.select_columns);
            IF has_column_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), column_name, 'SELECT') IS DISTINCT FROM actual_allowed THEN
                RAISE EXCEPTION 'SELECT matrix mismatch for %.%.', expected.object_name, column_name;
            END IF;
            actual_allowed := column_name = ANY(expected.insert_columns);
            IF has_column_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), column_name, 'INSERT') IS DISTINCT FROM actual_allowed THEN
                RAISE EXCEPTION 'INSERT matrix mismatch for %.%.', expected.object_name, column_name;
            END IF;
            actual_allowed := column_name = ANY(expected.update_columns);
            IF has_column_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), column_name, 'UPDATE') IS DISTINCT FROM actual_allowed THEN
                RAISE EXCEPTION 'UPDATE matrix mismatch for %.%.', expected.object_name, column_name;
            END IF;
        END LOOP;

        IF expected.delete_allowed IS DISTINCT FROM has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'DELETE') THEN
            RAISE EXCEPTION 'DELETE table privilege mismatch for campus_duo.%.', expected.object_name;
        END IF;
        IF has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'SELECT')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'INSERT')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'UPDATE')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'TRUNCATE')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'REFERENCES')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'TRIGGER')
           OR has_table_privilege(expected.role_name, format('campus_duo.%I', expected.object_name), 'MAINTAIN') THEN
            RAISE EXCEPTION 'Unexpected table-level privilege for %.%.', expected.role_name, expected.object_name;
        END IF;

        IF EXISTS (
            SELECT 1
              FROM pg_attribute a
              JOIN pg_class c ON c.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
              CROSS JOIN LATERAL aclexplode(a.attacl) acl
              JOIN pg_roles grantee ON grantee.oid = acl.grantee
             WHERE n.nspname = 'campus_duo'
               AND c.relname = expected.object_name
               AND a.attnum > 0
               AND NOT a.attisdropped
               AND grantee.rolname = expected.role_name
               AND acl.is_grantable
        ) THEN
            RAISE EXCEPTION 'Column grant option found for %.%.', expected.role_name, expected.object_name;
        END IF;
    END LOOP;

    FOREACH runtime_role IN ARRAY roles LOOP
        IF has_table_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'SELECT')
           OR has_table_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'INSERT')
           OR has_table_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'UPDATE')
           OR has_table_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'DELETE')
           OR has_any_column_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'SELECT')
           OR has_any_column_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'INSERT')
           OR has_any_column_privilege(runtime_role, 'campus_duo.flyway_schema_history', 'UPDATE') THEN
            RAISE EXCEPTION 'Migration-history privilege found for %.', runtime_role;
        END IF;
        IF EXISTS (
            SELECT 1
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              JOIN pg_attribute a ON a.attrelid = c.oid
              CROSS JOIN LATERAL aclexplode(a.attacl) acl
              JOIN pg_roles grantee ON grantee.oid = acl.grantee
             WHERE n.nspname = 'campus_duo'
               AND c.relname = 'flyway_schema_history'
               AND a.attnum > 0
               AND NOT a.attisdropped
               AND grantee.rolname = runtime_role
               AND acl.is_grantable
        ) THEN
            RAISE EXCEPTION 'Migration-history column grant option found for %.', runtime_role;
        END IF;
    END LOOP;

    IF has_column_privilege('campus_duo_app', 'campus_duo.audit_event', 'details', 'SELECT')
       OR has_column_privilege('campus_duo_admin_service', 'campus_duo.audit_event', 'details', 'SELECT')
       OR has_column_privilege('campus_duo_app', 'campus_duo.audit_event', 'audit_event_id', 'SELECT')
       OR has_column_privilege('campus_duo_admin_service', 'campus_duo.audit_event', 'audit_event_id', 'UPDATE') THEN
        RAISE EXCEPTION 'Audit projection or mutation boundary failed.';
    END IF;

    FOREACH runtime_role IN ARRAY roles LOOP
        IF has_database_privilege(runtime_role, current_database(), 'CREATE')
           OR has_schema_privilege(runtime_role, 'campus_duo', 'CREATE') THEN
            RAISE EXCEPTION 'Forbidden database/schema CREATE for %.', runtime_role;
        END IF;
        IF EXISTS (
            SELECT 1
              FROM pg_auth_members m
              JOIN pg_roles member_role ON member_role.oid = m.member
             WHERE member_role.rolname = runtime_role
        ) THEN
            RAISE EXCEPTION 'Unexpected membership for %.', runtime_role;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
          FROM pg_default_acl d
          CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
          JOIN pg_roles grantee ON grantee.oid = acl.grantee
         WHERE grantee.rolname = ANY(roles)
    ) THEN
        RAISE EXCEPTION 'Runtime roles have unintended future default privileges.';
    END IF;
END
$$;

ROLLBACK;
\echo 'PASS: DB-07B systematic privilege catalog verification completed.'
