\set ON_ERROR_STOP on

\echo 'DB-07A read-only runtime-role preflight.'
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = campus_duo, public;

DO $$
DECLARE
    role_name name;
BEGIN
    FOREACH role_name IN ARRAY ARRAY[
        'campus_duo_migrator'::name,
        'campus_duo_app'::name,
        'campus_duo_admin_service'::name,
        'campus_duo_worker'::name
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_roles r
             WHERE r.rolname = role_name
               AND r.rolcanlogin
               AND r.rolinherit
               AND NOT r.rolsuper
               AND NOT r.rolcreatedb
               AND NOT r.rolcreaterole
               AND NOT r.rolreplication
               AND NOT r.rolbypassrls
        ) THEN
            RAISE EXCEPTION 'Runtime-role preflight failed for role %.', role_name;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
          FROM pg_auth_members m
          JOIN pg_roles member_role ON member_role.oid = m.member
         WHERE member_role.rolname IN (
             'campus_duo_app', 'campus_duo_admin_service', 'campus_duo_worker'
         )
    ) THEN
        RAISE EXCEPTION 'Runtime roles must have no inherited memberships.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_roles owner_role ON owner_role.oid = c.relowner
         WHERE n.nspname = 'campus_duo'
           AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
           AND owner_role.rolname <> 'campus_duo_migrator'
    ) THEN
        RAISE EXCEPTION 'Ownership boundary failed: campus_duo objects must remain migrator-owned.';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT has_database_privilege('campus_duo_admin_service', 'campus_duo_dev', 'CONNECT')
       OR NOT has_database_privilege('campus_duo_worker', 'campus_duo_dev', 'CONNECT')
       OR NOT has_schema_privilege('campus_duo_admin_service', 'campus_duo', 'USAGE')
       OR NOT has_schema_privilege('campus_duo_worker', 'campus_duo', 'USAGE') THEN
        RAISE EXCEPTION 'Runtime roles must have only their required database/schema entry privileges.';
    END IF;

    IF has_database_privilege('campus_duo_admin_service', 'campus_duo_dev', 'CREATE')
       OR has_database_privilege('campus_duo_worker', 'campus_duo_dev', 'CREATE')
       OR has_schema_privilege('campus_duo_admin_service', 'campus_duo', 'CREATE')
       OR has_schema_privilege('campus_duo_worker', 'campus_duo', 'CREATE') THEN
        RAISE EXCEPTION 'Runtime roles must not have database or schema CREATE.';
    END IF;

    IF has_table_privilege('campus_duo_app', 'campus_duo.flyway_schema_history', 'SELECT')
       OR has_table_privilege('campus_duo_admin_service', 'campus_duo.flyway_schema_history', 'SELECT')
       OR has_table_privilege('campus_duo_worker', 'campus_duo.flyway_schema_history', 'SELECT') THEN
        RAISE EXCEPTION 'Runtime roles must not access migration history.';
    END IF;
END
$$;

ROLLBACK;
\echo 'DB-07A runtime-role preflight completed.'
