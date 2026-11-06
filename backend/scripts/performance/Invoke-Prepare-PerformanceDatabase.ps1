[CmdletBinding()]
param(
    [ValidateSet('campus_duo_perf_20261103')]
    [string] $PerformanceDatabase = 'campus_duo_perf_20261103',

    [switch] $ResumePartialTarget,

    [switch] $ResumeInitializedEmptyHistory,

    [switch] $VerifyExistingTarget,

    [string] $FlywayPath,

    [string] $PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$psqlInfo = Get-Item -LiteralPath $PsqlPath -ErrorAction Stop
if (-not $psqlInfo.PSIsContainer -and $psqlInfo.Extension -eq '.exe') {
    $psql = $psqlInfo.FullName
} else {
    throw "PostgreSQL executable path is not a file: $PsqlPath"
}
$node = Get-Command node -ErrorAction Stop
$flyway = if ($FlywayPath) {
    (Resolve-Path -LiteralPath $FlywayPath -ErrorAction Stop).Path
} else {
    (Get-Command flyway -ErrorAction Stop).Source
}
. (Join-Path $PSScriptRoot 'PerformanceProvisioningHelpers.ps1')
$migrationPath = Resolve-PerformanceMigrationPath $PSScriptRoot
$databaseRoot = (Resolve-Path (Join-Path $migrationPath '..')).Path
$flywayConfigPath = Join-Path $databaseRoot 'config\flyway.toml'

$migratorPassword = $null
$adminPassword = $null
$appPassword = $null
$appSecret = $null
$migrationFiles = @()
$expectedMigrationVersions = @()
$requiredApplicationTables = @(
    'user_account', 'student_profile', 'profile_preferred_time', 'course',
    'profile_course', 'social_interest', 'profile_interest', 'consent_record',
    'consent_history', 'discovery_action', 'connection', 'block',
    'study_location', 'study_table', 'study_slot', 'booking',
    'booking_participant', 'idempotency_record', 'notification',
    'moderation_report', 'audit_event', 'outbox_event'
)
$previous = @{}
foreach ($name in @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'FLYWAY_PASSWORD')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Restore-Environment {
    foreach ($name in $previous.Keys) {
        if ($null -eq $previous[$name]) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        } else {
            Set-Item "Env:$name" $previous[$name]
        }
    }
}

function Reveal-Secret([Security.SecureString] $value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Set-PsqlEnvironment([string] $database, [string] $user, [string] $password) {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = $database
    $env:PGUSER = $user
    $env:PGPASSWORD = $password
}

function Invoke-PsqlChecked(
    [string] $Operation,
    [string[]] $Arguments
) {
    & $psql @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Operation failed with psql exit code $exitCode. Preserve the database and review the preceding PostgreSQL error."
    }
}

function Get-PsqlScalar(
    [string] $Operation,
    [string] $Query
) {
    $output = & $psql -X -At -v ON_ERROR_STOP=1 -c $Query
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Operation failed with psql exit code $exitCode. Preserve the database and review the preceding PostgreSQL error."
    }
    if ($null -eq $output) {
        throw "$Operation returned no result; refusing to continue."
    }
    $value = ($output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Operation returned an empty result; refusing to continue."
    }
    return $value
}

function Get-PsqlScalarAllowEmpty(
    [string] $Operation,
    [string] $Query
) {
    $output = & $psql -X -At -v ON_ERROR_STOP=1 -c $Query
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Operation failed with psql exit code $exitCode. Preserve the database and review the preceding PostgreSQL error."
    }
    if ($null -eq $output) {
        throw "$Operation returned no result; refusing to continue."
    }
    return ($output -join "`n").Trim()
}

function Assert-Scalar([string] $Operation, [string] $Actual, [string] $Expected) {
    if ($Actual -ne $Expected) {
        throw "$Operation mismatch. Expected '$Expected', received '$Actual'."
    }
}

function Get-MigrationInventory {
    $inventory = Get-RequiredVersionedMigrations $migrationPath
    $files = $inventory.Files
    $expected = $inventory.Versions
    Write-Output "Migration directory: $migrationPath"
    Write-Output "Discovered versioned migrations ($($files.Count)):"
    $files | ForEach-Object { Write-Output "  $($_.Name)" }
    $script:migrationFiles = $files
    $script:expectedMigrationVersions = $expected
}

