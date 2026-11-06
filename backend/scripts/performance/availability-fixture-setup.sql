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
            'Performance fixture refused on shared database %.',
            current_database();
    END IF;
    IF current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION
            'Performance fixture setup requires campus_duo_migrator, not %.',
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

DO $collision$
BEGIN
    IF EXISTS (SELECT 1 FROM campus_duo.user_account WHERE user_id = current_setting('campus_duo.fixture_actor_id')::uuid)
       OR EXISTS (SELECT 1 FROM campus_duo.study_location WHERE location_id = current_setting('campus_duo.fixture_location_id')::uuid)
       OR EXISTS (SELECT 1 FROM campus_duo.study_table WHERE table_id = current_setting('campus_duo.fixture_table_id')::uuid)
       OR EXISTS (
           SELECT 1 FROM campus_duo.study_slot
           WHERE slot_id = ANY(ARRAY[
             current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
             current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
             current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
             current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
             current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
             current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
           ])
       )
    THEN
        RAISE EXCEPTION 'Performance fixture ID collision; refusing to overwrite existing rows.';
    END IF;
END
$collision$;

INSERT INTO campus_duo.user_account (
    user_id, identity_subject, display_name, role, verification_status,
    verified_at, onboarding_status, account_status
) VALUES (
    :'actor_id'::uuid,
    :'ownership_id',
    'KAN-81 Performance Actor',
    'ROLE_STUDENT',
    'VERIFIED',
    now(),
    'COMPLETED',
    'ACTIVE'
);

INSERT INTO campus_duo.study_location (
    location_id, name, building, open_time, close_time,
    has_power_outlets, has_wifi6, noise_policy, active
) VALUES (
    :'location_id'::uuid,
    :'ownership_id',
    :'ownership_id',
    '08:00',
    '20:00',
    true,
    true,
    'WHISPER_COLLAB',
    true
);

INSERT INTO campus_duo.study_table (
    table_id, location_id, table_number, capacity, active
) VALUES (
    :'table_id'::uuid,
    :'location_id'::uuid,
    :'ownership_id',
    2,
    true
);

INSERT INTO campus_duo.study_slot (
    slot_id, table_id, location_id, local_date, start_time, end_time,
    zone, status, active
)
SELECT
    slot_id,
    :'table_id'::uuid,
    :'location_id'::uuid,
    :'test_date'::date,
    make_time(8 + slot_number, 0, 0),
    make_time(9 + slot_number, 0, 0),
    'COLLABORATIVE_STUDY',
    'AVAILABLE',
    true
FROM (VALUES
  (:'slot_1'::uuid, 1), (:'slot_2'::uuid, 2), (:'slot_3'::uuid, 3),
  (:'slot_4'::uuid, 4), (:'slot_5'::uuid, 5), (:'slot_6'::uuid, 6),
  (:'slot_7'::uuid, 7), (:'slot_8'::uuid, 8), (:'slot_9'::uuid, 9),
  (:'slot_10'::uuid, 10), (:'slot_11'::uuid, 11), (:'slot_12'::uuid, 12)
) AS slots(slot_id, slot_number);

SELECT current_database() AS fixture_database,
       current_user AS fixture_role,
       :'actor_id' AS actor_id, :'location_id' AS location_id,
       :'test_date' AS test_date,
       :'slot_1' || ',' || :'slot_2' || ',' || :'slot_3' || ',' ||
       :'slot_4' || ',' || :'slot_5' || ',' || :'slot_6' || ',' ||
       :'slot_7' || ',' || :'slot_8' || ',' || :'slot_9' || ',' ||
       :'slot_10' || ',' || :'slot_11' || ',' || :'slot_12' AS expected_slot_ids;

COMMIT;
