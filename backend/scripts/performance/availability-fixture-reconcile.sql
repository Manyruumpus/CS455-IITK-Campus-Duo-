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

BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       host(inet_server_addr()) AS server_address,
       inet_server_port() AS server_port,
       session_user,
       current_user;

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

SELECT 'actor' AS object_type, a.user_id::text AS object_id,
       (a.identity_subject = current_setting('campus_duo.fixture_ownership_id')) AS ownership_match,
       a.identity_subject AS ownership_marker
  FROM campus_duo.user_account a
 WHERE a.user_id = current_setting('campus_duo.fixture_actor_id')::uuid
UNION ALL
SELECT 'location', l.location_id::text,
       (l.name = current_setting('campus_duo.fixture_ownership_id')
        AND l.building = current_setting('campus_duo.fixture_ownership_id')),
       l.name || '|' || l.building
  FROM campus_duo.study_location l
 WHERE l.location_id = current_setting('campus_duo.fixture_location_id')::uuid
UNION ALL
SELECT 'table', t.table_id::text,
       (t.location_id = current_setting('campus_duo.fixture_location_id')::uuid
        AND t.table_number = current_setting('campus_duo.fixture_ownership_id')),
       t.table_number
  FROM campus_duo.study_table t
 WHERE t.table_id = current_setting('campus_duo.fixture_table_id')::uuid;

SELECT 'slot' AS object_type, s.slot_id::text AS object_id,
       (s.table_id = current_setting('campus_duo.fixture_table_id')::uuid
        AND s.location_id = current_setting('campus_duo.fixture_location_id')::uuid
        AND s.local_date = current_setting('campus_duo.fixture_test_date')::date) AS ownership_match,
       s.table_id::text || '|' || s.location_id::text || '|' || s.local_date::text
  FROM campus_duo.study_slot s
 WHERE s.slot_id = ANY(ARRAY[
   current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
   current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
   current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
   current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
   current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
   current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
 ]);

SELECT 'booking' AS dependency_type, b.booking_id::text AS dependency_id,
       b.slot_id::text AS slot_id, b.table_id::text AS table_id, b.location_id::text AS location_id
  FROM campus_duo.booking b
 WHERE b.booker_id = current_setting('campus_duo.fixture_actor_id')::uuid
    OR b.table_id = current_setting('campus_duo.fixture_table_id')::uuid
    OR b.location_id = current_setting('campus_duo.fixture_location_id')::uuid
    OR b.slot_id = ANY(ARRAY[
       current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
       current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
       current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
       current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
       current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
       current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
    ]);

SELECT 'booking_participant' AS dependency_type, bp.booking_id::text AS dependency_id, bp.user_id::text AS user_id
  FROM campus_duo.booking_participant bp
 WHERE bp.booking_id IN (
    SELECT b.booking_id
      FROM campus_duo.booking b
     WHERE b.booker_id = current_setting('campus_duo.fixture_actor_id')::uuid
        OR b.table_id = current_setting('campus_duo.fixture_table_id')::uuid
        OR b.location_id = current_setting('campus_duo.fixture_location_id')::uuid
        OR b.slot_id = ANY(ARRAY[
           current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
           current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
           current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
           current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
           current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
           current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
        ])
 );

DO $fail_closed$
BEGIN
    IF current_database() <> 'campus_duo_perf_20261103'
       OR host(inet_server_addr()) <> '127.0.0.1'
       OR inet_server_port() <> 5432
       OR current_user <> 'campus_duo_migrator' THEN
        RAISE EXCEPTION 'Reconciliation target identity is not the intended disposable target.';
    END IF;
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
    ) OR (SELECT count(*) FROM campus_duo.study_slot WHERE slot_id = ANY(ARRAY[
        current_setting('campus_duo.fixture_slot_1')::uuid, current_setting('campus_duo.fixture_slot_2')::uuid,
        current_setting('campus_duo.fixture_slot_3')::uuid, current_setting('campus_duo.fixture_slot_4')::uuid,
        current_setting('campus_duo.fixture_slot_5')::uuid, current_setting('campus_duo.fixture_slot_6')::uuid,
        current_setting('campus_duo.fixture_slot_7')::uuid, current_setting('campus_duo.fixture_slot_8')::uuid,
        current_setting('campus_duo.fixture_slot_9')::uuid, current_setting('campus_duo.fixture_slot_10')::uuid,
        current_setting('campus_duo.fixture_slot_11')::uuid, current_setting('campus_duo.fixture_slot_12')::uuid
    ]) AND table_id = current_setting('campus_duo.fixture_table_id')::uuid
      AND location_id = current_setting('campus_duo.fixture_location_id')::uuid
      AND local_date = current_setting('campus_duo.fixture_test_date')::date) <> 12 THEN
        RAISE EXCEPTION 'Fixture ownership could not be established; cleanup remains unauthorized.';
    END IF;
END
$fail_closed$;

ROLLBACK;