function Assert-MigrationCompletion {
    $historyJson = Get-PsqlScalar 'migration history completion' @"
SELECT COALESCE(json_agg(json_build_object(
    'version', version::text,
    'success', success
) ORDER BY installed_rank)::text, '[]')
  FROM campus_duo.flyway_schema_history;
"@
    try { $historyEntries = @($historyJson | ConvertFrom-Json) } catch {
        throw "Migration history completion returned malformed JSON: $($_.Exception.Message)"
    }
    $missingTables = Get-PsqlScalarAllowEmpty 'required application table check' @"
WITH expected(table_name) AS (
    VALUES $(($requiredApplicationTables | ForEach-Object { "('$_')" }) -join ', ')
)
SELECT COALESCE(string_agg(expected.table_name, ',' ORDER BY expected.table_name), '')
  FROM expected
 WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'campus_duo'
      AND c.relname = expected.table_name
      AND c.relkind IN ('r', 'p')
 );
"@
    $result = Test-MigrationCompletionState $historyEntries $expectedMigrationVersions $missingTables
    if (-not $result.Valid) {
        throw "Migration completion check failed: entries=$($result.EntryCount); failed=$(@($result.FailedVersions) -join ','); missing=$(@($result.MissingVersions) -join ','); unexpected=$(@($result.UnexpectedVersions) -join ','); duplicates=$(@($result.DuplicateVersions) -join ','); missingTables=$(@($result.MissingTables) -join ',')."
    }
}

function Write-TargetConfigurationIdentity {
    Write-Output 'Target/configuration identity (credentials omitted):'
    Write-Output "  database=$PerformanceDatabase"
    Write-Output "  migrationDirectory=$migrationPath"
    Write-Output "  flywayConfig=$flywayConfigPath"
    Write-Output "  targetUrl=jdbc:postgresql://127.0.0.1:5432/$PerformanceDatabase"
    Write-Output "  flywayUser=campus_duo_migrator"
    Write-Output "  schema=campus_duo"
    Write-Output "  callerWorkingDirectory=$((Get-Location).Path)"
}

function Invoke-FlywayValidate {
    & $flyway "-configFiles=$flywayConfigPath" `
        "-url=jdbc:postgresql://127.0.0.1:5432/$PerformanceDatabase" `
        '-user=campus_duo_migrator' '-schemas=campus_duo' '-defaultSchema=campus_duo' `
        '-table=flyway_schema_history' '-createSchemas=false' '-failOnMissingLocations=true' `
        "-locations=filesystem:$migrationPath" validate
    $validateExitCode = $LASTEXITCODE
    if ($validateExitCode -ne 0) {
        throw "Flyway validation failed with exit code $validateExitCode. No database changes were requested."
    }
}

function Assert-ApplicationAccess {
    $appSecret = Read-Host 'Enter campus_duo_app password for access verification' -AsSecureString
    if ($null -eq $appSecret) {
        throw 'Application password input was not provided; refusing to continue.'
    }
    $appPassword = Reveal-Secret $appSecret
    $appSecret = $null
    if ([string]::IsNullOrWhiteSpace($appPassword)) {
        throw 'Application password is required for access verification.'
    }
    Set-PsqlEnvironment $PerformanceDatabase 'campus_duo_app' $appPassword
    Assert-Scalar 'application current database' (Get-PsqlScalar 'application identity' 'SELECT current_database();') $PerformanceDatabase
    Assert-Scalar 'application role' (Get-PsqlScalar 'application identity' 'SELECT current_user;') 'campus_duo_app'
    Assert-Scalar 'application server address' (Get-PsqlScalar 'application server address' 'SELECT host(inet_server_addr());') '127.0.0.1'
    Assert-Scalar 'application server port' (Get-PsqlScalar 'application server port' 'SELECT inet_server_port()::text;') '5432'
    $schemaUsage = Get-PsqlScalar 'application schema access' "SELECT has_schema_privilege(current_user, 'campus_duo', 'USAGE')::text;"
    if (-not (Test-ApplicationSchemaUsageResult $schemaUsage)) {
        throw "Application schema access denied. Expected USAGE on campus_duo, received '$schemaUsage'."
    }
    $requiredColumns = @(Get-AvailabilityRequiredColumns)
    $values = @($requiredColumns | ForEach-Object {
        "('$($_.Relation)', '$($_.Column)', $([array]::IndexOf($requiredColumns, $_)))"
    }) -join ', '
    $privilegeJson = Get-PsqlScalar 'application availability column access' @"
SELECT COALESCE(json_agg(json_build_object(
    'relation', relation_name,
    'column', column_name,
    'allowed', has_column_privilege(current_user, relation_name, column_name, 'SELECT')
) ORDER BY ordinal)::text, '[]')
  FROM (VALUES $values) AS required(relation_name, column_name, ordinal);
"@
    try {
        $privilegeResults = @($privilegeJson | ConvertFrom-Json)
        Test-AvailabilityColumnPrivilegeResults $privilegeResults | Out-Null
    } catch {
        throw "Application availability column access verification failed: $($_.Exception.Message)"
    }
}

