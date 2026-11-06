Set-StrictMode -Version Latest

function Resolve-PerformanceMigrationPath([string] $ScriptRoot) {
    $databaseRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..\..\database') -ErrorAction Stop).Path
    return (Resolve-Path (Join-Path $databaseRoot 'migrations') -ErrorAction Stop).Path
}

function Test-ExistingTargetIdentity(
    [object] $Identity,
    [string] $ExpectedDatabase = 'campus_duo_perf_20261103'
) {
    if ($null -eq $Identity) {
        return $false
    }
    $required = @('database', 'role', 'address', 'port', 'owner')
    foreach ($name in $required) {
        $property = $Identity.PSObject.Properties[$name]
        if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            return $false
        }
    }
    return $Identity.database -eq $ExpectedDatabase -and
        $Identity.role -eq 'campus_duo_migrator' -and
        $Identity.address -eq '127.0.0.1' -and
        $Identity.port -eq '5432' -and
        $Identity.owner -eq 'campus_duo_migrator'
}

function Get-AvailabilityRequiredColumns {
    @(
        [pscustomobject]@{ Relation = 'campus_duo.study_location'; Column = 'location_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_location'; Column = 'name' }
        [pscustomobject]@{ Relation = 'campus_duo.study_location'; Column = 'building' }
        [pscustomobject]@{ Relation = 'campus_duo.study_location'; Column = 'active' }
        [pscustomobject]@{ Relation = 'campus_duo.study_table'; Column = 'table_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_table'; Column = 'location_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_table'; Column = 'table_number' }
        [pscustomobject]@{ Relation = 'campus_duo.study_table'; Column = 'capacity' }
        [pscustomobject]@{ Relation = 'campus_duo.study_table'; Column = 'active' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'slot_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'location_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'table_id' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'local_date' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'start_time' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'end_time' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'zone' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'status' }
        [pscustomobject]@{ Relation = 'campus_duo.study_slot'; Column = 'active' }
        [pscustomobject]@{ Relation = 'campus_duo.booking'; Column = 'booking_id' }
        [pscustomobject]@{ Relation = 'campus_duo.booking'; Column = 'table_id' }
        [pscustomobject]@{ Relation = 'campus_duo.booking'; Column = 'local_date' }
        [pscustomobject]@{ Relation = 'campus_duo.booking'; Column = 'slot_id' }
        [pscustomobject]@{ Relation = 'campus_duo.booking'; Column = 'status' }
    )
}

function Test-ApplicationSchemaUsageResult([object] $Result) {
    if ($null -eq $Result) {
        throw 'Application schema privilege result is null.'
    }
    if ($Result -is [bool]) {
        return [bool]$Result
    }
    if ($Result -is [string] -and $Result -in @('true', 'false')) {
        return $Result -eq 'true'
    }
    throw "Application schema privilege result '$Result' is malformed."
}

