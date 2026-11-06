[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('campus_duo_perf_20261103')]
    [string] $PerformanceDatabase,

    [ValidateSet('smoke', 'baseline')]
    [string] $LoadProfile = 'smoke',

    [int] $Port = 4400,

    [string] $RunId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $backendRoot '..')).Path
$setupSql = Join-Path $PSScriptRoot 'availability-fixture-setup.sql'
$cleanupSql = Join-Path $PSScriptRoot 'availability-fixture-cleanup.sql'
$k6Script = Join-Path $PSScriptRoot 'availability-k6.js'
$launcher = Join-Path $PSScriptRoot 'loopback-server.js'
$evidenceRoot = Join-Path $workspaceRoot 'required docs\deliverable-3\evidence\performance'
$runId = if ($RunId) { $RunId } else { Get-Date -Format 'yyyyMMdd-HHmmss-fff' }
$runRoot = Join-Path $evidenceRoot "availability-$runId"

if (Test-Path -LiteralPath $runRoot) {
    throw "Evidence directory already exists; refusing to overwrite: $runRoot"
}
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

$k6 = Get-Command k6 -ErrorAction Stop
$node = Get-Command node -ErrorAction Stop
$psql = Get-Command psql -ErrorAction Stop
$metadataPath = Join-Path $runRoot 'run-metadata.json'
$manifestPath = Join-Path $runRoot 'fixture-manifest.json'
$readyPath = Join-Path $runRoot 'app-ready.json'
$summaryPath = Join-Path $runRoot 'measured-summary.json'
$warmupSummaryPath = Join-Path $runRoot 'warmup-summary.json'
$metricsPath = Join-Path $runRoot 'measured-metrics.json'
$warmupMetricsPath = Join-Path $runRoot 'warmup-metrics.json'
$appLogPath = Join-Path $runRoot 'app.log'
$appErrorPath = Join-Path $runRoot 'app-error.log'
$appProcess = $null
$fixtureState = 'not-started'
$migratorPassword = $null
$appPassword = $null
$originalEnv = @{}
foreach ($name in @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','DATABASE_URL','DB_PASSWORD','DB_USER','DB_NAME','DB_HOST','DB_PORT','PORT','NODE_ENV','ALLOW_TEST_HARNESS_AUTH')) {
    $originalEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Set-DbEnvironment([string] $database, [string] $user, [string] $password) {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = $database
    $env:PGUSER = $user
    $env:PGPASSWORD = $password
}

function Restore-Environment {
    foreach ($name in $originalEnv.Keys) {
        if ($null -eq $originalEnv[$name]) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        } else {
            Set-Item "Env:$name" $originalEnv[$name]
        }
    }
}