function Verify-ExistingTarget {
    Write-TargetConfigurationIdentity
    Set-PsqlEnvironment $PerformanceDatabase 'campus_duo_migrator' $migratorPassword
    $identity = Get-PsqlScalar 'existing target identity' @"
SELECT current_database() || '|' || current_user || '|' ||
       host(inet_server_addr()) || '|' ||
       inet_server_port()::text || '|' ||
       pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database()));
"@
    $identityParts = $identity -split '\|'
    $identityObject = [pscustomobject]@{
        database = if ($identityParts.Count -ge 1) { $identityParts[0] } else { $null }
        role = if ($identityParts.Count -ge 2) { $identityParts[1] } else { $null }
        address = if ($identityParts.Count -ge 3) { $identityParts[2] } else { $null }
        port = if ($identityParts.Count -ge 4) { $identityParts[3] } else { $null }
        owner = if ($identityParts.Count -ge 5) { $identityParts[4] } else { $null }
    }
    if ($identityParts.Count -ne 5 -or -not (Test-ExistingTargetIdentity $identityObject $PerformanceDatabase)) {
        throw "Existing target identity '$identity' is unexpected; refusing verification."
    }
    $schemaOwner = Get-PsqlScalar 'existing schema owner' "SELECT COALESCE((SELECT pg_get_userbyid(n.nspowner) FROM pg_namespace n WHERE n.nspname = 'campus_duo'), '<missing>');"
    Assert-Scalar 'existing schema owner' $schemaOwner 'campus_duo_migrator'
    $historyPresence = Get-PsqlScalar 'existing history presence' "SELECT to_regclass('campus_duo.flyway_schema_history') IS NOT NULL;"
    Assert-Scalar 'existing history presence' $historyPresence 't'
    Write-Output "Live target identity: database=$($identityParts[0]); role=$($identityParts[1]); server=$($identityParts[2]):$($identityParts[3]); databaseOwner=$($identityParts[4]); schemaOwner=$schemaOwner; history=present"
    $env:FLYWAY_PASSWORD = $migratorPassword
    Invoke-FlywayValidate
    Assert-MigrationCompletion
    Assert-ApplicationAccess
    Write-Output "Verified existing target $PerformanceDatabase without database mutations."
}

function Get-DatabaseState([string] $database) {
    Set-PsqlEnvironment 'postgres' 'postgres' $adminPassword
    $owner = Get-PsqlScalar 'database owner preflight' "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$database';"
    $connect = Get-PsqlScalar 'database existence preflight' "SELECT count(*)::text FROM pg_database WHERE datname = '$database';"
    Assert-Scalar 'database existence' $connect '1'
    Assert-Scalar 'database owner' $owner 'campus_duo_migrator'

    Set-PsqlEnvironment $database 'postgres' $adminPassword
    $extension = Get-PsqlScalar 'btree_gist preflight' "SELECT COALESCE((SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist'), '<missing>');"
    Assert-Scalar 'btree_gist schema' $extension 'public'

    $schemaState = Get-PsqlScalar 'campus_duo schema preflight' "SELECT COALESCE((SELECT n.nspname || '|' || pg_get_userbyid(n.nspowner) || '|' || (SELECT count(*) FROM pg_class c WHERE c.relnamespace = n.oid AND c.relkind IN ('r','p','v','m','S','f')) FROM pg_namespace n WHERE n.nspname = 'campus_duo'), '<missing>');"
    $historyTablePresent = Get-PsqlScalar 'Flyway history table presence preflight' "SELECT to_regclass('campus_duo.flyway_schema_history') IS NOT NULL;"
    if ($historyTablePresent -notin @('t', 'f')) {
        throw "Flyway history table presence query returned unexpected value '$historyTablePresent'; refusing to continue."
    }
    if ($historyTablePresent -eq 't') {
        $historyRows = Get-PsqlScalar 'Flyway history row-count preflight' 'SELECT count(*)::text FROM campus_duo.flyway_schema_history;'
        $historyState = "present:$historyRows"
    } else {
        $historyState = 'history table absent'
    }

    [pscustomobject]@{
        Owner = $owner
        ExtensionSchema = $extension
        SchemaState = $schemaState
        HistoryState = $historyState
    }
}

