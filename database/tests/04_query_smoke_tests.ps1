[CmdletBinding()]
param(
    [switch] $Execute,
    [string] $PsqlPath = 'psql.exe',
    [string] $DbHost = 'localhost',
    [int] $Port = 5432,
    [string] $Database = 'campus_duo_dev',
    [string] $User = 'campus_duo_migrator'
)

$ErrorActionPreference = 'Stop'
$queryRoot = Join-Path $PSScriptRoot '..\queries'
$tempSql = Join-Path ([System.IO.Path]::GetTempPath()) ("campus-duo-db06-readonly-assertions-{0}.sql" -f [guid]::NewGuid())
$alex = "'00000000-0000-0000-0000-00000000D501'::uuid"
$sam = "'00000000-0000-0000-0000-00000000D502'::uuid"
$jordan = "'00000000-0000-0000-0000-00000000D503'::uuid"
$location = "'00000000-0000-0000-0000-00000000D571'::uuid"
$booking581 = "'00000000-0000-0000-0000-00000000D581'::uuid"
$booking582 = "'00000000-0000-0000-0000-00000000D582'::uuid"
$connection561 = "'00000000-0000-0000-0000-00000000D561'::uuid"
$notification = "'00000000-0000-0000-0000-00000000D5A1'::uuid"

function Get-QueryBody([string] $path) {
    $text = Get-Content -Raw -LiteralPath $path
    $text = [regex]::Replace($text, '(?m)^\s*--.*\r?\n', '')
    $text = $text.Trim()
    if ($text.EndsWith(';')) { $text = $text.Substring(0, $text.Length - 1).TrimEnd() }
    if ($text -match ';') { throw "Query template contains more than one statement: $path" }
    return $text
}

function New-Case(
    [string] $name,
    [string] $file,
    [string] $types,
    [object[]] $arguments,
    [string] $predicate
) {
    [pscustomobject]@{
        Name = $name
        File = $file
        Types = $types
        Arguments = $arguments
        Predicate = $predicate
    }
}

function Copy-Arguments([object[]] $arguments, [int] $position, [string] $value) {
    $copy = @($arguments)
    $copy[$position - 1] = $value
    return $copy
}

function Register-Identifier(
    [hashtable] $registry,
    [string] $kind,
    [string] $identifier
) {
    if ([string]::IsNullOrWhiteSpace($identifier)) {
        throw "$kind identifier must not be empty."
    }
    if ($identifier -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "$kind identifier '$identifier' contains unsupported characters."
    }
    if ([System.Text.Encoding]::UTF8.GetByteCount($identifier) -gt 63) {
        throw "$kind identifier '$identifier' exceeds PostgreSQL's 63-byte limit."
    }
    if ($registry.ContainsKey($identifier)) {
        throw "Duplicate $kind identifier '$identifier'."
    }
    $registry[$identifier] = $true
}

function Add-PreparedAssertion(
    [System.Collections.Generic.List[string]] $lines,
    [pscustomobject] $test,
    [hashtable] $assertionRegistry,
    [hashtable] $preparedRegistry,
    [hashtable] $prefixRegistry
) {
    Register-Identifier $assertionRegistry 'assertion' $test.Name
    $body = Get-QueryBody (Join-Path $queryRoot $test.File)
    if ($body -match '(?im)^\s*(INSERT|UPDATE|DELETE|GRANT|CREATE\s+ROLE|DROP|ALTER|TRUNCATE)\b') {
        throw "Unsafe statement in $($test.File)."
    }
    $preparedName = "assert_$($test.Name)"
    $prefix = "result_$($test.Name)_"
    Register-Identifier $preparedRegistry 'prepared statement' $preparedName
    Register-Identifier $prefixRegistry 'result prefix' $prefix
    $args = $test.Arguments -join ', '
    $lines.Add("PREPARE $preparedName($($test.Types)) AS")
    $lines.Add("WITH source_rows AS (")
    $lines.Add($body)
    $lines.Add("), assertion AS (")
    $lines.Add("    SELECT ($($test.Predicate)) IS TRUE AS passed")
    $lines.Add(")")
    $lines.Add("SELECT passed FROM assertion;")
    $lines.Add("EXECUTE $preparedName($args) \gset $prefix")
    $lines.Add("\if :${prefix}passed")
    $lines.Add("\echo 'PASS: $($test.Name)'")
    $lines.Add("\else")
    $lines.Add("\echo 'FAIL: $($test.Name)'")
    $lines.Add("DO `$`$ BEGIN RAISE EXCEPTION 'DB-06 assertion failed: $($test.Name)'; END `$`$;")
    $lines.Add("\endif")
}

