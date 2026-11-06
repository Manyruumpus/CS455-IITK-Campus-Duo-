$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'PerformanceProvisioningHelpers.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$migrationPath = Join-Path $repoRoot 'database\migrations'
$originalLocation = (Get-Location).Path
try {
    foreach ($workingDirectory in @($repoRoot, (Join-Path $repoRoot 'backend'), (Join-Path $repoRoot 'database'))) {
        Set-Location $workingDirectory
        $resolved = Resolve-PerformanceMigrationPath $PSScriptRoot
        if ($resolved -ne (Resolve-Path $migrationPath).Path) {
            throw "Migration path resolution differed from the repository path when working in '$workingDirectory'."
        }
    }
    $inventory = Get-RequiredVersionedMigrations $migrationPath
    if ($inventory.Files.Count -ne 8 -or ($inventory.Versions -join ',') -ne '1,2,3,4,5,6,7,8') {
        throw 'Migration inventory did not discover the expected V001-V008 set.'
    }
    $successful = @(1..8 | ForEach-Object { [pscustomobject]@{ version = $_; success = $true } })
    if (-not (Test-MigrationCompletionState $successful (1..8) '').Valid) { throw 'Eight successful migrations were rejected.' }
    $validIdentity = [pscustomobject]@{
        database = 'campus_duo_perf_20261103'
        role = 'campus_duo_migrator'
        address = '127.0.0.1'
        port = '5432'
        owner = 'campus_duo_migrator'
    }
    if (-not (Test-ExistingTargetIdentity $validIdentity)) { throw 'Valid existing-target identity was rejected.' }
    foreach ($property in @('database', 'role', 'address', 'port', 'owner')) {
        $invalidIdentity = $validIdentity.PSObject.Copy()
        $invalidIdentity.$property = if ($property -eq 'database') { 'campus_duo_test' } elseif ($property -eq 'role') { 'postgres' } elseif ($property -eq 'address') { '127.0.0.2' } elseif ($property -eq 'port') { '5433' } else { 'postgres' }
        if (Test-ExistingTargetIdentity $invalidIdentity) { throw "Identity mismatch '$property' was accepted." }
    }
    $nullIdentity = [pscustomobject]@{ database = 'campus_duo_perf_20261103'; role = 'campus_duo_migrator'; address = $null; port = '5432'; owner = 'campus_duo_migrator' }
    if (Test-ExistingTargetIdentity $nullIdentity) { throw 'Null identity address was accepted.' }
    $availabilityColumns = @(Get-AvailabilityRequiredColumns)
    if ($availabilityColumns.Count -ne 23) { throw "Expected 23 availability columns, found $($availabilityColumns.Count)." }
    if (-not (Test-ApplicationSchemaUsageResult 'true')) { throw 'Schema USAGE true was rejected.' }
    if (Test-ApplicationSchemaUsageResult 'false') { throw 'Schema USAGE false was accepted.' }
    try { Test-ApplicationSchemaUsageResult $null | Out-Null; throw 'Null schema USAGE was accepted.' } catch {
        if ($_.Exception.Message -eq 'Null schema USAGE was accepted.') { throw }
    }
    $allPrivileges = @($availabilityColumns | ForEach-Object {
        [pscustomobject]@{ relation = $_.Relation; column = $_.Column; allowed = $true }
    })
    if (-not (Test-AvailabilityColumnPrivilegeResults $allPrivileges).Valid) {
        throw 'All required availability column privileges were rejected.'
    }
    $failedPrivilege = @($allPrivileges | ForEach-Object { $_.PSObject.Copy() })
    $failedPrivilege[0].allowed = $false
    try { Test-AvailabilityColumnPrivilegeResults $failedPrivilege | Out-Null; throw 'False availability privilege was accepted.' } catch {
        if ($_.Exception.Message -eq 'False availability privilege was accepted.') { throw }
        if ($_.Exception.Message -notmatch 'campus_duo\.study_location\.location_id') { throw }
    }
    foreach ($invalidCase in @(
        @{ Name = 'null'; Results = $null },
        @{ Name = 'missing'; Results = @($allPrivileges | Select-Object -Skip 1) },
        @{ Name = 'unexpected'; Results = @($allPrivileges) + @([pscustomobject]@{ relation = 'campus_duo.study_slot'; column = 'missing_column'; allowed = $true }) },
        @{ Name = 'duplicate'; Results = @($allPrivileges) + @($allPrivileges[0]) },
        @{ Name = 'null allowed'; Results = @($allPrivileges | ForEach-Object { if ($_.column -eq 'status' -and $_.relation -eq 'campus_duo.study_slot') { [pscustomobject]@{ relation = $_.relation; column = $_.column; allowed = $null } } else { $_ } }) }
    )) {
        try { Test-AvailabilityColumnPrivilegeResults $invalidCase.Results | Out-Null; throw 'Invalid availability privilege result was accepted.' } catch {
            if ($_.Exception.Message -eq 'Invalid availability privilege result was accepted.') { throw "$($invalidCase.Name) case was accepted." }
        }
    }
    $tableLevelFalse = @($allPrivileges | ForEach-Object {
        [pscustomobject]@{ relation = $_.relation; column = $_.column; allowed = $_.allowed }
    })
    if (-not (Test-AvailabilityColumnPrivilegeResults $tableLevelFalse).Valid) {
        throw 'Column privileges were coupled incorrectly to table-level SELECT.'
    }
    $diagnosticPath = Join-Path $PSScriptRoot 'application-access-diagnostic.sql'
    $diagnosticText = Get-Content $diagnosticPath -Raw
    $diagnosticChecks = @([regex]::Matches($diagnosticText, "column_select_(?<relation>study_location|study_table|study_slot|booking)_(?<column>[a-z0-9_]+)") |
        ForEach-Object { "$($_.Groups['relation'].Value).$($_.Groups['column'].Value)" })
    $expectedDiagnosticChecks = @($availabilityColumns | ForEach-Object {
        "$($_.Relation -replace '^campus_duo\.', '').$($_.Column)"
    })
    if ($diagnosticChecks.Count -ne 23 -or
        (@($expectedDiagnosticChecks | Where-Object { $_ -notin $diagnosticChecks }).Count -gt 0) -or
        (@($diagnosticChecks | Where-Object { $_ -notin $expectedDiagnosticChecks }).Count -gt 0)) {
        throw 'Diagnostic availability columns differ from the 23-column availability contract.'
    }
    $provisioningScript = Get-Content (Join-Path $PSScriptRoot 'Invoke-Prepare-PerformanceDatabase.ps1') -Raw
    if ($provisioningScript -match 'has_table_privilege') { throw 'Verifier still uses table-level privilege checks.' }
    foreach ($case in @(
        @{ Entries = @(); Missing = ''; Name = 'zero entries' },
        @{ Entries = @([pscustomobject]@{ version = 1; success = $true }); Missing = ''; Name = 'one entry' },
        @{ Entries = @(1..7 | ForEach-Object { [pscustomobject]@{ version = $_; success = $true } }) + @([pscustomobject]@{ version = 8; success = $false }); Missing = ''; Name = 'failed migration' },
        @{ Entries = $successful + @([pscustomobject]@{ version = 9; success = $true }); Missing = ''; Name = 'unexpected entry' },
        @{ Entries = @(1..7 | ForEach-Object { [pscustomobject]@{ version = $_; success = $true } }) + @([pscustomobject]@{ version = 1; success = $true }); Missing = ''; Name = 'duplicate entry' },
        @{ Entries = $successful; Missing = 'study_slot'; Name = 'missing table' }
    )) {
        if ((Test-MigrationCompletionState $case.Entries (1..8) $case.Missing).Valid) {
            throw "$($case.Name) was incorrectly accepted."
        }
    }
    foreach ($invalid in @($null, @([pscustomobject]@{ version = 1; success = $null }), 'malformed')) {
        try { Test-MigrationCompletionState $invalid (1..8) '' | Out-Null; throw 'Malformed/null history was accepted.' } catch {
            if ($_.Exception.Message -eq 'Malformed/null history was accepted.') { throw }
        }
    }
    try { Test-MigrationCompletionState $successful (1..8) $null | Out-Null; throw 'Null missing-table result was accepted.' } catch {
        if ($_.Exception.Message -eq 'Null missing-table result was accepted.') { throw }
    }
    $provisioningScript = Get-Content (Join-Path $PSScriptRoot 'Invoke-Prepare-PerformanceDatabase.ps1') -Raw
    foreach ($requiredText in @(
        '$appPassword = $null',
        "Read-Host 'Enter campus_duo_app password for access verification' -AsSecureString",
        "'-failOnMissingLocations=true'",
        'Assert-MigrationCompletion'
    )) {
        if ($provisioningScript -notlike "*$requiredText*") {
            throw "Provisioning credential/completion guard missing: $requiredText"
        }
    }
        $setupSql = Get-Content (Join-Path $PSScriptRoot 'availability-fixture-setup.sql') -Raw
        $cleanupSql = Get-Content (Join-Path $PSScriptRoot 'availability-fixture-cleanup.sql') -Raw
        $baselineScript = Get-Content (Join-Path $PSScriptRoot 'Invoke-AvailabilityPerformanceBaseline.ps1') -Raw
        $reconcileScript = Get-Content (Join-Path $PSScriptRoot 'Invoke-Reconcile-AvailabilityFixture.ps1') -Raw
        $reconcileSql = Get-Content (Join-Path $PSScriptRoot 'availability-fixture-reconcile.sql') -Raw
        $requiredFixtureVariables = @(
            'ownership_id', 'actor_id', 'location_id', 'table_id', 'test_date',
            'slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5', 'slot_6',
            'slot_7', 'slot_8', 'slot_9', 'slot_10', 'slot_11', 'slot_12'
        )
        foreach ($fixtureVariable in $requiredFixtureVariables) {
            if ($setupSql -notmatch [regex]::Escape("\if :{?$fixtureVariable}")) {
                throw "Setup does not fail closed for missing variable '$fixtureVariable'."
            }
            if ($cleanupSql -notmatch [regex]::Escape("\if :{?$fixtureVariable}")) {
                throw "Cleanup does not fail closed for missing variable '$fixtureVariable'."
            }
            if ($fixtureVariable -like 'slot_*') {
                if ($baselineScript -notmatch '\$slotIds\[\$i\]' -or
                    $baselineScript -notmatch '\$i -lt 12') {
                    throw "Wrapper does not supply generated slot variables."
                }
            } elseif ($baselineScript -notmatch [regex]::Escape("$fixtureVariable =")) {
                throw "Wrapper does not supply variable '$fixtureVariable'."
            }
        }
        foreach ($sqlText in @($setupSql, $cleanupSql)) {
            $doBodies = [regex]::Matches($sqlText, '(?s)DO \$[^$]*\$(?<body>.*?)\$\w+\$;') |
                ForEach-Object { $_.Groups['body'].Value }
            if (@($doBodies | Where-Object { $_ -match ":'[A-Za-z0-9_]+" }).Count -gt 0) {
                throw 'A psql variable remains inside a dollar-quoted SQL body.'
            }
            if ($sqlText -notmatch "set_config\('campus_duo\.fixture_") {
                throw 'Fixture SQL does not pass quoted values through transaction-local settings.'
            }
        }
        if ($setupSql -match ":'slot_1,:slot_2") {
            throw 'Malformed post-COMMIT slot-variable expression remains.'
        }
        if ($setupSql -notmatch ":'slot_1'\s*\|\|\s*','\s*\|\|\s*:'slot_2'") {
            throw 'Setup reporting does not use individually quoted slot values.'
        }
        if ($setupSql.IndexOf('COMMIT;') -lt $setupSql.IndexOf('expected_slot_ids')) {
            throw 'Fallible setup reporting occurs after COMMIT.'
        }
        if ($baselineScript -notmatch '\$fixtureState = ''unknown''' -or
            $baselineScript -notmatch 'cleanup was not authorized' -or
            $baselineScript -notmatch '\$fixtureState -eq ''committed''') {
            throw 'Fixture lifecycle does not preserve ambiguous state.'
        }
        if ($reconcileScript -notmatch 'campus_duo_perf_20261103' -or
            $reconcileScript -notmatch 'availability-fixture-reconcile\.sql') {
            throw 'Read-only reconciliation script is not target-bound.'
        }
        if ($reconcileSql -notmatch 'BEGIN TRANSACTION READ ONLY' -or
            $reconcileSql -notmatch 'ROLLBACK' -or
            $reconcileSql -notmatch 'cleanup remains unauthorized') {
            throw 'Reconciliation SQL is not read-only and fail-closed.'
        }
        if ($reconcileSql -match '\b(INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER|DROP)\b') {
            throw 'Reconciliation SQL contains a mutating statement.'
        }
        $proposal = Get-Content (Join-Path $PSScriptRoot 'availability-fixture-cleanup-proposal.sql') -Raw
        if ($proposal -notmatch 'NOT FOR EXECUTION' -or $proposal -notmatch 'No CASCADE') {
            throw 'Cleanup proposal is not explicitly review-only and restricted.'
        }
        if ($setupSql -notmatch 'BEGIN;') { throw 'Fixture setup is not transactional.' }
        if ($baselineScript -notmatch 'cleanup was not authorized') {
            throw 'Setup failure does not explicitly deny cleanup authorization.'
        }
        if ($baselineScript -notmatch 'Invoke-Psql \$setupSql \$vars') {
            throw 'Fixture setup invocation is missing.'
        }
        foreach ($ownedIdentifier in @('slot_1', 'slot_12', 'table_id', 'location_id', 'actor_id')) {
            if ($cleanupSql -notmatch [regex]::Escape(":'$ownedIdentifier'")) {
                throw "Cleanup does not target owned identifier '$ownedIdentifier'."
            }
        }
        if ($cleanupSql -match 'LIKE|prefix|ownership_id%') {
            throw 'Cleanup uses broad or prefix-based targeting.'
        }

        $temp = Join-Path ([System.IO.Path]::GetTempPath()) ('campus-duo-empty-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $temp | Out-Null
    try {
        try { Get-RequiredVersionedMigrations $temp | Out-Null; throw 'Empty directory was accepted.' } catch {
            if ($_.Exception.Message -eq 'Empty directory was accepted.') { throw }
        }
        try { Get-RequiredVersionedMigrations (Join-Path $temp 'missing') | Out-Null; throw 'Missing directory was accepted.' } catch {
            if ($_.Exception.Message -eq 'Missing directory was accepted.') { throw }
        }
    } finally {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
    Write-Output 'performance provisioning helper tests passed'
} finally {
    Set-Location $originalLocation
}
