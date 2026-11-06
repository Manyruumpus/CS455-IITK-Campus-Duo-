\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

SELECT 'session' AS check_name,
       current_database() AS database_name,
       session_user,
       current_user,
       host(inet_server_addr()) AS server_address,
       inet_server_port() AS server_port;

SELECT 'schema_usage' AS check_name,
       has_schema_privilege(current_user, 'campus_duo', 'USAGE') AS allowed;

SELECT 'relation_identity' AS check_name,
       n.nspname AS schema_name,
       c.relname AS relation_name,
       c.oid::regclass::text AS relation_identity,
       c.relkind,
       pg_get_userbyid(c.relowner) AS relation_owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'campus_duo'
   AND c.relname IN ('study_location', 'study_table', 'study_slot', 'booking')
 ORDER BY c.relname;

SELECT 'table_select_study_location' AS check_name,
       has_table_privilege(current_user, 'campus_duo.study_location', 'SELECT') AS allowed;
SELECT 'table_select_study_table' AS check_name,
       has_table_privilege(current_user, 'campus_duo.study_table', 'SELECT') AS allowed;
SELECT 'table_select_study_slot' AS check_name,
       has_table_privilege(current_user, 'campus_duo.study_slot', 'SELECT') AS allowed;
SELECT 'table_select_booking' AS check_name,
       has_table_privilege(current_user, 'campus_duo.booking', 'SELECT') AS allowed;

SELECT 'column_select_study_location_location_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_location', 'location_id', 'SELECT') AS allowed;
SELECT 'column_select_study_location_name' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_location', 'name', 'SELECT') AS allowed;
SELECT 'column_select_study_location_building' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_location', 'building', 'SELECT') AS allowed;
SELECT 'column_select_study_location_active' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_location', 'active', 'SELECT') AS allowed;

SELECT 'column_select_study_table_table_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_table', 'table_id', 'SELECT') AS allowed;
SELECT 'column_select_study_table_location_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_table', 'location_id', 'SELECT') AS allowed;
SELECT 'column_select_study_table_table_number' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_table', 'table_number', 'SELECT') AS allowed;
SELECT 'column_select_study_table_capacity' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_table', 'capacity', 'SELECT') AS allowed;
SELECT 'column_select_study_table_active' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_table', 'active', 'SELECT') AS allowed;

SELECT 'column_select_study_slot_slot_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'slot_id', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_location_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'location_id', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_table_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'table_id', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_local_date' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'local_date', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_start_time' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'start_time', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_end_time' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'end_time', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_zone' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'zone', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_status' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'status', 'SELECT') AS allowed;
SELECT 'column_select_study_slot_active' AS check_name,
       has_column_privilege(current_user, 'campus_duo.study_slot', 'active', 'SELECT') AS allowed;

SELECT 'column_select_booking_booking_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.booking', 'booking_id', 'SELECT') AS allowed;
SELECT 'column_select_booking_table_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.booking', 'table_id', 'SELECT') AS allowed;
SELECT 'column_select_booking_local_date' AS check_name,
       has_column_privilege(current_user, 'campus_duo.booking', 'local_date', 'SELECT') AS allowed;
SELECT 'column_select_booking_slot_id' AS check_name,
       has_column_privilege(current_user, 'campus_duo.booking', 'slot_id', 'SELECT') AS allowed;
SELECT 'column_select_booking_status' AS check_name,
       has_column_privilege(current_user, 'campus_duo.booking', 'status', 'SELECT') AS allowed;

SELECT 'role_membership' AS check_name,
       member.rolname AS member_role,
       granted.rolname AS granted_role,
       m.admin_option
  FROM pg_auth_members m
  JOIN pg_roles member ON member.oid = m.member
  JOIN pg_roles granted ON granted.oid = m.roleid
 WHERE member.rolname = current_user
 ORDER BY granted.rolname;

ROLLBACK;
