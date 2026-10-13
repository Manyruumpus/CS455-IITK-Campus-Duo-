\set ON_ERROR_STOP on

\echo 'DB-07C runtime access checks: current login is tested directly; actor/admin policy remains backend-required.'

DO $$
BEGIN
    IF current_database() <> 'campus_duo_dev' THEN
        RAISE EXCEPTION 'DB-07C expected campus_duo_dev, found %. ', current_database();
    END IF;

    IF current_user IN (
        'campus_duo_app', 'campus_duo_admin_service', 'campus_duo_worker'
    ) THEN
        IF has_database_privilege(current_user, current_database(), 'CREATE')
           OR has_schema_privilege(current_user, 'campus_duo', 'CREATE') THEN
            RAISE EXCEPTION 'Runtime identity % has forbidden CREATE access.', current_user;
        END IF;
    ELSE
        RAISE EXCEPTION 'DB-07C must run as an intended runtime identity, found %. ', current_user;
    END IF;
END
$$;
