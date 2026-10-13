[CmdletBinding()]
param(
    [switch] $Execute,
    [string] $PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
    [string] $DbHost = 'localhost',
    [int] $Port = 5432,
    [string] $Database = 'campus_duo_dev'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$databaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$queryRoot = Join-Path $databaseRoot 'queries'
$commonChecks = Join-Path $PSScriptRoot '05_access_privileges.sql'
$requiredFiles = @($commonChecks, (Join-Path $queryRoot '01_private_account_profile.sql'),
    (Join-Path $queryRoot '10_admin_reads.sql'), (Join-Path $queryRoot '10_admin_resource_summary.sql'),
    (Join-Path $queryRoot '11_admin_audit.sql'), (Join-Path $queryRoot '12_worker_outbox.sql'),
    (Join-Path $PSScriptRoot '07_db07_fixture_setup.sql'),
    (Join-Path $PSScriptRoot '08_db07_fixture_cleanup.sql'))
$tempFiles = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
    throw "psql executable was not found: $PsqlPath"
}
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required DB-07 file was not found: $file" }
}

function Get-QueryBody([string] $path) {
    $text = (Get-Content -Raw -LiteralPath $path).Trim()
    $text = [regex]::Replace($text, '(?m)^\s*--.*\r?\n', '').Trim()
    if ($text.EndsWith(';')) { $text = $text.Substring(0, $text.Length - 1).TrimEnd() }
    if ($text -match ';') { throw "Query template contains multiple statements: $path" }
    return $text
}

function Add-ActualQuery([System.Collections.Generic.List[string]] $lines, [string] $name, [string] $file,
    [string] $types, [string[]] $arguments) {
    $body = Get-QueryBody (Join-Path $queryRoot $file)
    if ($body -match '(?im)^\s*(INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER|DROP|TRUNCATE)\b') {
        throw "Unsafe statement in source query $file."
    }
    $lines.Add("PREPARE $name($types) AS")
    $lines.Add("$body;")
    $lines.Add("EXECUTE $name($($arguments -join ', '));")
}

function Add-ExpectedDenied([System.Collections.Generic.List[string]] $lines, [string] $name, [string] $sql) {
    $lines.Add("DO `$`$")
    $lines.Add("DECLARE v_state text;")
    $lines.Add("BEGIN")
    $lines.Add("    BEGIN")
    $lines.Add("        $sql")
    $lines.Add("        RAISE EXCEPTION 'DB-07C denied test unexpectedly succeeded: $name';")
    $lines.Add("    EXCEPTION WHEN OTHERS THEN")
    $lines.Add("        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;")
    $lines.Add("        IF v_state <> '42501' THEN")
    $lines.Add("            RAISE EXCEPTION 'DB-07C denial $name returned SQLSTATE %, expected 42501.', v_state;")
    $lines.Add("        END IF;")
    $lines.Add("    END;")
    $lines.Add("END")
    $lines.Add("`$`$;")
}

function Add-Mutation([System.Collections.Generic.List[string]] $lines, [string] $name, [string] $body) {
    $lines.Add("\echo 'ALLOWED MUTATION: $name'")
    $lines.Add("DO `$`$")
    $lines.Add("DECLARE v_count integer; v_value text; v_uuid uuid;")
    $lines.Add("        v_table_id uuid; v_location_id uuid; v_slot_id uuid; v_local_date date;")
    $lines.Add("        v_audit_event_id uuid;")
    $lines.Add("BEGIN")
    $lines.Add($body)
    $lines.Add("END")
    $lines.Add("`$`$;")
}

