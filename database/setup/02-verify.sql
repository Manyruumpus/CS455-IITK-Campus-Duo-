\set ON_ERROR_STOP on

\echo 'Campus Duo bootstrap verification: read-only catalog and privilege checks.'

DO $database_check$
DECLARE
    database_owner name;
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION
            'Verification failed: connected database is %, expected campus_duo_dev.',
            current_database();
    END IF;

    SELECT pg_get_userbyid(datdba)
      INTO database_owner
      FROM pg_database
     WHERE datname = 'campus_duo_dev';

    IF database_owner <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION
            'Verification failed: campus_duo_dev owner is %, expected campus_duo_migrator.',
            database_owner;
    END IF;
END
$database_check$;

DO $role_check$
DECLARE
    role_record record;
BEGIN
    FOR role_record IN
        SELECT rolname
          FROM (VALUES ('campus_duo_migrator'::name), ('campus_duo_app'::name)) AS expected(rolname)
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM pg_roles
             WHERE rolname = role_record.rolname
               AND rolcanlogin
               AND NOT rolsuper
               AND NOT rolcreatedb
               AND NOT rolcreaterole
               AND NOT rolreplication
               AND NOT rolbypassrls
        ) THEN
            RAISE EXCEPTION
                'Verification failed: role % is missing or has unexpected attributes.',
                role_record.rolname;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles member_role
            ON member_role.oid = membership.member
          JOIN pg_roles parent_role
            ON parent_role.oid = membership.roleid
         WHERE member_role.rolname = 'campus_duo_app'
           AND parent_role.rolname = 'campus_duo_migrator'
    ) THEN
        RAISE EXCEPTION
            'Verification failed: campus_duo_app must not be a member of campus_duo_migrator.';
    END IF;
END
$role_check$;

DO $schema_check$
DECLARE
    schema_owner name;
BEGIN
    SELECT nspowner::regrole
      INTO schema_owner
      FROM pg_namespace
     WHERE nspname = 'campus_duo';

    IF schema_owner IS NULL THEN
        RAISE EXCEPTION 'Verification failed: schema campus_duo does not exist.';
    END IF;

    IF schema_owner <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION
            'Verification failed: schema campus_duo owner is %, expected campus_duo_migrator.',
            schema_owner;
    END IF;
END
$schema_check$;

DO $privilege_check$
BEGIN
    IF NOT has_database_privilege('campus_duo_migrator', 'campus_duo_dev', 'CONNECT')
       OR NOT has_database_privilege('campus_duo_app', 'campus_duo_dev', 'CONNECT') THEN
        RAISE EXCEPTION
            'Verification failed: both project roles must have CONNECT on campus_duo_dev.';
    END IF;

    IF NOT has_schema_privilege('campus_duo_app', 'campus_duo', 'USAGE') THEN
        RAISE EXCEPTION
            'Verification failed: campus_duo_app must have USAGE on schema campus_duo.';
    END IF;

    IF has_database_privilege('campus_duo_app', 'campus_duo_dev', 'CREATE') THEN
        RAISE EXCEPTION
            'Verification failed: campus_duo_app must not have CREATE on campus_duo_dev.';
    END IF;

    IF has_schema_privilege('campus_duo_app', 'campus_duo', 'CREATE') THEN
        RAISE EXCEPTION
            'Verification failed: campus_duo_app must not have CREATE on schema campus_duo.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_database database_record
          CROSS JOIN LATERAL aclexplode(
              COALESCE(
                  database_record.datacl,
                  acldefault('d', database_record.datdba)
              )
          ) privilege_record
         WHERE database_record.datname = 'campus_duo_dev'
           AND privilege_record.grantee = 0
    ) THEN
        RAISE EXCEPTION
            'Verification failed: PUBLIC must not retain database privileges on campus_duo_dev.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_namespace schema_record
          CROSS JOIN LATERAL aclexplode(
              COALESCE(
                  schema_record.nspacl,
                  acldefault('n', schema_record.nspowner)
              )
          ) privilege_record
         WHERE schema_record.nspname IN ('campus_duo', 'public')
           AND privilege_record.grantee = 0
    ) THEN
        RAISE EXCEPTION
            'Verification failed: PUBLIC must not retain access to schemas campus_duo or public.';
    END IF;
END
$privilege_check$;

\echo 'Verification passed: database, owners, role attributes, membership, schema ownership, and bootstrap privileges are correct.'
\echo 'Business table, sequence, function, and migration privileges are intentionally not verified at this stage.'
