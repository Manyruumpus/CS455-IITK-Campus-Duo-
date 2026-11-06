\set ON_ERROR_STOP on
\if :{?ownership_id}
\else
\echo 'ownership_id is required'
\quit 2
\endif
\if :{?actor_id}
\else
\echo 'actor_id is required'
\quit 2
\endif
\if :{?location_id}
\else
\echo 'location_id is required'
\quit 2
\endif
\if :{?table_id}
\else
\echo 'table_id is required'
\quit 2
\endif
\if :{?test_date}
\else
\echo 'test_date is required'
\quit 2
\endif
\if :{?slot_1}
\else
\echo 'slot_1 is required'
\quit 2
\endif
\if :{?slot_2}
\else
\echo 'slot_2 is required'
\quit 2
\endif
\if :{?slot_3}
\else
\echo 'slot_3 is required'
\quit 2
\endif
\if :{?slot_4}
\else
\echo 'slot_4 is required'
\quit 2
\endif
\if :{?slot_5}
\else
\echo 'slot_5 is required'
\quit 2
\endif
\if :{?slot_6}
\else
\echo 'slot_6 is required'
\quit 2
\endif
\if :{?slot_7}
\else
\echo 'slot_7 is required'
\quit 2
\endif
\if :{?slot_8}
\else
\echo 'slot_8 is required'
\quit 2
\endif
\if :{?slot_9}
\else
\echo 'slot_9 is required'
\quit 2
\endif
\if :{?slot_10}
\else
\echo 'slot_10 is required'
\quit 2
\endif
\if :{?slot_11}
\else
\echo 'slot_11 is required'
\quit 2
\endif
\if :{?slot_12}
\else
\echo 'slot_12 is required'
\quit 2
\endif

DO $guard$
BEGIN
    IF current_database() IN ('campus_duo_dev', 'campus_duo_test') THEN
        RAISE EXCEPTION
            'Performance fixture cleanup refused on shared database %.',
            current_database();
    END IF;
    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION
            'Performance fixture cleanup requires campus_duo_migrator, not %.',
            current_user;
    END IF;
END
$guard$;

BEGIN;

SELECT set_config('campus_duo.fixture_ownership_id', :'ownership_id', true),
       set_config('campus_duo.fixture_actor_id', :'actor_id', true),
       set_config('campus_duo.fixture_location_id', :'location_id', true),
       set_config('campus_duo.fixture_table_id', :'table_id', true),
       set_config('campus_duo.fixture_test_date', :'test_date', true),
       set_config('campus_duo.fixture_slot_1', :'slot_1', true),
       set_config('campus_duo.fixture_slot_2', :'slot_2', true),
       set_config('campus_duo.fixture_slot_3', :'slot_3', true),
       set_config('campus_duo.fixture_slot_4', :'slot_4', true),
       set_config('campus_duo.fixture_slot_5', :'slot_5', true),
       set_config('campus_duo.fixture_slot_6', :'slot_6', true),
       set_config('campus_duo.fixture_slot_7', :'slot_7', true),
       set_config('campus_duo.fixture_slot_8', :'slot_8', true),
       set_config('campus_duo.fixture_slot_9', :'slot_9', true),
       set_config('campus_duo.fixture_slot_10', :'slot_10', true),
       set_config('campus_duo.fixture_slot_11', :'slot_11', true),
       set_config('campus_duo.fixture_slot_12', :'slot_12', true);

DO $ownership$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM campus_duo.user_account
        WHERE user_id = current_setting('campus_duo.fixture_actor_id')::uuid
          AND identity_subject = current_setting('campus_duo.fixture_ownership_id')
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.study_location
        WHERE location_id = current_setting('campus_duo.fixture_location_id')::uuid
          AND name = current_setting('campus_duo.fixture_ownership_id')
          AND building = current_setting('campus_duo.fixture_ownership_id')
    ) OR NOT EXISTS (
        SELECT 1 FROM campus_duo.study_table
        WHERE table_id = current_setting('campus_duo.fixture_table_id')::uuid
          AND location_id = current_setting('campus_duo.fixture_location_id')::uuid
          AND table_number = current_setting('campus_duo.fixture_ownership_id')
    ) OR (
        SELECT count(*) FROM campus_duo.study_slot
        WHERE slot_id = ANY(ARRAY[
          current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
          current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
          current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
          current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
          current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
          current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
        ])
        AND table_id = current_setting('campus_duo.fixture_table_id')::uuid
        AND location_id = current_setting('campus_duo.fixture_location_id')::uuid
        AND local_date = current_setting('campus_duo.fixture_test_date')::date
    ) <> 12
    THEN
        RAISE EXCEPTION 'Performance fixture ownership validation failed; refusing cleanup.';
    END IF;
END
$ownership$;

DELETE FROM campus_duo.study_slot
 WHERE slot_id = ANY(ARRAY[
   :'slot_1'::uuid, :'slot_2'::uuid, :'slot_3'::uuid, :'slot_4'::uuid,
   :'slot_5'::uuid, :'slot_6'::uuid, :'slot_7'::uuid, :'slot_8'::uuid,
   :'slot_9'::uuid, :'slot_10'::uuid, :'slot_11'::uuid, :'slot_12'::uuid
 ]);

DELETE FROM campus_duo.study_table
 WHERE table_id = :'table_id'::uuid;

DELETE FROM campus_duo.study_location
 WHERE location_id = :'location_id'::uuid;

DELETE FROM campus_duo.user_account
 WHERE user_id = :'actor_id'::uuid;

COMMIT;