function Add-PreparedExecution(
    [System.Collections.Generic.List[string]] $lines,
    [string] $name,
    [string] $file,
    [string] $types,
    [object[]] $arguments,
    [hashtable] $preparedRegistry
) {
    Register-Identifier $preparedRegistry 'prepared statement' $name
    $body = Get-QueryBody (Join-Path $queryRoot $file)
    $args = $arguments -join ', '
    $lines.Add("PREPARE $name($types) AS")
    $lines.Add($body + ';')
    $lines.Add("EXECUTE $name($args);")
}

try {
    $cases = [System.Collections.Generic.List[object]]::new()
    $assertionRegistry = @{}
    $preparedRegistry = @{}
    $prefixRegistry = @{}
    $cases.Add((New-Case 'private_profile' '01_private_account_profile.sql' 'uuid' @($alex) "(SELECT count(*) FROM source_rows) = 1 AND (SELECT user_id FROM source_rows) = $alex AND (SELECT profile_version FROM source_rows) = 1 AND (SELECT jsonb_array_length(courses) FROM source_rows) = 1 AND (SELECT courses @> jsonb_build_array(jsonb_build_object('courseId', '00000000-0000-0000-0000-00000000D511'::uuid)) FROM source_rows) AND (SELECT jsonb_array_length(social_interests) FROM source_rows) = 1 AND (SELECT social_interests @> jsonb_build_array(jsonb_build_object('interestId', '00000000-0000-0000-0000-00000000D521'::uuid)) FROM source_rows) AND (SELECT consents -> 'STUDY' ->> 'hasConsent' FROM source_rows) = 'true' AND (SELECT consents -> 'SOCIAL' ->> 'hasConsent' FROM source_rows) = 'false'"))
    $cases.Add((New-Case 'consent_study' '02_consent.sql' 'uuid,text' @($alex, "'STUDY'::text") "(SELECT count(*) FROM source_rows) = 1 AND (SELECT user_id FROM source_rows) = $alex AND (SELECT mode FROM source_rows) = 'STUDY' AND (SELECT has_consent FROM source_rows) = true"))
    $cases.Add((New-Case 'consent_social' '02_consent.sql' 'uuid,text' @($alex, "'SOCIAL'::text") "(SELECT count(*) FROM source_rows) = 1 AND (SELECT has_consent FROM source_rows) = false"))
    $cases.Add((New-Case 'study_candidates' '03_study_candidates.sql' 'uuid,text,text,text,text,integer,uuid' @($alex, 'NULL::text', 'NULL::text', 'NULL::text', 'NULL::text', '50', 'NULL::uuid') "(SELECT count(*) FROM source_rows) = (SELECT count(DISTINCT user_id) FROM source_rows) AND NOT EXISTS (SELECT 1 FROM source_rows WHERE user_id = $alex) AND EXISTS (SELECT 1 FROM source_rows WHERE user_id = $sam) AND EXISTS (SELECT 1 FROM source_rows WHERE user_id = $jordan)"))
    $cases.Add((New-Case 'social_candidates_no_consent' '04_social_candidates.sql' 'uuid,text,text,integer,uuid' @($alex, 'NULL::text', 'NULL::text', '50', 'NULL::uuid') "(SELECT count(*) FROM source_rows) = 0"))
    $cases.Add((New-Case 'connections_alex' '05_connections.sql' 'uuid,text,integer,timestamptz,uuid' @($alex, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE connection_id = $connection561) = 1"))
    $cases.Add((New-Case 'connections_sam' '05_connections.sql' 'uuid,text,integer,timestamptz,uuid' @($sam, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE connection_id = $connection561) = 1"))
    $cases.Add((New-Case 'connections_jordan' '05_connections.sql' 'uuid,text,integer,timestamptz,uuid' @($jordan, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE connection_id = $connection561) = 0"))
    $cases.Add((New-Case 'availability' '06_resource_availability.sql' 'date,date,uuid,integer' @('CURRENT_DATE - 365', 'CURRENT_DATE + 365', $location, '100') "(SELECT count(*) FROM source_rows WHERE slot_id = '00000000-0000-0000-0000-00000000D574'::uuid AND reserved_count = 2) = 1 AND (SELECT count(*) FROM source_rows WHERE slot_id IN ('00000000-0000-0000-0000-00000000D575'::uuid, '00000000-0000-0000-0000-00000000D576'::uuid) AND reserved_count = 0) = 2"))
    $participantPredicate = "(SELECT count(*) FROM source_rows WHERE booking_id = $booking581 AND status = 'CONFIRMED' AND jsonb_array_length(participants) = 2 AND participants @> jsonb_build_array(jsonb_build_object('userId', $alex::text, 'role', 'CREATOR')) AND participants @> jsonb_build_array(jsonb_build_object('userId', $sam::text, 'role', 'COMPANION'))) = 1 AND (SELECT count(*) FROM source_rows WHERE booking_id = $booking582 AND status = 'CANCELLED' AND jsonb_array_length(participants) = 2) = 1"
    $cases.Add((New-Case 'bookings_alex' '07_booking_history.sql' 'uuid,uuid,integer,timestamptz,uuid' @($alex, 'NULL::uuid', '50', 'NULL::timestamptz', 'NULL::uuid') $participantPredicate))
    $cases.Add((New-Case 'bookings_sam' '07_booking_history.sql' 'uuid,uuid,integer,timestamptz,uuid' @($sam, 'NULL::uuid', '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE booking_id IN ($booking581, $booking582)) = 2 AND (SELECT count(*) FROM source_rows WHERE booking_id = $booking581 AND jsonb_array_length(participants) = 2) = 1"))
    $cases.Add((New-Case 'booking_jordan_581' '07_booking_history.sql' 'uuid,uuid,integer,timestamptz,uuid' @($jordan, $booking581, '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows) = 0"))
    $cases.Add((New-Case 'booking_jordan_582' '07_booking_history.sql' 'uuid,uuid,integer,timestamptz,uuid' @($jordan, $booking582, '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows) = 0"))
    $cases.Add((New-Case 'notifications_alex' '08_notifications.sql' 'uuid,boolean,text,integer,timestamptz,uuid' @($alex, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE notification_id = $notification) = 1"))
    $cases.Add((New-Case 'notifications_sam' '08_notifications.sql' 'uuid,boolean,text,integer,timestamptz,uuid' @($sam, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE notification_id = $notification) = 0"))
    $cases.Add((New-Case 'notifications_jordan' '08_notifications.sql' 'uuid,boolean,text,integer,timestamptz,uuid' @($jordan, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') "(SELECT count(*) FROM source_rows WHERE notification_id = $notification) = 0"))
    $cases.Add((New-Case 'unread_count_alex' '08_notification_unread_count.sql' 'uuid' @($alex) "(SELECT count(*) FROM source_rows) = 1 AND (SELECT unread_count FROM source_rows) = 1"))
    $cases.Add((New-Case 'admin_resource_summary' '10_admin_resource_summary.sql' 'date,integer' @('CURRENT_DATE', '100') "(SELECT count(*) FROM source_rows WHERE location_id = $location AND table_count = 2 AND future_confirmed_bookings = 1) = 1"))

    $limitCases = @(
        @{ Name = 'study_candidates'; File = '03_study_candidates.sql'; Types = 'uuid,text,text,text,text,integer,uuid'; Arguments = @($alex, 'NULL::text', 'NULL::text', 'NULL::text', 'NULL::text', '50', 'NULL::uuid'); Position = 6; Maximum = 50 },
        @{ Name = 'social_candidates'; File = '04_social_candidates.sql'; Types = 'uuid,text,text,integer,uuid'; Arguments = @($alex, 'NULL::text', 'NULL::text', '50', 'NULL::uuid'); Position = 4; Maximum = 50 },
        @{ Name = 'connections'; File = '05_connections.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Arguments = @($alex, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 3; Maximum = 50 },
        @{ Name = 'availability'; File = '06_resource_availability.sql'; Types = 'date,date,uuid,integer'; Arguments = @('CURRENT_DATE - 365', 'CURRENT_DATE + 365', $location, '100'); Position = 4; Maximum = 100 },
        @{ Name = 'bookings'; File = '07_booking_history.sql'; Types = 'uuid,uuid,integer,timestamptz,uuid'; Arguments = @($alex, 'NULL::uuid', '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 3; Maximum = 50 },
        @{ Name = 'notifications'; File = '08_notifications.sql'; Types = 'uuid,boolean,text,integer,timestamptz,uuid'; Arguments = @($alex, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 4; Maximum = 50 },
        @{ Name = 'receipts'; File = '09_report_receipts.sql'; Types = 'uuid,integer,timestamptz,uuid'; Arguments = @($alex, '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 2; Maximum = 50 },
        @{ Name = 'admin_reports'; File = '10_admin_reads.sql'; Types = 'text,integer,timestamptz,uuid'; Arguments = @('NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 2; Maximum = 50 },
        @{ Name = 'admin_resources'; File = '10_admin_resource_summary.sql'; Types = 'date,integer'; Arguments = @('CURRENT_DATE', '100'); Position = 2; Maximum = 100 },
        @{ Name = 'audit'; File = '11_admin_audit.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Arguments = @('NULL::uuid', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); Position = 3; Maximum = 50 }
    )

    $cursorCases = @(
        @{ Name = 'connections'; File = '05_connections.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Arguments = @($alex, "'STUDY'::text", '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 4; UuidPosition = 5 },
        @{ Name = 'bookings'; File = '07_booking_history.sql'; Types = 'uuid,uuid,integer,timestamptz,uuid'; Arguments = @($alex, 'NULL::uuid', '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 4; UuidPosition = 5 },
        @{ Name = 'notifications'; File = '08_notifications.sql'; Types = 'uuid,boolean,text,integer,timestamptz,uuid'; Arguments = @($alex, 'false', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 5; UuidPosition = 6 },
        @{ Name = 'receipts'; File = '09_report_receipts.sql'; Types = 'uuid,integer,timestamptz,uuid'; Arguments = @($alex, '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 3; UuidPosition = 4 },
        @{ Name = 'admin_reports'; File = '10_admin_reads.sql'; Types = 'text,integer,timestamptz,uuid'; Arguments = @('NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 3; UuidPosition = 4 },
        @{ Name = 'audit'; File = '11_admin_audit.sql'; Types = 'uuid,text,integer,timestamptz,uuid'; Arguments = @('NULL::uuid', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid'); TimestampPosition = 4; UuidPosition = 5 }
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add('\set ON_ERROR_STOP on')
    $lines.Add('BEGIN TRANSACTION READ ONLY;')
    $lines.Add('SET LOCAL search_path = campus_duo, public;')
    $lines.Add('\echo ''DB-06 read-only prepared result assertions starting.''')

    foreach ($case in $cases) {
        Add-PreparedAssertion $lines $case $assertionRegistry $preparedRegistry $prefixRegistry
    }

    foreach ($limit in $limitCases) {
        foreach ($value in @('NULL::integer', '0', '-1', "$($limit.Maximum + 1)")) {
            $args = Copy-Arguments $limit.Arguments $limit.Position $value
            $predicate = "(SELECT count(*) FROM source_rows) = 0"
            Add-PreparedAssertion $lines (New-Case "limit_$($limit.Name)_$($value -replace '[^A-Za-z0-9]', '_')" $limit.File $limit.Types $args $predicate) $assertionRegistry $preparedRegistry $prefixRegistry
        }
    }

    foreach ($cursor in $cursorCases) {
        $timestampNull = Copy-Arguments $cursor.Arguments $cursor.TimestampPosition 'NULL::timestamptz'
        $timestampNull = Copy-Arguments $timestampNull $cursor.UuidPosition $connection561
        $timestampCaseName = "cursor_$($cursor.Name)_timestamp_null"
        Add-PreparedAssertion $lines (New-Case $timestampCaseName $cursor.File $cursor.Types $timestampNull "(SELECT count(*) FROM source_rows) = 0") $assertionRegistry $preparedRegistry $prefixRegistry
        $uuidNull = Copy-Arguments $cursor.Arguments $cursor.TimestampPosition "'2000-01-01 00:00:00+00'::timestamptz"
        $uuidNull = Copy-Arguments $uuidNull $cursor.UuidPosition 'NULL::uuid'
        $uuidCaseName = "cursor_$($cursor.Name)_uuid_null"
        Add-PreparedAssertion $lines (New-Case $uuidCaseName $cursor.File $cursor.Types $uuidNull "(SELECT count(*) FROM source_rows) = 0") $assertionRegistry $preparedRegistry $prefixRegistry
    }

    if ($assertionRegistry.Count -ne 70) {
        throw "Expected exactly 70 assertions, generated $($assertionRegistry.Count)."
    }
    if (($cases | Measure-Object).Count -ne 18) {
        throw "Expected exactly 18 positive assertions, generated $(($cases | Measure-Object).Count)."
    }
    $limitAssertionCount = @($assertionRegistry.Keys | Where-Object { $_ -like 'limit_*' }).Count
    if ($limitAssertionCount -ne 40) {
        throw 'Expected exactly 40 limit-boundary assertions.'
    }
    $cursorAssertionCount = @($assertionRegistry.Keys | Where-Object { $_ -like 'cursor_*' }).Count
    if ($cursorAssertionCount -ne 12) {
        throw 'Expected exactly 12 incomplete-cursor assertions.'
    }

    Add-PreparedExecution $lines 'parse_report_receipts' '09_report_receipts.sql' 'uuid,integer,timestamptz,uuid' @($alex, '50', 'NULL::timestamptz', 'NULL::uuid') $preparedRegistry
    Add-PreparedExecution $lines 'parse_admin_reports' '10_admin_reads.sql' 'text,integer,timestamptz,uuid' @('NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') $preparedRegistry
    Add-PreparedExecution $lines 'parse_admin_audit' '11_admin_audit.sql' 'uuid,text,integer,timestamptz,uuid' @('NULL::uuid', 'NULL::text', '50', 'NULL::timestamptz', 'NULL::uuid') $preparedRegistry
    $lines.Add('\echo ''Report/audit parse-binding executed; nonempty projection/redaction assertions remain pending until fixtures exist.''')
    $lines.Add('ROLLBACK;')
    $lines.Add('\echo ''DB-06 read-only prepared result assertions completed.''')

    Set-Content -LiteralPath $tempSql -Value ($lines -join [Environment]::NewLine) -Encoding utf8
    if (-not $Execute) {
        Write-Output "Read-only prepared result assertion SQL assembled successfully: $($assertionRegistry.Count) assertions ($($cases.Count) positive, $limitAssertionCount limit-boundary, $cursorAssertionCount incomplete-cursor); unique prepared statements=$($preparedRegistry.Count), unique result prefixes=$($prefixRegistry.Count); database execution was not run."
    }
    else {
        & $PsqlPath -X -W -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database -f $tempSql
        if ($LASTEXITCODE -ne 0) {
            throw "DB-06 read-only assertion suite failed with exit code $LASTEXITCODE."
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempSql) {
        Remove-Item -LiteralPath $tempSql -Force
    }
}
