SET LOCAL search_path = campus_duo, public;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_namespace
         WHERE nspname = 'campus_duo'
           AND nspowner = 'campus_duo_migrator'::regrole
    ) THEN
        RAISE EXCEPTION
            'Prerequisite failed: schema campus_duo must exist and be owned by campus_duo_migrator.';
    END IF;

    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION
            'Migration must run as campus_duo_migrator, not %. ',
            current_user;
    END IF;
END
$$;

DO $$
DECLARE
    extension_schema name;
BEGIN
    SELECT n.nspname
      INTO extension_schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'btree_gist';

    IF extension_schema IS NULL THEN
        RAISE EXCEPTION
            'Prerequisite failed: btree_gist is not installed. Install it as an administrator before migrations.';
    ELSIF extension_schema <> 'public' THEN
        RAISE EXCEPTION
            'Prerequisite failed: btree_gist must be installed in schema public; found schema %. ',
            extension_schema;
    END IF;

END
$$;
