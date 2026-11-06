$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$provisionScript = Join-Path $repoRoot 'backend\scripts\performance\Invoke-Prepare-PerformanceDatabase.ps1'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$flywayPath = 'C:\Users\mohit\Tools\flyway-13.10.0\flyway.cmd'
$targetDatabase = 'campus_duo_perf_20261103'
$evidenceRoot = Join-Path $repoRoot 'required docs\deliverable-3\evidence\performance-provisioning'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $evidenceRoot "current-$timestamp"
$logPath = Join-Path $evidenceDir 'provisioning-output.txt'
$metadataPath = Join-Path $evidenceDir 'provisioning-metadata.json'

$environmentNames = @(
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'FLYWAY_PASSWORD'
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($null -ne $item) { $item.Value } else { $null }
}

$originalLocation = (Get-Location).Path
$exitCode = $null
$failureMessage = $null

try {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

    if (-not (Test-Path -LiteralPath $provisionScript -PathType Leaf)) {
        throw "Provisioning script was not found: $provisionScript"
    }
    if (-not (Test-Path -LiteralPath $psqlPath -PathType Leaf)) {
        throw "PostgreSQL executable was not found: $psqlPath"
    }
    if (-not (Test-Path -LiteralPath $flywayPath -PathType Leaf)) {
        throw "Flyway executable was not found: $flywayPath"
    }

    Set-Location -LiteralPath $repoRoot

    # The target now has Flyway history rows. Verify it read-only instead of
    # selecting a resume path or making any database mutation.
    & $provisionScript `
        -PerformanceDatabase $targetDatabase `
        -VerifyExistingTarget `
        -PsqlPath $psqlPath `
        -FlywayPath $flywayPath 2>&1 |
        Tee-Object -FilePath $logPath
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
    targetDatabase = $targetDatabase
    mode = 'VerifyExistingTarget'
    psqlPath = $psqlPath
    flywayPath = $flywayPath
    command = ".\backend\scripts\performance\Invoke-Prepare-PerformanceDatabase.ps1 -PerformanceDatabase $targetDatabase -VerifyExistingTarget -PsqlPath '$psqlPath' -FlywayPath '$flywayPath'"
    exitCode = $exitCode
    logPath = $logPath
    scope = 'Read-only target identity, Flyway validation/checksum verification, migration completion, required-object, ownership, and application-role access checks only; no migration or load test.'
}
if (Test-Path -LiteralPath $evidenceDir -PathType Container) {
    $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
}

Write-Host ''
Write-Host '========== PERFORMANCE PROVISIONING CHECKPOINT =========='
Write-Host "Target: $targetDatabase"
Write-Host 'Mode: VerifyExistingTarget (read-only)'
Write-Host "Exit code: $exitCode"
Write-Host "Provisioning log: $logPath"
Write-Host "Metadata: $metadataPath"
if ($failureMessage) {
    Write-Host "Failure: $failureMessage"
}
Write-Host 'No load testing was started.'
Write-Host 'Previous environment values and working directory restored.'
Write-Host '=========================================================='
