[CmdletBinding()]
param(
    [ValidateSet('campus_duo_perf_20261103')]
    [string] $PerformanceDatabase = 'campus_duo_perf_20261103'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$psql = Get-Command psql -ErrorAction Stop
$adminPassword = $null
$previous = @{}
foreach ($name in @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD')) {
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

function Invoke-ReadOnly([string] $Section, [string] $Query) {
    Write-Output "`n--- $Section ---"
    & $psql.Source -X -At -P footer=off -v ON_ERROR_STOP=1 -c $Query
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Section failed with psql exit code $exitCode. No diagnostic conclusion is valid."
    }
}

function Get-Scalar([string] $Section, [string] $Query) {
    $output = & $psql.Source -X -At -P footer=off -v ON_ERROR_STOP=1 -c $Query
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Section failed with psql exit code $exitCode. No diagnostic conclusion is valid."
    }
    if ($null -eq $output) {
        throw "$Section returned no scalar result."
    }
    $value = ($output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Section returned an empty scalar result."
    }
    return $value
}

try {
    $secret = Read-Host 'Enter read-only diagnostic database administrator password' -AsSecureString
    if ($null -eq $secret) {
        throw 'Password input was not provided; refusing to continue.'
    }
    $adminPassword = Reveal-Secret $secret
    $secret = $null

    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = $PerformanceDatabase
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = $adminPassword

    $identity = Get-Scalar 'target identity' @"
SELECT current_database() || '|' || current_user || '|' ||
       pg_get_userbyid(datdba)
  FROM pg_database
 WHERE datname = current_database();
"@
    $identityParts = $identity -split '\|'
    if ($identityParts.Count -ne 3 -or $identityParts[0] -ne $PerformanceDatabase) {
        throw "Actual target identity '$identity' did not match the allowlisted database."
    }
    Write-Output "`n=== Read-only diagnostic: $PerformanceDatabase ==="
    Write-Output "database|session_role|database_owner"
    Write-Output $identity

    $schemaState = Get-Scalar 'campus_duo schema state' @"
SELECT COALESCE((
    SELECT n.nspname || '|' || pg_get_userbyid(n.nspowner)
      FROM pg_namespace n
     WHERE n.nspname = 'campus_duo'
), '<missing>');
"@
    Write-Output "`ncampus_duo_schema|owner"
    Write-Output $schemaState

    $extensionState = Get-Scalar 'extension state' @"
SELECT e.extname || '|' || n.nspname || '|' || pg_get_userbyid(e.extowner)
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
 WHERE e.extname = 'btree_gist'
UNION ALL
SELECT '<missing>' || '||'
 WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist');
"@
    Invoke-ReadOnly 'extension state' "SELECT '$extensionState';"

    Invoke-ReadOnly 'non-system schemas' @"
SELECT n.nspname || '|' || pg_get_userbyid(n.nspowner)
  FROM pg_namespace n
 WHERE n.nspname NOT LIKE 'pg_%'
   AND n.nspname <> 'information_schema'
 ORDER BY n.nspname;
"@

    Invoke-ReadOnly 'relation objects and ownership' @"
WITH extension_objects AS (
    SELECT DISTINCT d.objid
      FROM pg_depend d
      JOIN pg_extension e ON e.oid = d.refobjid
     WHERE d.deptype = 'e'
)
SELECT n.nspname || '|' || c.relname || '|' ||
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'p' THEN 'partitioned_table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized_view'
         WHEN 'S' THEN 'sequence'
         WHEN 'f' THEN 'foreign_table'
         ELSE c.relkind::text
       END || '|' || pg_get_userbyid(c.relowner) || '|' ||
       CASE WHEN eo.objid IS NULL THEN 'application' ELSE 'extension-owned' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN extension_objects eo ON eo.objid = c.oid
 WHERE n.nspname NOT LIKE 'pg_%'
   AND n.nspname <> 'information_schema'
 ORDER BY n.nspname, c.relname;
"@

    Invoke-ReadOnly 'routine objects and ownership' @"
WITH routine_extension AS (
    SELECT d.objid AS routine_oid, string_agg(e.extname, ',' ORDER BY e.extname) AS extension_name
      FROM pg_depend d
      JOIN pg_extension e
        ON e.oid = d.refobjid
     WHERE d.classid = 'pg_proc'::regclass
       AND d.refclassid = 'pg_extension'::regclass
       AND d.deptype = 'e'
     GROUP BY d.objid
)
SELECT n.nspname || '|' || p.proname || '|' ||
       pg_get_function_identity_arguments(p.oid) || '|' ||
       pg_get_userbyid(p.proowner) || '|' ||
       CASE WHEN re.routine_oid IS NULL THEN 'application' ELSE 'extension-owned' END || '|' ||
       COALESCE(re.extension_name, '')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN routine_extension re ON re.routine_oid = p.oid
 WHERE n.nspname NOT LIKE 'pg_%'
   AND n.nspname <> 'information_schema'
 ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
"@

    $historyRelation = Get-Scalar 'history relation presence' "SELECT COALESCE((SELECT c.relkind::text || '|' || pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'campus_duo' AND c.relname = 'flyway_schema_history'), '<missing>');"
    Write-Output "`n--- Flyway history relation ---"
    Write-Output "relkind|owner"
    Write-Output $historyRelation

    if ($historyRelation -ne '<missing>') {
        Invoke-ReadOnly 'history column structure' @"
SELECT ordinal_position || '|' || column_name || '|' ||
       data_type || '|' || is_nullable || '|' ||
       COALESCE(column_default, '')
  FROM information_schema.columns
 WHERE table_schema = 'campus_duo'
   AND table_name = 'flyway_schema_history'
 ORDER BY ordinal_position;
"@
        Invoke-ReadOnly 'history constraints' @"
SELECT conname::text || '|' || contype::text || '|' ||
       pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'campus_duo.flyway_schema_history'::regclass
 ORDER BY conname;
"@
        Invoke-ReadOnly 'history indexes' @"
SELECT indexname || '|' || indexdef
  FROM pg_indexes
 WHERE schemaname = 'campus_duo'
   AND tablename = 'flyway_schema_history'
 ORDER BY indexname;
"@

        $historyKind = $historyRelation.Split('|')[0]
        if ($historyKind -in @('r', 'p')) {
            Invoke-ReadOnly 'history row count' 'SELECT count(*)::text FROM campus_duo.flyway_schema_history;'
            Invoke-ReadOnly 'history entries' @"
SELECT installed_rank || '|' || COALESCE(version, '') || '|' ||
       COALESCE(description, '') || '|' || type || '|' ||
       script || '|' || COALESCE(checksum::text, '') || '|' ||
       installed_by || '|' || installed_on || '|' ||
       execution_time || '|' || success
  FROM campus_duo.flyway_schema_history
 ORDER BY installed_rank;
"@
        } else {
            Write-Output "`n--- History entries ---"
            Write-Output "not queried because the relation is not a table or partitioned table"
        }
    }

    $applicationRelationCount = Get-Scalar 'application relation count' @"
SELECT count(*)::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'campus_duo'
   AND c.relname <> 'flyway_schema_history'
   AND c.relname NOT IN ('flyway_schema_history_pk', 'flyway_schema_history_s_idx')
   AND NOT EXISTS (
       SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = c.oid AND d.deptype = 'e'
   );
"@
    $routineCount = Get-Scalar 'application routine count' @"
WITH routine_extension AS (
    SELECT DISTINCT d.objid AS routine_oid
      FROM pg_depend d
      JOIN pg_extension e
        ON e.oid = d.refobjid
     WHERE d.classid = 'pg_proc'::regclass
       AND d.refclassid = 'pg_extension'::regclass
       AND d.deptype = 'e'
)
SELECT count(*)::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN routine_extension re ON re.routine_oid = p.oid
 WHERE n.nspname = 'campus_duo'
   AND re.routine_oid IS NULL;
"@
    $historyKind = if ($historyRelation -ne '<missing>') { $historyRelation.Split('|')[0] } else { '<missing>' }
    $historyOwner = if ($historyRelation -ne '<missing>') { $historyRelation.Split('|')[1] } else { '<missing>' }
    $historyColumnCount = if ($historyRelation -ne '<missing>') { Get-Scalar 'history column count' "SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'campus_duo' AND table_name = 'flyway_schema_history';" } else { '0' }
    $historyNotNullCount = if ($historyRelation -ne '<missing>') { Get-Scalar 'history not-null count' "SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'campus_duo' AND table_name = 'flyway_schema_history' AND is_nullable = 'NO';" } else { '0' }
    $historyColumnSignature = if ($historyRelation -ne '<missing>') { Get-Scalar 'history column signature' "SELECT string_agg(column_name || '|' || data_type || '|' || is_nullable || '|' || COALESCE(column_default, ''), ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'campus_duo' AND table_name = 'flyway_schema_history';" } else { '<missing>' }
    $historyPrimaryKeyCount = if ($historyRelation -ne '<missing>') { Get-Scalar 'history primary-key count' "SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'campus_duo.flyway_schema_history'::regclass AND contype = 'p' AND pg_get_constraintdef(oid) LIKE '%(installed_rank)%';" } else { '0' }
    $historyConstraintCount = if ($historyRelation -ne '<missing>') { Get-Scalar 'history non-nullable/PK constraint count' "SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'campus_duo.flyway_schema_history'::regclass AND contype <> 'n';" } else { '0' }
    $historyIndexCount = if ($historyRelation -ne '<missing>') { Get-Scalar 'history expected index count' "SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'campus_duo' AND tablename = 'flyway_schema_history' AND indexname IN ('flyway_schema_history_pk', 'flyway_schema_history_s_idx');" } else { '0' }
    $historyIndexSignature = if ($historyRelation -ne '<missing>') { Get-Scalar 'history index signature' "SELECT string_agg(indexname || '|' || indexdef, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'campus_duo' AND tablename = 'flyway_schema_history';" } else { '<missing>' }
    $historyRowsForCheck = if ($historyRelation -ne '<missing>' -and $historyKind -eq 'r') { Get-Scalar 'history row count for compatibility' 'SELECT count(*)::text FROM campus_duo.flyway_schema_history;' } else { '-1' }
    $namedChecks = @(
        "database owner: " + ($(if ($identityParts[2] -eq 'campus_duo_migrator') { 'PASS' } else { 'FAIL' })),
        "schema owner: " + ($(if ($schemaState -eq 'campus_duo|campus_duo_migrator') { 'PASS' } else { 'FAIL' })),
        "extension state: " + ($(if ($extensionState -like 'btree_gist|public|*') { 'PASS' } else { 'FAIL' })),
        "history relation: " + ($(if ($historyKind -eq 'r' -and $historyOwner -eq 'campus_duo_migrator') { 'PASS' } else { 'FAIL' })),
        "history columns: " + ($(if ($historyColumnCount -eq '10' -and $historyNotNullCount -eq '8' -and $historyColumnSignature -eq 'installed_rank|integer|NO|,version|character varying|YES|,description|character varying|NO|,type|character varying|NO|,script|character varying|NO|,checksum|integer|YES|,installed_by|character varying|NO|,installed_on|timestamp without time zone|NO|now(),execution_time|integer|NO|,success|boolean|NO|') { 'PASS' } else { 'FAIL' })),
        "history primary key: " + ($(if ($historyPrimaryKeyCount -eq '1') { 'PASS' } else { 'FAIL' })),
        "history constraints: " + ($(if ($historyConstraintCount -eq '1') { 'PASS' } else { 'FAIL' })),
        "history indexes: " + ($(if ($historyIndexCount -eq '2' -and $historyIndexSignature -match 'flyway_schema_history_pk' -and $historyIndexSignature -match 'flyway_schema_history_s_idx') { 'PASS' } else { 'FAIL' })),
        "history rows: " + ($(if ($historyRowsForCheck -eq '0') { 'PASS' } else { 'FAIL' })),
        "unexpected application relations: " + ($(if ($applicationRelationCount -eq '0') { 'PASS' } else { 'FAIL' })),
        "unexpected application routines: " + ($(if ($routineCount -eq '0') { 'PASS' } else { 'FAIL' }))
    )
    Write-Output "`n--- Initialized-but-unmigrated compatibility ---"
    $namedChecks | ForEach-Object { Write-Output $_ }
    Write-Output "candidate=see named checks above; provenance remains UNKNOWN"
    Write-Output "This is structural compatibility only; an empty history table does not prove database provenance or that migrations were never applied and removed."
} finally {
    $adminPassword = $null
    Restore-Environment
}
