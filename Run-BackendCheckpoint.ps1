$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $repoRoot 'backend'
$evidenceRoot = Join-Path $repoRoot 'required docs\deliverable-3\evidence'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$testEvidenceDir = Join-Path $evidenceRoot "backend-tests\current-full-suite-$timestamp"
$coverageEvidenceDir = Join-Path $evidenceRoot "backend-coverage\current-full-suite-$timestamp"
$testLogPath = Join-Path $testEvidenceDir 'vitest-output.txt'
$metadataPath = Join-Path $testEvidenceDir 'checkpoint.json'
$nativeCoveragePath = Join-Path $backendPath 'coverage'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'

$environmentNames = @(
    'NODE_ENV',
    'ALLOW_TEST_HARNESS_AUTH',
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'CAMPUS_DUO_MIGRATOR_PASSWORD'
)

$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($null -ne $item) { $item.Value } else { $null }
}

$originalLocation = (Get-Location).Path
$testExitCode = $null
$failureMessage = $null
$identityResults = @()
$testLogExists = $false
$coverageEvidenceExists = $false

try {
    New-Item -ItemType Directory -Force -Path $testEvidenceDir, $coverageEvidenceDir | Out-Null

    if (-not (Test-Path -LiteralPath $psqlPath -PathType Leaf)) {
        throw "PostgreSQL executable was not found: $psqlPath"
    }

    $appSecure = Read-Host 'Enter campus_duo_app password' -AsSecureString
    $appPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appSecure)
    try {
        $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($appPtr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($appPtr)
    }

    $migratorSecure = Read-Host 'Enter campus_duo_migrator password' -AsSecureString
    $migratorPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($migratorSecure)
    try {
        $migratorPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($migratorPtr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($migratorPtr)
    }

    $env:NODE_ENV = 'development'
    $env:ALLOW_TEST_HARNESS_AUTH = 'true'
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = 'campus_duo_test'
    $env:CAMPUS_DUO_MIGRATOR_PASSWORD = $migratorPassword

    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DB_HOST, Env:DB_PORT, Env:DB_NAME, Env:DB_USER, Env:DB_PASSWORD -ErrorAction SilentlyContinue

    $identitySql = 'SELECT current_database() || ''|'' || current_user;'

    $env:PGUSER = 'campus_duo_app'
    $env:PGPASSWORD = $appPassword
    $appIdentity = (& $psqlPath -X -w -v ON_ERROR_STOP=1 -At -c $identitySql 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $appIdentity -ne 'campus_duo_test|campus_duo_app') {
        throw "Application identity check failed. Expected campus_duo_test|campus_duo_app; received: $appIdentity"
    }
    $identityResults += "application=$appIdentity"

    $env:PGUSER = 'campus_duo_migrator'
    $env:PGPASSWORD = $migratorPassword
    $migratorIdentity = (& $psqlPath -X -w -v ON_ERROR_STOP=1 -At -c $identitySql 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $migratorIdentity -ne 'campus_duo_test|campus_duo_migrator') {
        throw "Migrator identity check failed. Expected campus_duo_test|campus_duo_migrator; received: $migratorIdentity"
    }
    $identityResults += "migrator=$migratorIdentity"

    $env:PGUSER = 'campus_duo_app'
    $env:PGPASSWORD = $appPassword

    Set-Location -LiteralPath $backendPath
    Write-Host 'Running the full backend Vitest suite with native V8 coverage...'
    & npm test -- --coverage 2>&1 | Tee-Object -FilePath $testLogPath
    $testExitCode = $LASTEXITCODE
    $testLogExists = Test-Path -LiteralPath $testLogPath

    if (Test-Path -LiteralPath $nativeCoveragePath -PathType Container) {
        Copy-Item -LiteralPath $nativeCoveragePath -Destination $coverageEvidenceDir -Recurse -Force
        $coverageEvidenceExists = $true
    }

    $metadata = [ordered]@{
        timestamp = (Get-Date).ToString('o')
        command = 'npm test -- --coverage'
        workingDirectory = $backendPath
        expectedDatabase = 'campus_duo_test'
        identities = $identityResults
        exitCode = $testExitCode
        testLogPath = $testLogPath
        coveragePath = $coverageEvidenceDir
        nativeCoveragePath = $nativeCoveragePath
    }
    $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
}
catch {
    $failureMessage = $_.Exception.Message
    if ($null -eq $testExitCode) {
        $testExitCode = 1
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

$coverageSummaryPath = Join-Path $coverageEvidenceDir 'coverage\coverage-summary.json'
if (-not (Test-Path -LiteralPath $coverageSummaryPath)) {
    $coverageSummaryPath = Join-Path $nativeCoveragePath 'coverage-summary.json'
}

Write-Host ''
Write-Host '========== BACKEND CHECKPOINT RESULT =========='
Write-Host "Exit code: $testExitCode"
Write-Host "Test evidence: $testLogPath"
Write-Host "Metadata evidence: $metadataPath"
Write-Host "Coverage evidence: $coverageEvidenceDir"
Write-Host "Native coverage available: $coverageEvidenceExists"

if ($failureMessage) {
    Write-Host "Failure: $failureMessage"
}

if (Test-Path -LiteralPath $testLogPath -PathType Leaf) {
    $testSummaryLines = Get-Content -LiteralPath $testLogPath |
        Where-Object { $_ -match 'Test Files|Tests|passed|failed|skipped' } |
        Select-Object -Last 8
    Write-Host ''
    Write-Host 'Final test summary:'
    if ($testSummaryLines) {
        $testSummaryLines | ForEach-Object { Write-Host $_ }
    }
    else {
        Write-Host 'Native test summary was not found in the captured log.'
    }
}

if (Test-Path -LiteralPath $coverageSummaryPath -PathType Leaf) {
    $coverage = Get-Content -LiteralPath $coverageSummaryPath -Raw | ConvertFrom-Json
    $total = $coverage.total
    Write-Host ''
    Write-Host 'Final coverage totals:'
    Write-Host "Statements: $($total.statements.pct)%"
    Write-Host "Branches:  $($total.branches.pct)%"
    Write-Host "Functions: $($total.functions.pct)%"
    Write-Host "Lines:     $($total.lines.pct)%"
}
else {
    Write-Host ''
    Write-Host 'Final coverage totals: coverage-summary.json was not produced.'
}

Write-Host 'Previous environment values and working directory restored.'
Write-Host '================================================'
