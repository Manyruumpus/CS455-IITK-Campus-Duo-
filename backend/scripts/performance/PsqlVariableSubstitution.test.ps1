$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$diagnosticScript = Get-Content -LiteralPath (Join-Path $repoRoot 'Run-PerformanceAvailabilityDiagnostic.ps1') -Raw
$planSqlPath = Join-Path $PSScriptRoot 'availability-explain-analyze.sql'
$planSql = Get-Content -LiteralPath $planSqlPath -Raw

if ($diagnosticScript -notmatch [regex]::Escape("'-f', `$planSqlPath")) {
    throw 'Diagnostic does not execute the plan through psql -f.'
}
if ($diagnosticScript -notmatch [regex]::Escape("'-v', `"test_date=`$testDate`"")) {
    throw 'Diagnostic does not pass test_date through an explicit psql -v assignment.'
}
if ($diagnosticScript -notmatch [regex]::Escape("'-v', `"location_id=`$locationId`"")) {
    throw 'Diagnostic does not pass location_id through an explicit psql -v assignment.'
}
if ($diagnosticScript -match '\$planSql\s*=\s*@') {
    throw 'Diagnostic still builds the EXPLAIN SQL inline instead of using the SQL file.'
}
foreach ($variable in @('test_date', 'location_id')) {
    if ($planSql -notmatch [regex]::Escape(":'$variable'")) {
        throw "Plan SQL does not use safe top-level psql variable quoting for $variable."
    }
}

Write-Output 'PASS: psql variable substitution is configured through -f with explicit -v values and safe :''variable'' references.'