function Assert-AllowedPartialState($state) {
    if ($state.Owner -ne 'campus_duo_migrator' -or $state.ExtensionSchema -ne 'public') {
        throw 'Resume refused: database owner or btree_gist state is unexpected.'
    }
    if ($state.HistoryState -ne 'history table absent') {
        throw "Resume refused: Flyway history state '$($state.HistoryState)' is not the supported absent-table partial state. Never repair, clean, baseline, or erase history."
    }
    if ($state.SchemaState -ne '<missing>') {
        throw "Resume refused: campus_duo schema state '$($state.SchemaState)' is not the observed partial state. Review manually; no schema changes were made."
    }
}

function Get-InitializedCompatibilityInput {
    $schemaState = Get-PsqlScalar 'initialized schema preflight' "SELECT COALESCE((SELECT n.nspname || '|' || pg_get_userbyid(n.nspowner) FROM pg_namespace n WHERE n.nspname = 'campus_duo'), '<missing>');"
    $historyRelation = Get-PsqlScalar 'initialized history relation preflight' "SELECT COALESCE((SELECT c.relkind::text || '|' || pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'campus_duo' AND c.relname = 'flyway_schema_history'), '<missing>');"
    $historyKind = if ($historyRelation -ne '<missing>') { $historyRelation.Split('|')[0] } else { '<missing>' }
    $historyOwner = if ($historyRelation -ne '<missing>') { $historyRelation.Split('|')[1] } else { '<missing>' }
    $columns = if ($historyRelation -ne '<missing>') {
        Get-PsqlScalar 'initialized history columns' "SELECT COALESCE(json_agg(json_build_array(column_name, data_type, is_nullable, COALESCE(column_default, '')) ORDER BY ordinal_position)::text, '[]') FROM information_schema.columns WHERE table_schema = 'campus_duo' AND table_name = 'flyway_schema_history';" | ConvertFrom-Json
    } else { @() }
    $primaryKey = if ($historyRelation -ne '<missing>') {
        Get-PsqlScalar 'initialized history primary key' "SELECT COALESCE((SELECT json_agg(a.attname ORDER BY k.ord)::text FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum WHERE c.conrelid = 'campus_duo.flyway_schema_history'::regclass AND c.contype = 'p'), '[]');" | ConvertFrom-Json
    } else { @() }
    $notNullColumns = if ($historyRelation -ne '<missing>') {
        Get-PsqlScalar 'initialized history not-null columns' "SELECT COALESCE(json_agg(column_name ORDER BY ordinal_position)::text, '[]') FROM information_schema.columns WHERE table_schema = 'campus_duo' AND table_name = 'flyway_schema_history' AND is_nullable = 'NO';" | ConvertFrom-Json
    } else { @() }
    $indexes = if ($historyRelation -ne '<missing>') {
        Get-PsqlScalar 'initialized history indexes' "SELECT COALESCE(json_agg(json_build_array(indexname, CASE WHEN indexname = 'flyway_schema_history_pk' THEN 'installed_rank' ELSE 'success' END, CASE WHEN indexname = 'flyway_schema_history_pk' THEN 'unique' ELSE 'nonunique' END) ORDER BY indexname)::text, '[]') FROM pg_indexes WHERE schemaname = 'campus_duo' AND tablename = 'flyway_schema_history' AND indexname IN ('flyway_schema_history_pk', 'flyway_schema_history_s_idx');" | ConvertFrom-Json
    } else { @() }
    $historyRows = if ($historyKind -eq 'r') {
        [int](Get-PsqlScalar 'initialized history row count' 'SELECT count(*)::text FROM campus_duo.flyway_schema_history;')
    } else { -1 }
    $unexpectedRelations = Get-PsqlScalar 'initialized unexpected relations' "SELECT COALESCE(json_agg(c.relname || '|' || c.relkind::text ORDER BY c.relname)::text, '[]') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'campus_duo' AND c.relname NOT IN ('flyway_schema_history', 'flyway_schema_history_pk', 'flyway_schema_history_s_idx') AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid WHERE d.objid = c.oid AND d.deptype = 'e');" | ConvertFrom-Json
    $unexpectedRoutines = Get-PsqlScalar 'initialized unexpected routines' @"
SELECT COALESCE(json_agg(json_build_object(
           'schema', n.nspname,
           'name', p.proname,
           'identity', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
           'owner', pg_get_userbyid(p.proowner),
           'classification', 'application',
           'extension', NULL
       ) ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))::text, '[]')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'campus_duo'
   AND NOT EXISTS (
       SELECT 1
         FROM pg_depend d
         JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.refclassid = 'pg_extension'::regclass
          AND d.deptype = 'e'
   );
