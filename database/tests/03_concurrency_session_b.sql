\set ON_ERROR_STOP on

\echo 'Session B: the insert must wait for Session A and then fail with SQLSTATE 23505 on booking_confirmed_resource_uk.'
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
    actual_sqlstate text;
    actual_constraint text;
BEGIN
    BEGIN
        INSERT INTO campus_duo.booking (
            booking_id, connection_id, booker_id, table_id, location_id, slot_id, local_date
        )
        VALUES (
            '00000000-0000-0000-0000-000000000111',
            '00000000-0000-0000-0000-000000000103',
            '00000000-0000-0000-0000-000000000102',
            '00000000-0000-0000-0000-000000000108',
            '00000000-0000-0000-0000-000000000107',
            '00000000-0000-0000-0000-000000000109',
            DATE '2099-02-01'
        );
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            actual_sqlstate = RETURNED_SQLSTATE,
            actual_constraint = CONSTRAINT_NAME;
        IF actual_sqlstate <> '23505'
           OR actual_constraint <> 'booking_confirmed_resource_uk' THEN
            RAISE EXCEPTION
                'Session B expected SQLSTATE 23505 and booking_confirmed_resource_uk, got % and %.',
                actual_sqlstate, actual_constraint;
        END IF;
        RETURN;
    END;

    RAISE EXCEPTION 'Session B unexpectedly inserted a confirmed duplicate.';
END
$$;

ROLLBACK;
\echo 'Session B assertion passed and its failed transaction was explicitly rolled back. A lock timeout is not accepted as proof.'
