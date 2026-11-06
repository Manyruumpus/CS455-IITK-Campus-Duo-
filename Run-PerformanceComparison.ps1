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
$baselineRunId = 'KAN-85-baseline-20261106-112650-493'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runId = "KAN-85-comparison-$timestamp"
$evidenceRoot = Join-Path $repoRoot 'required docs\deliverable-3\evidence\performance-comparison'
$wrapperEvidenceDir = Join-Path $evidenceRoot $runId
$wrapperLogPath = Join-Path $wrapperEvidenceDir 'wrapper-output.txt'
$wrapperMetadataPath = Join-Path $wrapperEvidenceDir 'wrapper-metadata.json'
$nativeEvidenceDir = Join-Path $repoRoot "required docs\deliverable-3\evidence\performance\availability-$runId"
$baselineNativeEvidenceDir = Join-Path $repoRoot "required docs\deliverable-3\evidence\performance\availability-$baselineRunId"

$environmentNames = @(
    'PATH', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'DATABASE_URL', 'DB_PASSWORD', 'DB_USER', 'DB_NAME', 'DB_HOST',
    'DB_PORT', 'PORT', 'NODE_ENV', 'ALLOW_TEST_HARNESS_AUTH'
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
            throw "Required performance comparison file was not found: $path"
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
    Write-Host "Running comparison profile against $targetHost`:$targetPort/$targetDatabase on loopback port $appPort..."
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
    comparison = $true
    baselineRunId = $baselineRunId
    baselineNativeEvidenceDir = $baselineNativeEvidenceDir
    targetDatabase = $targetDatabase
    targetHost = $targetHost
    targetPort = $targetPort
    applicationPort = $appPort
    loadProfile = 'baseline'
    runId = $runId
    measuredDuration = '180 seconds'
    maximumVUs = 10
    stages = @('1 VU/30s', '5 VUs/60s', '10 VUs/60s', 'ramp down/30s')
    warmup = 'same separate 20-second warm-up invocation, excluded from measured outputs'
    fixtureShape = '12 fresh owned slots, one owned location/table/actor'
    thresholds = @('http_req_failed rate==0', 'availability_correctness_failures count==0', 'http_req_duration{endpoint:availability} p(95)<1000ms')
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
    scope = 'Baseline-equivalent comparison only; no automatic optimization or additional profile.'
}
if (Test-Path -LiteralPath $wrapperEvidenceDir -PathType Container) {
    $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $wrapperMetadataPath -Encoding UTF8
}

Write-Host ''
Write-Host '========== PERFORMANCE COMPARISON CHECKPOINT =========='
Write-Host 'Association: KAN-85'
Write-Host "Baseline reference: $baselineRunId"
Write-Host "Target: $targetHost`:$targetPort/$targetDatabase"
Write-Host 'Profile: baseline-equivalent comparison'
Write-Host "Exit code: $exitCode"
Write-Host "Wrapper log: $wrapperLogPath"
Write-Host "Native harness evidence: $nativeEvidenceDir"
Write-Host "Wrapper metadata: $wrapperMetadataPath"
if ($failureMessage) {
    Write-Host "Failure: $failureMessage"
}
Write-Host 'No additional load profile was started.'
Write-Host 'Previous environment values and working directory restored.'
Write-Host '========================================================'