function Read-Secret([string] $prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Write-FixtureState([string] $state, [string] $reason = '') {
    [ordered]@{
        state = $state
        reason = $reason
        runId = $runId
        manifestPath = $manifestPath
        timestamp = (Get-Date).ToString('o')
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'fixture-state.json')
}

function Invoke-Psql([string] $sqlFile, [hashtable] $vars) {
    $arguments = @('-X', '-v', 'ON_ERROR_STOP=1', '-f', $sqlFile)
    foreach ($key in $vars.Keys) {
        $arguments += @('-v', "$key=$($vars[$key])")
    }
    & $psql.Source @arguments
    if ($LASTEXITCODE -ne 0) { throw "psql failed for $sqlFile." }
}

function Invoke-K6([string] $outputPath, [string] $summaryPath, [string] $profile) {
    $saved = @{}
    foreach ($name in @('PGPASSWORD','DATABASE_URL','DB_PASSWORD','FLYWAY_PASSWORD','CAMPUS_DUO_MIGRATOR_PASSWORD','BASE_URL','ACTOR_ID','LOCATION_ID','TEST_DATE','EXPECTED_SLOT_IDS','EXPECTED_TABLE_ID','LOAD_PROFILE','K6_SUMMARY_PATH','PERFORMANCE_READY_FILE')) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    foreach ($name in @('PGPASSWORD','DATABASE_URL','DB_PASSWORD','FLYWAY_PASSWORD','CAMPUS_DUO_MIGRATOR_PASSWORD','PERFORMANCE_READY_FILE')) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
    $env:LOAD_PROFILE = $profile
    $env:K6_SUMMARY_PATH = $summaryPath
    try {
        & $k6.Source run '--out' "json=$outputPath" $k6Script
        if ($LASTEXITCODE -ne 0) { throw "k6 $profile run failed." }
    } finally {
        foreach ($name in $saved.Keys) {
            if ($null -eq $saved[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
            else { Set-Item "Env:$name" $saved[$name] }
        }
    }
}

try {
    $migratorPassword = Read-Secret 'Enter disposable database migrator password'
    $appPassword = Read-Secret 'Enter disposable database application password'
    if ([string]::IsNullOrWhiteSpace($migratorPassword) -or [string]::IsNullOrWhiteSpace($appPassword)) {
        throw 'Both disposable database passwords are required.'
    }

    $actorId = [guid]::NewGuid().Guid
    $locationId = [guid]::NewGuid().Guid
    $tableId = [guid]::NewGuid().Guid
    $slotIds = 1..12 | ForEach-Object { [guid]::NewGuid().Guid }
    $ownershipId = "kan81-performance-$runId"
    $manifest = [ordered]@{
        ownershipId = $ownershipId
        actorId = $actorId
        locationId = $locationId
        tableId = $tableId
        slotIds = $slotIds
        testDate = '2026-11-14'
        database = $PerformanceDatabase
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath

    Set-DbEnvironment $PerformanceDatabase 'campus_duo_migrator' $migratorPassword
    $identity = (& $psql.Source -X -At -c "SELECT current_database() || '|' || current_user;").Trim()
    if ($LASTEXITCODE -ne 0 -or $identity -ne "$PerformanceDatabase|campus_duo_migrator") {
        throw 'Migrator preflight did not match the dedicated performance database and role.'
    }
    Set-DbEnvironment $PerformanceDatabase 'campus_duo_app' $appPassword
    $appIdentity = (& $psql.Source -X -At -c "SELECT current_database() || '|' || current_user;").Trim()
    if ($LASTEXITCODE -ne 0 -or $appIdentity -ne "$PerformanceDatabase|campus_duo_app") {
        throw 'Application preflight did not match the dedicated performance database and role.'
    }

    Set-DbEnvironment $PerformanceDatabase 'campus_duo_migrator' $migratorPassword
    $vars = @{
        ownership_id = $ownershipId; actor_id = $actorId; location_id = $locationId; table_id = $tableId
        test_date = '2026-11-14'
    }
    for ($i = 0; $i -lt 12; $i++) { $vars["slot_$($i + 1)"] = $slotIds[$i] }
    Write-FixtureState 'setup-started'
    try {
        Invoke-Psql $setupSql $vars
        $fixtureState = 'committed'
        Write-FixtureState $fixtureState
    } catch {
        $fixtureState = 'unknown'
        Write-FixtureState $fixtureState $_.Exception.Message
        throw
    }

    $env:PGDATABASE = $PerformanceDatabase
    $env:PGUSER = 'campus_duo_app'
    $env:PGPASSWORD = $appPassword
    $env:PORT = "$Port"
    $env:NODE_ENV = 'development'
    $env:ALLOW_TEST_HARNESS_AUTH = 'true'
    $env:DATABASE_URL = ''
    $env:PERFORMANCE_READY_FILE = $readyPath
    $appProcess = Start-Process -FilePath $node.Source -ArgumentList @("`"$launcher`"") -WorkingDirectory $backendRoot `
        -RedirectStandardOutput $appLogPath -RedirectStandardError $appErrorPath -PassThru
    $deadline = (Get-Date).AddSeconds(10)
    while (-not (Test-Path -LiteralPath $readyPath) -and (Get-Date) -lt $deadline) {
        if ($appProcess.HasExited) { throw "Performance app exited before readiness; inspect $appErrorPath." }
        Start-Sleep -Milliseconds 100
    }
    if (-not (Test-Path -LiteralPath $readyPath)) { throw "Performance app did not become ready on 127.0.0.1:$Port." }
    $ready = Get-Content -Raw -LiteralPath $readyPath | ConvertFrom-Json
    if ($ready.address -ne '127.0.0.1' -or [int]$ready.port -ne $Port) { throw 'Launcher readiness did not prove loopback binding.' }

    $env:BASE_URL = "http://127.0.0.1:$Port"
    $env:ACTOR_ID = $actorId
    $env:LOCATION_ID = $locationId
    $env:TEST_DATE = '2026-11-14'
    $env:EXPECTED_SLOT_IDS = ($slotIds -join ',')
    $env:EXPECTED_TABLE_ID = $tableId

    Invoke-K6 $warmupMetricsPath $warmupSummaryPath 'warmup'
    Invoke-K6 $metricsPath $summaryPath $LoadProfile
    [ordered]@{
        runId = $runId; ownershipId = $ownershipId; database = $PerformanceDatabase
        profile = $LoadProfile; endpoint = '/api/booking/availability'; fixtureSize = 12
        warmup = 'separate k6 invocation; excluded from measured outputs'
        launcher = 'loopback-server.js using exported createApp and closeDbPool'
        nodeVersion = (& $node.Source --version).Trim(); k6Version = (& $k6.Source version).Trim()
        gitRevision = (& git -C $workspaceRoot rev-parse HEAD).Trim()
        worktreeStatus = (& git -C $workspaceRoot status --short)
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metadataPath
} finally {
    if ($appProcess -and -not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id
        $appProcess.WaitForExit()
    }
    if ($fixtureState -eq 'committed') {
        try {
            Set-DbEnvironment $PerformanceDatabase 'campus_duo_migrator' $migratorPassword
            Invoke-Psql $cleanupSql $vars
        } catch {
            Write-Error "Fixture cleanup failed: $($_.Exception.Message)"
            $global:LASTEXITCODE = 1
        }
    } elseif ($fixtureState -eq 'setup-started' -or $fixtureState -eq 'unknown') {
        Write-Warning "Fixture state is $fixtureState; cleanup was not authorized. Preserve the manifest and reconcile ownership before any cleanup."
    }
    $migratorPassword = $null
    $appPassword = $null
    Restore-Environment
}
