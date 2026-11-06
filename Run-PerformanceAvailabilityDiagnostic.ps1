$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupSql = Join-Path $repoRoot 'backend\scripts\performance\availability-fixture-setup.sql'
$cleanupSql = Join-Path $repoRoot 'backend\scripts\performance\availability-fixture-cleanup.sql'
$planSqlPath = Join-Path $repoRoot 'backend\scripts\performance\availability-explain-analyze.sql'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$targetDatabase = 'campus_duo_perf_20261103'
$targetHost = '127.0.0.1'
$targetPort = '5432'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runId = "KAN-85-diagnostic-$timestamp"
$evidenceDir = Join-Path $repoRoot "required docs\deliverable-3\evidence\performance-diagnostics\$runId"
$planPath = Join-Path $evidenceDir 'availability-explain-analyze.json'
$indexesPath = Join-Path $evidenceDir 'availability-indexes.json'
$metadataPath = Join-Path $evidenceDir 'diagnostic-metadata.json'

$environmentNames = @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'DATABASE_URL')
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($null -ne $item) { $item.Value } else { $null }
}

$originalLocation = (Get-Location).Path
$fixtureState = 'not-started'
$migratorPassword = $null
$appPassword = $null
$failureMessage = $null
$exitCode = 0

function Reveal-Secret([Security.SecureString] $value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Set-DbEnvironment([string] $user, [string] $password) {
    $env:PGHOST = $targetHost
    $env:PGPORT = $targetPort
    $env:PGDATABASE = $targetDatabase
    $env:PGUSER = $user
    $env:PGPASSWORD = $password
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

function Invoke-Psql([string[]] $arguments) {
    $output = & $psqlPath @arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "psql failed with exit code $code."
    }
    return ($output -join "`n").Trim()
}

try {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    foreach ($path in @($psqlPath, $setupSql, $cleanupSql, $planSqlPath)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Diagnostic file was not found: $path"
        }
    }

    $migratorSecret = Read-Host 'Enter disposable database migrator password' -AsSecureString
    $appSecret = Read-Host 'Enter disposable database application password' -AsSecureString
    $migratorPassword = Reveal-Secret $migratorSecret
    $appPassword = Reveal-Secret $appSecret
    if ([string]::IsNullOrWhiteSpace($migratorPassword) -or [string]::IsNullOrWhiteSpace($appPassword)) {
        throw 'Both disposable database passwords are required.'
    }

    $actorId = [guid]::NewGuid().Guid
    $locationId = [guid]::NewGuid().Guid
    $tableId = [guid]::NewGuid().Guid
    $slotIds = 1..12 | ForEach-Object { [guid]::NewGuid().Guid }
    $ownershipId = "kan85-diagnostic-$timestamp"
    $testDate = '2026-11-14'
    $fixtureArguments = @(
        '-X', '-v', 'ON_ERROR_STOP=1', '-f', $setupSql,
        '-v', "ownership_id=$ownershipId", '-v', "actor_id=$actorId",
        '-v', "location_id=$locationId", '-v', "table_id=$tableId",
        '-v', "test_date=$testDate"
    )
    for ($i = 0; $i -lt 12; $i++) {
        $fixtureArguments += @('-v', "slot_$($i + 1)=$($slotIds[$i])")
    }

    Set-DbEnvironment 'campus_duo_migrator' $migratorPassword
    $identity = Invoke-Psql @('-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', "SELECT current_database() || '|' || current_user || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text;")
    if ($identity -ne "$targetDatabase|campus_duo_migrator|$targetHost|$targetPort") {
        throw "Migrator identity mismatch: $identity"
    }
    Invoke-Psql $fixtureArguments | Set-Content -LiteralPath (Join-Path $evidenceDir 'fixture-setup.txt') -Encoding UTF8
    $fixtureState = 'committed'

    Set-DbEnvironment 'campus_duo_app' $appPassword
    $appIdentity = Invoke-Psql @('-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', "SELECT current_database() || '|' || current_user || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text;")
    if ($appIdentity -ne "$targetDatabase|campus_duo_app|$targetHost|$targetPort") {
        throw "Application identity mismatch: $appIdentity"
    }

    $plan = Invoke-Psql @(
        '-X', '-At', '-v', 'ON_ERROR_STOP=1',
        '-v', "test_date=$testDate",
        '-v', "location_id=$locationId",
        '-f', $planSqlPath
    )
    $plan | Set-Content -LiteralPath $planPath -Encoding UTF8

    $indexSql = @"
SELECT COALESCE(json_agg(json_build_object(
    'table', tablename,
    'index', indexname,
    'definition', indexdef
) ORDER BY tablename, indexname)::text, '[]')
FROM pg_indexes
WHERE schemaname = 'campus_duo'
  AND tablename IN ('study_slot', 'study_table', 'study_location', 'booking');
"@
    $indexes = Invoke-Psql @('-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', $indexSql)
    $indexes | Set-Content -LiteralPath $indexesPath -Encoding UTF8

    [ordered]@{
        timestamp = (Get-Date).ToString('o')
        association = 'KAN-85'
        runId = $runId
        target = "$targetHost`:$targetPort/$targetDatabase"
        fixture = 'fresh 12-slot owned diagnostic fixture; exact cleanup authorized only after committed setup'
        applicationQueryCountPerRequest = 1
        pool = @{
            max = 20
            idleTimeoutMillis = 30000
            connectionTimeoutMillis = 5000
        }
        source = 'backend/src/repository/bookingRepo.ts:getAvailability'
        planPath = $planPath
        indexesPath = $indexesPath
        note = 'Read-only EXPLAIN ANALYZE after fixture setup; no production optimization applied.'
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
}
catch {
    $failureMessage = $_.Exception.Message
    $exitCode = 1
}
finally {
    if ($fixtureState -eq 'committed') {
        try {
            Set-DbEnvironment 'campus_duo_migrator' $migratorPassword
            $cleanupArguments = @(
                '-X', '-v', 'ON_ERROR_STOP=1', '-f', $cleanupSql,
                '-v', "ownership_id=$ownershipId", '-v', "actor_id=$actorId",
                '-v', "location_id=$locationId", '-v', "table_id=$tableId",
                '-v', "test_date=$testDate"
            )
            for ($i = 0; $i -lt 12; $i++) {
                $cleanupArguments += @('-v', "slot_$($i + 1)=$($slotIds[$i])")
            }
            Invoke-Psql $cleanupArguments | Set-Content -LiteralPath (Join-Path $evidenceDir 'fixture-cleanup.txt') -Encoding UTF8
        }
        catch {
            $failureMessage = "Fixture cleanup failed: $($_.Exception.Message)"
            $exitCode = 1
        }
    }
    foreach ($name in $environmentNames) {
        $value = $previousEnvironment[$name]
        if ($null -eq $value) {
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        }
        else {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
    Set-Location -LiteralPath $originalLocation
    $migratorPassword = $null
    $appPassword = $null
}

Write-Host "Diagnostic exit code: $exitCode"
Write-Host "Evidence directory: $evidenceDir"
Write-Host "Plan: $planPath"
Write-Host "Indexes: $indexesPath"
if ($failureMessage) {
    Write-Host "Failure: $failureMessage"
}
Write-Host 'No optimization or load test was run.'