function Test-AvailabilityColumnPrivilegeResults(
    [object] $Results
) {
    $expected = @(Get-AvailabilityRequiredColumns)
    if ($expected.Count -ne 23) {
        throw "Availability privilege contract must contain exactly 23 columns, found $($expected.Count)."
    }
    if ($null -eq $Results) {
        throw 'Availability privilege result is null.'
    }
    $actual = @($Results)
    $invalid = @($actual | Where-Object {
        $relationProperty = if ($null -eq $_) { $null } else { $_.PSObject.Properties['relation'] }
        $columnProperty = if ($null -eq $_) { $null } else { $_.PSObject.Properties['column'] }
        $allowedProperty = if ($null -eq $_) { $null } else { $_.PSObject.Properties['allowed'] }
        $null -eq $relationProperty -or $null -eq $columnProperty -or
            $null -eq $allowedProperty -or
            [string]::IsNullOrWhiteSpace([string]$relationProperty.Value) -or
            [string]::IsNullOrWhiteSpace([string]$columnProperty.Value) -or
            $null -eq $allowedProperty.Value -or
            $allowedProperty.Value -isnot [bool]
    })
    if ($invalid.Count -gt 0) {
        throw 'Availability privilege result contains missing, null, or malformed entries.'
    }
    $actualKeys = @($actual | ForEach-Object { "$($_.relation).$($_.column)" })
    $duplicateKeys = @($actualKeys | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    $expectedKeys = @($expected | ForEach-Object { "$($_.Relation).$($_.Column)" })
    $missingKeys = @($expectedKeys | Where-Object { $_ -notin $actualKeys })
    $unexpectedKeys = @($actualKeys | Where-Object { $_ -notin $expectedKeys } | Sort-Object -Unique)
    if ($duplicateKeys.Count -gt 0 -or $missingKeys.Count -gt 0 -or $unexpectedKeys.Count -gt 0) {
        throw "Availability privilege result identity mismatch. Missing=$($missingKeys -join ','); Unexpected=$($unexpectedKeys -join ','); Duplicate=$($duplicateKeys -join ',')."
    }
    $failed = @($actual | Where-Object { $_.allowed -ne $true })
    if ($failed.Count -gt 0) {
        $details = $failed | ForEach-Object { "$($_.relation).$($_.column)" }
        throw "Application availability column privilege denied: $($details -join ', ')."
    }
    [pscustomobject]@{
        Valid = $true
        Count = $actual.Count
        Failed = @()
    }
}

function Test-MigrationCompletionState(
        [object] $HistoryEntries,
        [object] $ExpectedMigrationVersions,
        [AllowNull()][object] $MissingTables
    ) {
        if ($null -eq $HistoryEntries -or $null -eq $ExpectedMigrationVersions) {
            throw 'Migration completion input is null; refusing to claim completion.'
        }
        $entries = @($HistoryEntries)
        $expected = @($ExpectedMigrationVersions)
        if ($expected.Count -eq 0) {
            throw 'Migration completion expected-version set is empty.'
        }
        $invalidEntries = @($entries | Where-Object {
            if ($null -eq $_) {
                return $true
            }
            $versionProperty = $_.PSObject.Properties['version']
            $successProperty = $_.PSObject.Properties['success']
            if ($null -eq $versionProperty -or $null -eq $successProperty) {
                return $true
            }
            $null -eq $versionProperty.Value -or
            $null -eq $successProperty.Value -or
            $versionProperty.Value.ToString() -notmatch '^\d+$' -or
            $successProperty.Value -isnot [bool]
        })
        if ($invalidEntries.Count -gt 0) {
            throw 'Migration completion history contains malformed or null entries.'
        }
        $versions = @($entries | ForEach-Object { [int]$_.version })
        $expectedInts = @($expected | ForEach-Object { [int]$_ })
        $duplicates = @($versions | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { [int]$_.Name })
        $missing = @($expectedInts | Where-Object { $_ -notin $versions })
        $unexpected = @($versions | Where-Object { $_ -notin $expectedInts } | Sort-Object -Unique)
        $failed = @($entries | Where-Object { $_.success -ne $true })
        $missingTableNames = @()
        if ($null -eq $MissingTables) {
            throw 'Required-table completion result is null.'
        } elseif ($MissingTables -is [string]) {
            if (-not [string]::IsNullOrWhiteSpace($MissingTables)) {
                $missingTableNames = @($MissingTables -split ',')
            }
        } else {
            $missingTableNames = @($MissingTables)
        }
        [pscustomobject]@{
            Valid = $entries.Count -eq $expectedInts.Count -and
                $failed.Count -eq 0 -and $missing.Count -eq 0 -and
                $unexpected.Count -eq 0 -and $duplicates.Count -eq 0 -and
                $missingTableNames.Count -eq 0
            EntryCount = $entries.Count
            FailedVersions = @($failed | ForEach-Object { [int]$_.version })
            MissingVersions = $missing
            UnexpectedVersions = $unexpected
            DuplicateVersions = $duplicates
            MissingTables = $missingTableNames
        }
}

function Get-RequiredVersionedMigrations([string] $MigrationPath) {
    if (-not (Test-Path -LiteralPath $MigrationPath -PathType Container)) {
        throw "Migration directory '$MigrationPath' does not exist."
    }

    $files = @(Get-ChildItem -LiteralPath $MigrationPath -File -Filter '*.sql' |
        Where-Object { $_.Name -match '^V(?<version>\d+)__.+\.sql$' } |
        Sort-Object Name)
    if ($files.Count -eq 0) {
        throw "No versioned migration files were found in '$MigrationPath'."
    }
    $versions = @($files | ForEach-Object {
        $match = [regex]::Match($_.Name, '^V(?<version>\d+)__.+\.sql$')
        [int]$match.Groups['version'].Value
    } | Sort-Object -Unique)
    $expected = 1..8
    $missing = @($expected | Where-Object { $_ -notin $versions })
    if ($missing.Count -gt 0) {
        throw "Required versioned migrations are missing from '$MigrationPath': $($missing -join ', ')."
    }
    [pscustomobject]@{
        Files = $files
        Versions = $expected
    }
}