$alex = "'00000000-0000-0000-0000-00000000D501'::uuid"
$location = "'00000000-0000-0000-0000-00000000D571'::uuid"
$dedicatedReport = "'00000000-0000-0000-0000-00000000D7A1'::uuid"
$dedicatedOutbox = "'00000000-0000-0000-0000-00000000D7B1'::uuid"
$queryCases = @(
    @{ Name = 'private'; File = '01_private_account_profile.sql'; Types = 'uuid'; Args = @($alex) },
    @{ Name = 'consent'; File = '02_consent.sql'; Types = 'uuid,text'; Args = @($alex, "'STUDY'::text") },
    @{ Name = 'study'; File = '03_study_candidates.sql'; Types = 'uuid,text,text,text,text,integer,uuid'; Args = @($alex, 'NULL::text', 'NULL::text', 'NULL::text', 'NULL::text', '50', 'NULL::uuid') },
    @{ Name = 'social'; File = '04_social_candidates.sql'; Types = 'uuid,text,text,integer,uuid'; Args = @($alex, 'NULL::text', 'NULL::text', '50', 'NULL::uuid') },
    @{ Name = 'connections'; File = '05_connections.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Args = @($alex, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid') },
    @{ Name = 'availability'; File = '06_resource_availability.sql'; Types = 'date,date,uuid,integer'; Args = @('CURRENT_DATE - 365', 'CURRENT_DATE + 365', $location, '100') },
    @{ Name = 'bookings'; File = '07_booking_history.sql'; Types = 'uuid,uuid,integer,timestamptz,uuid'; Args = @($alex, 'NULL::uuid', '50', 'NULL::timestamptz', 'NULL::uuid') },
    @{ Name = 'notifications'; File = '08_notifications.sql'; Types = 'uuid,boolean,text,integer,timestamptz,uuid'; Args = @($alex, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') },
    @{ Name = 'unread'; File = '08_notification_unread_count.sql'; Types = 'uuid'; Args = @($alex) },
    @{ Name = 'receipts'; File = '09_report_receipts.sql'; Types = 'uuid,integer,timestamptz,uuid'; Args = @($alex, '50', 'NULL::timestamptz', 'NULL::uuid') }
)

$rolePlans = @(
    @{ Role = 'campus_duo_app'; Queries = $queryCases; Mutations = @(
        @{ Name = 'profile_update'; Body = "UPDATE campus_duo.student_profile SET social_bio = '[DB07] rollback fixture', profile_version = profile_version + 1 WHERE user_id = $alex; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'profile fixture missing or affected %, expected 1', v_count; END IF; SELECT social_bio INTO v_value FROM campus_duo.student_profile WHERE user_id = $alex; IF v_value IS DISTINCT FROM '[DB07] rollback fixture' THEN RAISE EXCEPTION 'profile mutation assertion failed'; END IF;" },
        @{ Name = 'consent_update'; Body = "UPDATE campus_duo.consent_record SET has_consent = true, consented_at = COALESCE(consented_at, clock_timestamp()) WHERE user_id = $alex AND mode = 'STUDY'; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'consent fixture missing or affected %, expected 1', v_count; END IF; SELECT has_consent::text INTO v_value FROM campus_duo.consent_record WHERE user_id = $alex AND mode = 'STUDY'; IF v_value IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent mutation assertion failed'; END IF;" },
        @{ Name = 'profile_course_replacement'; Body = "DELETE FROM campus_duo.profile_course WHERE user_id = $alex AND course_id = '00000000-0000-0000-0000-00000000D511'::uuid; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'course fixture missing or affected %, expected 1', v_count; END IF; INSERT INTO campus_duo.profile_course (user_id, course_id, enrollment_status) VALUES ($alex, '00000000-0000-0000-0000-00000000D511'::uuid, 'ACTIVE'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'course replacement insert failed'; END IF;" },
        @{ Name = 'profile_interest_replacement'; Body = "DELETE FROM campus_duo.profile_interest WHERE user_id = $alex AND interest_id = '00000000-0000-0000-0000-00000000D521'::uuid; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'interest fixture missing or affected %, expected 1', v_count; END IF; INSERT INTO campus_duo.profile_interest (user_id, interest_id) VALUES ($alex, '00000000-0000-0000-0000-00000000D521'::uuid); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'interest replacement insert failed'; END IF;" },
        @{ Name = 'preferred_time_replacement'; Body = "INSERT INTO campus_duo.profile_preferred_time (user_id, time_code) VALUES ($alex, 'LATE_NIGHT'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'preferred-time fixture insert affected %, expected 1', v_count; END IF; DELETE FROM campus_duo.profile_preferred_time WHERE user_id = $alex AND time_code = 'LATE_NIGHT'; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'preferred-time replacement delete affected %, expected 1', v_count; END IF; INSERT INTO campus_duo.profile_preferred_time (user_id, time_code) VALUES ($alex, 'LATE_NIGHT'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'preferred-time replacement insert affected %, expected 1', v_count; END IF;" },
        @{ Name = 'discovery_update'; Body = "IF NOT EXISTS (SELECT 1 FROM campus_duo.discovery_action WHERE action_id = '00000000-0000-0000-0000-00000000D551'::uuid AND actor_user_id = $alex AND target_user_id = '00000000-0000-0000-0000-00000000D502'::uuid AND mode = 'STUDY') THEN RAISE EXCEPTION 'D551 discovery fixture identity mismatch'; END IF; UPDATE campus_duo.discovery_action SET action_type = 'LIKE' WHERE action_id = '00000000-0000-0000-0000-00000000D551'::uuid AND actor_user_id = $alex AND target_user_id = '00000000-0000-0000-0000-00000000D502'::uuid AND mode = 'STUDY'; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'discovery fixture missing or affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.discovery_action WHERE action_id = '00000000-0000-0000-0000-00000000D551'::uuid AND action_type = 'LIKE') THEN RAISE EXCEPTION 'discovery mutation assertion failed'; END IF;" },
        @{ Name = 'connection_update'; Body = "UPDATE campus_duo.connection SET status = 'DISCONNECTED' WHERE connection_id = '00000000-0000-0000-0000-00000000D561'::uuid AND status = 'MUTUAL_CONNECTED'; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'connection fixture missing or already disconnected; affected %, expected 1', v_count; END IF; SELECT status INTO v_value FROM campus_duo.connection WHERE connection_id = '00000000-0000-0000-0000-00000000D561'::uuid; IF v_value IS DISTINCT FROM 'DISCONNECTED' THEN RAISE EXCEPTION 'connection mutation assertion failed'; END IF;" },
        @{ Name = 'booking_successor_insert'; Body = "SELECT slot_id, table_id, location_id, local_date INTO v_slot_id, v_table_id, v_location_id, v_local_date FROM campus_duo.study_slot WHERE slot_id = '00000000-0000-0000-0000-00000000D576'::uuid AND active AND status = 'AVAILABLE'; IF NOT FOUND THEN RAISE EXCEPTION 'D576 successor slot fixture missing'; END IF; UPDATE campus_duo.booking SET status = 'CANCELLED', cancelled_at = clock_timestamp(), cancelled_by = $alex, cancellation_reason = 'RESCHEDULED' WHERE booking_id = '00000000-0000-0000-0000-00000000D581'::uuid AND status = 'CONFIRMED'; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'source booking fixture missing or affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.booking WHERE booking_id = '00000000-0000-0000-0000-00000000D581'::uuid AND status = 'CANCELLED' AND cancellation_reason = 'RESCHEDULED') THEN RAISE EXCEPTION 'source cancellation assertion failed'; END IF; INSERT INTO campus_duo.booking (connection_id, booker_id, table_id, location_id, slot_id, local_date, rescheduled_from_booking_id) VALUES ('00000000-0000-0000-0000-00000000D561'::uuid, $alex, v_table_id, v_location_id, v_slot_id, v_local_date, '00000000-0000-0000-0000-00000000D581'::uuid) RETURNING booking_id INTO v_uuid; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'successor insertion affected %, expected 1', v_count; END IF; INSERT INTO campus_duo.booking_participant (booking_id, user_id, participant_role) VALUES (v_uuid, $alex, 'CREATOR'), (v_uuid, '00000000-0000-0000-0000-00000000D502'::uuid, 'COMPANION'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 2 THEN RAISE EXCEPTION 'successor participant insertion affected %, expected 2', v_count; END IF; IF (SELECT count(*) FROM campus_duo.booking_participant WHERE booking_id = v_uuid) <> 2 THEN RAISE EXCEPTION 'successor participant assertion failed'; END IF;" },
        @{ Name = 'consent_history_append'; Body = "INSERT INTO campus_duo.consent_history (user_id, mode, event_type, has_consent, policy_version, source, occurred_at) VALUES ($alex, 'SOCIAL', 'UPDATED', false, 'db07-test-v1', 'DB-07 rollback fixture', clock_timestamp()); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'consent-history insertion affected %, expected 1', v_count; END IF;" },
        @{ Name = 'notification_read_state'; Body = "UPDATE campus_duo.notification SET is_read = true, read_at = clock_timestamp() WHERE notification_id = '00000000-0000-0000-0000-00000000D5A1'::uuid AND is_read = false; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'notification fixture missing or already read; affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.notification WHERE notification_id = '00000000-0000-0000-0000-00000000D5A1'::uuid AND is_read AND read_at IS NOT NULL) THEN RAISE EXCEPTION 'notification read-state coherence assertion failed'; END IF;" },
        @{ Name = 'report_submission'; Body = "INSERT INTO campus_duo.moderation_report (reporter_user_id, reported_user_id, category, description) VALUES ($alex, '00000000-0000-0000-0000-00000000D502'::uuid, 'OTHER', '[DB07] rollback fixture'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'report insertion failed'; END IF;" },
        @{ Name = 'audit_append'; Body = "INSERT INTO campus_duo.audit_event (actor_user_id, actor_role, action, target_type, target_id, outcome, safe_reason) VALUES ($alex, 'ROLE_STUDENT', 'DB07_TEST', 'USER', $alex, 'SUCCESS', '[DB07] rollback fixture'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'audit insertion failed'; END IF;" },
        @{ Name = 'outbox_insert'; Body = "INSERT INTO campus_duo.outbox_event (event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id) VALUES ('DB07_TEST', 'USER', $alex, 'db07-app-test', '{}'::jsonb, 'db07-app-test'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'outbox insertion failed'; END IF;" },
        @{ Name = 'idempotency_insert_final_outcome'; Body = "INSERT INTO campus_duo.idempotency_record (actor_user_id, operation_type, client_operation_id, request_fingerprint, outcome_status, response_reference) VALUES ($alex, 'CREATE_BOOKING', 'db07-app-idempotency', 'db07-fingerprint', 'SUCCEEDED', jsonb_build_object('bookingId', 'DB07-ROLLBACK')) RETURNING idempotency_id INTO v_uuid; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'idempotency insertion affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.idempotency_record WHERE idempotency_id = v_uuid AND actor_user_id = $alex AND operation_type = 'CREATE_BOOKING' AND client_operation_id = 'db07-app-idempotency' AND request_fingerprint = 'db07-fingerprint' AND outcome_status = 'SUCCEEDED' AND response_reference IS NOT DISTINCT FROM jsonb_build_object('bookingId', 'DB07-ROLLBACK')) THEN RAISE EXCEPTION 'idempotency final-outcome assertion failed'; END IF;" }
    ); Denials = @(
        @{ Name = 'confidential_report_read'; Sql = 'SELECT evidence_reference FROM campus_duo.moderation_report LIMIT 0;' },
        @{ Name = 'admin_moderation_update'; Sql = "UPDATE campus_duo.moderation_report SET status = 'DISMISSED' WHERE false;" },
        @{ Name = 'audit_read'; Sql = 'SELECT details FROM campus_duo.audit_event LIMIT 0;' },
        @{ Name = 'outbox_dispatch_update'; Sql = "UPDATE campus_duo.outbox_event SET status = 'FAILED' WHERE false;" },
        @{ Name = 'booking_delete'; Sql = 'DELETE FROM campus_duo.booking WHERE false;' },
        @{ Name = 'consent_history_update'; Sql = "UPDATE campus_duo.consent_history SET source = 'DB07_DENIED' WHERE false;" },
        @{ Name = 'migration_history_read'; Sql = 'SELECT 1 FROM campus_duo.flyway_schema_history LIMIT 0;' },
        @{ Name = 'schema_create'; Sql = 'CREATE TABLE campus_duo.db07_forbidden_app (id integer);' },
        @{ Name = 'role_switch'; Sql = 'SET ROLE campus_duo_migrator;' }
    ) },
    @{ Role = 'campus_duo_admin_service'; Queries = @(
        @{ Name = 'admin_reports'; File = '10_admin_reads.sql'; Types = 'text,integer,timestamptz,uuid'; Args = @('NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') },
        @{ Name = 'admin_resources'; File = '10_admin_resource_summary.sql'; Types = 'date,integer'; Args = @('CURRENT_DATE', '100') },
        @{ Name = 'admin_audit'; File = '11_admin_audit.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Args = @('NULL::uuid', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') }
    ); Mutations = @(
        @{ Name = 'moderation_review_and_audit_link'; Body = "IF NOT EXISTS (SELECT 1 FROM campus_duo.moderation_report WHERE report_id = $dedicatedReport AND reporter_user_id = $alex AND reported_user_id = '00000000-0000-0000-0000-00000000D502'::uuid AND category = 'OTHER' AND status = 'PENDING_REVIEW' AND audit_event_id IS NULL) THEN RAISE EXCEPTION 'dedicated moderation report fixture identity mismatch'; END IF; INSERT INTO campus_duo.audit_event (actor_role, action, target_type, target_id, outcome, correlation_id, operation_id, safe_reason, retention_class) VALUES ('ROLE_ADMIN', 'DB07_ADMIN_TEST', 'REPORT', $dedicatedReport, 'SUCCESS', 'db07-admin-correlation', 'db07-admin-operation', '[DB07] rollback fixture', 'STANDARD') RETURNING audit_event_id INTO v_audit_event_id; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'admin audit insertion affected %, expected 1', v_count; END IF; UPDATE campus_duo.moderation_report SET status = 'DISMISSED', reviewed_by = '00000000-0000-0000-0000-00000000D503'::uuid, reviewed_at = clock_timestamp(), review_reason = '[DB07] rollback fixture', audit_event_id = v_audit_event_id WHERE report_id = $dedicatedReport AND status = 'PENDING_REVIEW' AND audit_event_id IS NULL; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'dedicated moderation report update affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.moderation_report WHERE report_id = $dedicatedReport AND status = 'DISMISSED' AND audit_event_id = v_audit_event_id) THEN RAISE EXCEPTION 'moderation audit linkage assertion failed'; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.audit_event WHERE audit_event_id = v_audit_event_id AND actor_role = 'ROLE_ADMIN' AND action = 'DB07_ADMIN_TEST' AND target_type = 'REPORT' AND target_id = $dedicatedReport AND outcome = 'SUCCESS' AND safe_reason = '[DB07] rollback fixture') THEN RAISE EXCEPTION 'safe audit projection assertion failed'; END IF;" },
        @{ Name = 'resource_update'; Body = "UPDATE campus_duo.study_location SET active = NOT active WHERE location_id = '00000000-0000-0000-0000-00000000D571'::uuid; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'resource fixture missing or affected %, expected 1', v_count; END IF;" },
        @{ Name = 'audit_append'; Body = "INSERT INTO campus_duo.audit_event (actor_role, action, target_type, target_id, outcome, safe_reason) VALUES ('ROLE_ADMIN', 'DB07_ADMIN_TEST', 'RESOURCE', '00000000-0000-0000-0000-00000000D571'::uuid, 'SUCCESS', '[DB07] rollback fixture'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'admin audit insertion failed'; END IF;" },
        @{ Name = 'admin_outbox_insert'; Body = "INSERT INTO campus_duo.outbox_event (event_type, aggregate_type, aggregate_id, dedupe_key, payload, correlation_id) VALUES ('DB07_ADMIN_TEST', 'RESOURCE', '00000000-0000-0000-0000-00000000D571'::uuid, 'db07-admin-test', '{}'::jsonb, 'db07-admin-test'); GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'admin outbox insertion failed'; END IF;" }
    ); Denials = @(
        @{ Name = 'audit_details_read'; Sql = 'SELECT details FROM campus_duo.audit_event LIMIT 0;' },
        @{ Name = 'booking_delete'; Sql = 'DELETE FROM campus_duo.booking WHERE false;' },
        @{ Name = 'migration_history_read'; Sql = 'SELECT 1 FROM campus_duo.flyway_schema_history LIMIT 0;' },
        @{ Name = 'schema_create'; Sql = 'CREATE TABLE campus_duo.db07_forbidden_admin (id integer);' },
        @{ Name = 'role_switch'; Sql = 'SET ROLE campus_duo_migrator;' }
    ) },
    @{ Role = 'campus_duo_worker'; Queries = @(
        @{ Name = 'outbox'; File = '12_worker_outbox.sql'; Types = 'integer'; Args = @('100') }
    ); Mutations = @(
        @{ Name = 'dispatch_retry_update'; Body = "IF NOT EXISTS (SELECT 1 FROM campus_duo.outbox_event WHERE outbox_event_id = $dedicatedOutbox AND event_type = 'DB07_FIXTURE' AND aggregate_type = 'USER' AND aggregate_id = $alex AND dedupe_key = 'db07-fixture-outbox' AND status = 'PENDING' AND attempts = 0 AND next_attempt_at IS NULL AND dispatched_at IS NULL) THEN RAISE EXCEPTION 'dedicated outbox fixture identity mismatch'; END IF; UPDATE campus_duo.outbox_event SET attempts = attempts + 1, next_attempt_at = clock_timestamp() + interval '1 minute' WHERE outbox_event_id = $dedicatedOutbox AND status = 'PENDING' AND attempts = 0; GET DIAGNOSTICS v_count = ROW_COUNT; IF v_count <> 1 THEN RAISE EXCEPTION 'dedicated dispatch fixture affected %, expected 1', v_count; END IF; IF NOT EXISTS (SELECT 1 FROM campus_duo.outbox_event WHERE outbox_event_id = $dedicatedOutbox AND attempts = 1 AND next_attempt_at IS NOT NULL AND dispatched_at IS NULL) THEN RAISE EXCEPTION 'dispatch retry assertion failed'; END IF;" }
    ); Denials = @(
        @{ Name = 'payload_update'; Sql = "UPDATE campus_duo.outbox_event SET payload = '{}'::jsonb WHERE false;" },
        @{ Name = 'business_write'; Sql = "UPDATE campus_duo.booking SET status = 'CANCELLED' WHERE false;" },
        @{ Name = 'audit_update'; Sql = "UPDATE campus_duo.audit_event SET safe_reason = 'DB07_DENIED' WHERE false;" },
        @{ Name = 'audit_delete'; Sql = 'DELETE FROM campus_duo.audit_event WHERE false;' },
        @{ Name = 'audit_truncate'; Sql = 'TRUNCATE campus_duo.audit_event;' },
        @{ Name = 'migration_history_read'; Sql = 'SELECT 1 FROM campus_duo.flyway_schema_history LIMIT 0;' },
        @{ Name = 'role_switch'; Sql = 'SET ROLE campus_duo_migrator;' }
    ) }
)