"@ | ConvertFrom-Json
    return @{
        databaseOwner = Get-PsqlScalar 'initialized database owner preflight' "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database();"
        schemaOwner = if ($schemaState -eq '<missing>') { '<missing>' } else { ($schemaState -split '\|')[1] }
        extension = Get-PsqlScalar 'initialized extension preflight' "SELECT COALESCE((SELECT e.extname || '|' || n.nspname || '|' || pg_get_userbyid(e.extowner) FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist'), '<missing>');"
        historyKind = $historyKind
        historyOwner = $historyOwner
        columns = @($columns)
        primaryKey = @($primaryKey)
        notNullColumns = @($notNullColumns)
        indexes = @($indexes)
        historyRows = $historyRows
        unexpectedRelations = @($unexpectedRelations)
        unexpectedRoutines = @($unexpectedRoutines)
    }
}

function Assert-InitializedCompatibility {
    $input = Get-InitializedCompatibilityInput
    $json = $input | ConvertTo-Json -Depth 10 -Compress
    $resultJson = $json | & $node.Source (Join-Path $PSScriptRoot 'performanceCompatibility.js') --stdin
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($resultJson -join ''))) {
        throw 'Initialized-state compatibility evaluator failed; refusing to migrate.'
    }
    $result = ($resultJson -join "`n") | ConvertFrom-Json
    $failed = @($result.checks | Where-Object { $_.status -ne 'PASS' })
    if (-not $result.candidate) {
        $routineFailure = $failed | Where-Object { $_.name -eq 'no unexpected routines' }
        if ($null -ne $routineFailure -and $routineFailure.details) {
            $routineDetails = ($routineFailure.details | ConvertTo-Json -Compress -Depth 5)
            throw "Initialized-state compatibility rejected the live target: $($failed.name -join ', '). Unexpected application routines: $routineDetails"
        }
        throw "Initialized-state compatibility rejected the live target: $($failed.name -join ', ')."
    }
}

function Confirm-InitializedProvenance {
    $answers = @(
        (Read-Host 'Type YES to confirm this database was created exclusively for this performance setup'),
        (Read-Host 'Type YES to confirm no unrelated work or data has been added'),
        (Read-Host 'Type YES to confirm normal versioned migrations may now run')
    )
    $answersJson = $answers | ConvertTo-Json -Compress
    $confirmed = $answersJson | & $node.Source (Join-Path $PSScriptRoot 'performanceCompatibility.js') --confirm
    if ($LASTEXITCODE -ne 0 -or ($confirmed -join '').Trim() -ne 'true') {
        throw 'Initialized-state provenance confirmation was not fully provided; refusing to migrate.'
    }
}

