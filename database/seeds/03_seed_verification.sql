\set ON_ERROR_STOP on

\echo 'DB-05 seed verification: read-only exact-manifest checks are running.'

BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = campus_duo, public;

DO $$
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION 'DB-05 verification requires campus_duo_dev.';
    END IF;
END
$$;

\ir 00_manifest_assertions.sql

ROLLBACK;
\echo 'DB-05 seed verification completed successfully; read-only transaction rolled back.'