try {
    foreach ($plan in $rolePlans) {
        $lines = [System.Collections.Generic.List[string]]::new()
        $lines.Add('\set ON_ERROR_STOP on')
        $lines.Add('BEGIN;')
        $lines.Add('SET LOCAL search_path = campus_duo, public;')
        $lines.Add("DO `$`$ BEGIN IF current_database() <> 'campus_duo_dev' OR current_user <> '$($plan.Role)' THEN RAISE EXCEPTION 'wrong runtime target or login'; END IF; END `$`$;")
        $lines.Add("\echo 'DB-07C access tests for $($plan.Role)'")
        $lines.Add("\ir '$($commonChecks -replace '\\','/')'")
        foreach ($query in $plan.Queries) { Add-ActualQuery $lines "q_$($query.Name)" $query.File $query.Types $query.Args }
        foreach ($mutation in $plan.Mutations) { Add-Mutation $lines $mutation.Name $mutation.Body }
        foreach ($denial in $plan.Denials) { Add-ExpectedDenied $lines $denial.Name $denial.Sql }
        $lines.Add('ROLLBACK;')
        $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("campus-duo-db07-$($plan.Role)-{0}.sql" -f [guid]::NewGuid())
        $tempFiles.Add($temp)
        Set-Content -LiteralPath $temp -Value ($lines -join [Environment]::NewLine) -Encoding utf8
        if ($Execute) {
            & $PsqlPath -X -W -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $plan.Role -d $Database -f $temp
            if ($LASTEXITCODE -ne 0) { throw "DB-07C access test for $($plan.Role) failed with exit code $LASTEXITCODE." }
            Write-Output "PASS: $($plan.Role) access suite"
        }
    }
    if (-not $Execute) { Write-Output 'DB-07C access-test scripts assembled; runtime execution was not run.' }
    else { Write-Output 'PASS: DB-07C all runtime-role suites completed.' }
}
finally {
    foreach ($temp in $tempFiles) { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
}