try {
    Get-MigrationInventory
    Write-TargetConfigurationIdentity
    $selectedModeCount = [int]$ResumePartialTarget.IsPresent +
        [int]$ResumeInitializedEmptyHistory.IsPresent +
        [int]$VerifyExistingTarget.IsPresent
    if ($selectedModeCount -gt 1) {
        throw 'Choose only one of ResumePartialTarget, ResumeInitializedEmptyHistory, or VerifyExistingTarget.'
    }
    if ($VerifyExistingTarget) {
        $migratorSecret = Read-Host 'Enter campus_duo_migrator password for read-only target verification' -AsSecureString
        if ($null -eq $migratorSecret) {
            throw 'Migrator password input was not provided; refusing to continue.'
        }
        $migratorPassword = Reveal-Secret $migratorSecret
        $migratorSecret = $null
        if ([string]::IsNullOrWhiteSpace($migratorPassword)) {
            throw 'Migrator password is required for read-only target verification.'
        }
        Verify-ExistingTarget
        return
    }
    $migratorSecret = Read-Host 'Enter campus_duo_migrator password' -AsSecureString
    $adminSecret = Read-Host 'Enter PostgreSQL administrator password' -AsSecureString
    if ($null -eq $migratorSecret -or $null -eq $adminSecret) {
        throw 'Password input was not provided; refusing to continue.'
    }
    $migratorPassword = Reveal-Secret $migratorSecret
    $adminPassword = Reveal-Secret $adminSecret
    $migratorSecret = $null
    $adminSecret = $null
    if ([string]::IsNullOrWhiteSpace($migratorPassword) -or [string]::IsNullOrWhiteSpace($adminPassword)) {
        throw 'Both passwords are required.'
    }

    Set-PsqlEnvironment 'postgres' 'postgres' $adminPassword
    $existsOutput = & $psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*)::text FROM pg_database WHERE datname = '$PerformanceDatabase';"
    $existsExitCode = $LASTEXITCODE
    if ($existsExitCode -ne 0) {
        throw "Database existence query failed with psql exit code $existsExitCode. Preserve the database and review the preceding PostgreSQL error."
    }
    if ($null -eq $existsOutput) {
        throw 'Database existence query returned no result; refusing to continue.'
    }
    $exists = ($existsOutput -join "`n").Trim()
    if ($exists -notin @('0', '1')) {
        throw "Database existence query returned unexpected value '$exists'; refusing to continue."
    }
    if ($exists -eq '1' -and -not $ResumePartialTarget -and -not $ResumeInitializedEmptyHistory) {
        throw "Refusing to reuse existing $PerformanceDatabase. Use an explicit resume option only after reviewing the target state."
    }
    if ($exists -eq '0' -and ($ResumePartialTarget -or $ResumeInitializedEmptyHistory)) {
        throw 'A resume option requires the existing allowlisted database campus_duo_perf_20261103.'
    }

    if ($exists -eq '0') {
        Invoke-PsqlChecked 'database creation' @(
            '-X', '-v', 'ON_ERROR_STOP=1',
            '-c', "CREATE DATABASE `"$PerformanceDatabase`" OWNER campus_duo_migrator;"
        )
        Set-PsqlEnvironment $PerformanceDatabase 'postgres' $adminPassword
        Invoke-PsqlChecked 'btree_gist installation' @(
            '-X', '-v', 'ON_ERROR_STOP=1',
            '-c', 'CREATE EXTENSION btree_gist WITH SCHEMA public;'
        )
    }

    $state = Get-DatabaseState $PerformanceDatabase
    if ($ResumeInitializedEmptyHistory) {
        Assert-InitializedCompatibility
        Confirm-InitializedProvenance
    } elseif ($ResumePartialTarget) {
        Assert-AllowedPartialState $state
    } elseif ($state.SchemaState -ne '<missing>' -or $state.HistoryState -ne 'history table absent') {
        throw 'New database is not in the empty pre-migration state; refusing to modify it.'
    }

    if (-not $ResumeInitializedEmptyHistory) {
        Set-PsqlEnvironment $PerformanceDatabase 'postgres' $adminPassword
        Invoke-PsqlChecked 'database privilege setup' @(
            '-X', '-v', 'ON_ERROR_STOP=1',
            '-c', "REVOKE ALL ON DATABASE `"$PerformanceDatabase`" FROM PUBLIC; GRANT CONNECT ON DATABASE `"$PerformanceDatabase`" TO campus_duo_migrator, campus_duo_app;"
        )
        Invoke-PsqlChecked 'schema creation' @(
            '-X', '-v', 'ON_ERROR_STOP=1',
            '-c', 'CREATE SCHEMA campus_duo AUTHORIZATION campus_duo_migrator; REVOKE ALL ON SCHEMA campus_duo FROM PUBLIC; REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA campus_duo TO campus_duo_app;'
        )
    }

    Set-PsqlEnvironment $PerformanceDatabase 'campus_duo_migrator' $migratorPassword
    $env:FLYWAY_PASSWORD = $migratorPassword
    & $flyway "-configFiles=$flywayConfigPath" `
        "-url=jdbc:postgresql://127.0.0.1:5432/$PerformanceDatabase" `
        '-user=campus_duo_migrator' '-schemas=campus_duo' '-defaultSchema=campus_duo' `
        '-table=flyway_schema_history' '-createSchemas=false' '-failOnMissingLocations=true' `
        "-locations=filesystem:$migrationPath" migrate
    $flywayExitCode = $LASTEXITCODE
    if ($flywayExitCode -ne 0) {
        throw "Flyway migration failed with exit code $flywayExitCode. Preserve the database; no clean, baseline, repair, or history deletion is permitted."
    }
    Assert-MigrationCompletion

    Assert-ApplicationAccess
    Write-Output "Prepared $PerformanceDatabase with Flyway migrations and verified application access."
} finally {
    $migratorPassword = $null
    $adminPassword = $null
    $appPassword = $null
    $appSecret = $null
    Restore-Environment
}
