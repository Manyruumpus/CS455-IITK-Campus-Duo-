$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$harnessPath = Join-Path $repoRoot 'backend\scripts\performance\Invoke-AvailabilityPerformanceBaseline.ps1'
$launcherPath = Join-Path $repoRoot 'backend\scripts\performance\loopback-server.js'
$appEntryPath = Join-Path $repoRoot 'backend\dist\src\app.js'
$dbModulePath = Join-Path $repoRoot 'backend\dist\src\config\db.js'
$k6ScriptPath = Join-Path $repoRoot 'backend\scripts\performance\availability-k6.js'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$targetDatabase = 'campus_duo_perf_20261103'
$targetHost = '127.0.0.1'
$targetPort = '5432'
$appPort = 4400
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runId = "KAN-85-baseline-$timestamp"
$evidenceRoot = Join-Path $repoRoot 'required docs\deliverable-3\evidence\performance-baseline'
$wrapperEvidenceDir = Join-Path $evidenceRoot $runId
$wrapperLogPath = Join-Path $wrapperEvidenceDir 'wrapper-output.txt'
$wrapperMetadataPath = Join-Path $wrapperEvidenceDir 'wrapper-metadata.json'
$nativeEvidenceDir = Join-Path $repoRoot "required docs\deliverable-3\evidence\performance\availability-$runId"

$environmentNames = @(
    'PATH',
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'DATABASE_URL',
    'DB_PASSWORD',
    'DB_USER',
    'DB_NAME',
    'DB_HOST',
    'DB_PORT',
    'PORT',
    'NODE_ENV',
    'ALLOW_TEST_HARNESS_AUTH'
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($null -ne $item) { $item.Value } else { $null }
}

$originalLocation = (Get-Location).Path
$exitCode = $null
$failureMessage = $null
$node = $null
$k6 = $null

try {
    New-Item -ItemType Directory -Force -Path $wrapperEvidenceDir | Out-Null

    foreach ($path in @($harnessPath, $launcherPath, $appEntryPath, $dbModulePath, $k6ScriptPath, $psqlPath)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Required performance baseline file was not found: $path"
        }
    }

    $node = Get-Command node -ErrorAction Stop
    $k6 = Get-Command k6 -ErrorAction Stop
    $psqlDirectory = Split-Path -Parent $psqlPath
    $env:PATH = "$psqlDirectory;$($previousEnvironment['PATH'])"
    $env:PGHOST = $targetHost
    $env:PGPORT = $targetPort
    $env:PGDATABASE = $targetDatabase
    $env:PORT = "$appPort"
    $env:NODE_ENV = 'development'
    $env:ALLOW_TEST_HARNESS_AUTH = 'true'
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

    Set-Location -LiteralPath $repoRoot
    Write-Host "Running baseline profile against $targetHost`:$targetPort/$targetDatabase on loopback port $appPort..."
    & $harnessPath `
        -PerformanceDatabase $targetDatabase `
        -LoadProfile baseline `
        -Port $appPort `
        -RunId $runId 2>&1 |
        Tee-Object -FilePath $wrapperLogPath
    $exitCode = $LASTEXITCODE
}
catch {
    $failureMessage = $_.Exception.Message
    if ($null -eq $exitCode) {
        $exitCode = 1
    }
}
finally {
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
}

$metadata = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    association = 'KAN-85'
    targetDatabase = $targetDatabase
    targetHost = $targetHost
    targetPort = $targetPort
    applicationPort = $appPort
    loadProfile = 'baseline'
    runId = $runId
    expectedMeasuredDuration = '180 seconds'
    maximumVUs = 10
    warmup = 'supported separate 20-second warm-up invocation, excluded from measured outputs'
    stages = @(
        '1 VU for 30 seconds',
        '5 VUs for 60 seconds',
        '10 VUs for 60 seconds',
        'ramp down to 0 VUs for 30 seconds'
    )
    workload = 'GET /api/booking/availability?date={fixture date}&locationId={fixture location}&limit=100 with X-Campus-Duo-Test-Actor'
    thresholds = @(
        'http_req_failed rate==0',
        'availability_correctness_failures count==0',
        'http_req_duration{endpoint:availability} p(95)<1000ms'
    )
    summaryTrendStats = @('avg', 'min', 'med/p50', 'max', 'p(90)', 'p(95)', 'p(99)')
    harness = $harnessPath
    launcher = $launcherPath
    builtEntryPoint = $appEntryPath
    k6Script = $k6ScriptPath
    node = if ($null -ne $node) { $node.Source } else { $null }
    k6 = if ($null -ne $k6) { $k6.Source } else { $null }
    psql = $psqlPath
    exitCode = $exitCode
    wrapperLogPath = $wrapperLogPath
    nativeEvidenceDir = $nativeEvidenceDir
    scope = 'Baseline profile only; no optimization or comparison run.'
}
if (Test-Path -LiteralPath $wrapperEvidenceDir -PathType Container) {
    $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $wrapperMetadataPath -Encoding UTF8
}

Write-Host ''
Write-Host '========== PERFORMANCE BASELINE CHECKPOINT =========='
Write-Host 'Association: KAN-85'
Write-Host "Target: $targetHost`:$targetPort/$targetDatabase"
Write-Host 'Profile: baseline'
Write-Host 'Expected measured duration: 180 seconds'
Write-Host 'Maximum VUs: 10'
Write-Host "Exit code: $exitCode"
Write-Host "Wrapper log: $wrapperLogPath"
Write-Host "Native harness evidence: $nativeEvidenceDir"
Write-Host "Wrapper metadata: $wrapperMetadataPath"
if ($failureMessage) {
    Write-Host "Failure: $failureMessage"
}
Write-Host 'Optimization and comparison runs were not started.'
Write-Host 'Previous environment values and working directory restored.'
Write-Host '====================================================='
