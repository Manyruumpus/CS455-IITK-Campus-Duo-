\set ON_ERROR_STOP on

\echo 'DB-05 reference seed: no authoritative shared catalog rows are available; validating target only.'

BEGIN;

DO $$
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION 'DB-05 reference seed requires campus_duo_dev, found %.', current_database();
    END IF;
    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'DB-05 reference seed requires campus_duo_migrator, found %.', current_user;
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM pg_namespace
         WHERE nspname = 'campus_duo'
           AND nspowner = 'campus_duo_migrator'::regrole
    ) THEN
        RAISE EXCEPTION 'DB-05 reference seed requires campus_duo owned by campus_duo_migrator.';
    END IF;
END
$$;

COMMIT;
\echo 'DB-05 reference seed completed: no authoritative reference rows were inserted.'
