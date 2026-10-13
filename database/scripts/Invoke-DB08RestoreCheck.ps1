[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ArchivePath,
    [Parameter(Mandatory = $true)]
    [string] $ManifestPath,
    [string] $PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
    [string] $PgRestorePath = 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe',
    [string] $AdminUser = 'postgres',
    [switch] $Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$targetHost = 'localhost'
$targetPort = '5432'
$targetDatabase = 'campus_duo_restore_check'
$databaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$verifierPath = Join-Path $databaseRoot 'tests\DB-08_restore_verification.sql'
$privilegeVerifierSource = Join-Path $databaseRoot 'tests\06_privilege_catalog_verification.sql'
$scratchCreated = $false

function Resolve-Executable {
    param([string] $Path, [string] $Name)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Executable was not found: $Path"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Invoke-NativeChecked {
    param([string] $Executable, [string[]] $Arguments, [string] $Operation)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with native exit code $LASTEXITCODE."
    }
}

function Read-PrivatePassword {
    $secure = Read-Host "Enter $AdminUser password for DB-08 restore check" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

if (-not $Execute) {
    Write-Output 'Preparation-only: restore was not executed. Re-run with -Execute after explicit approval.'
    exit 0
}
if ($targetDatabase -eq 'campus_duo_dev') {
    throw 'Restore target safety failure: campus_duo_dev is never an allowed scratch target.'
}
if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
    throw "Backup archive was not found: $ArchivePath"
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Backup metadata manifest was not found: $ManifestPath"
}
if (-not (Test-Path -LiteralPath $verifierPath -PathType Leaf)) {
    throw "Restore verifier was not found: $verifierPath"
}
if (-not (Test-Path -LiteralPath $privilegeVerifierSource -PathType Leaf)) {
    throw "DB-07 privilege verifier was not found: $privilegeVerifierSource"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.format -ne 'PostgreSQL custom' -or
    $manifest.source_host -ne 'localhost' -or
    $manifest.source_port -ne '5432' -or
    $manifest.source_database -ne 'campus_duo_dev' -or
    $manifest.consistency_mode -ne 'operator-confirmed-quiescent') {
    throw 'Backup metadata manifest source, format, or consistency mode is invalid.'
}
if ([int64]$manifest.archive_size_bytes -le 0) {
    throw 'Backup metadata manifest archive size must be positive.'
}
$archiveItem = Get-Item -LiteralPath $ArchivePath
if ($archiveItem.Length -ne [int64]$manifest.archive_size_bytes) {
    throw 'Backup archive size does not match the metadata manifest.'
}
if (-not ($manifest.archive_sha256 -match '^[0-9A-Fa-f]{64}$')) {
    throw 'Backup metadata manifest SHA-256 is invalid.'
}
$archiveHash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash
if ($archiveHash -ne $manifest.archive_sha256) {
    throw "Archive SHA-256 does not match the password-free metadata manifest."
}
foreach ($property in @(
    'user_account','student_profile','profile_preferred_time','course',
    'profile_course','social_interest','profile_interest','consent_record',
    'consent_history','discovery_action','connection','block',
    'study_location','study_table','study_slot','booking',
    'booking_participant','idempotency_record','notification',
    'moderation_report','audit_event','outbox_event'
)) {
    $value = $manifest.row_counts.$property
    if ($null -eq $value -or $value -is [bool] -or
        [int64]$value -lt 0 -or ([string]$value -notmatch '^\d+$')) {
        throw "Backup metadata row count is not a nonnegative integer: $property"
    }
}
$psql = Resolve-Executable -Path $PsqlPath -Name 'psql'
$pgRestore = Resolve-Executable -Path $PgRestorePath -Name 'pg_restore'
$password = Read-PrivatePassword
$oldPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $password, 'Process')
    $existing = @(& $psql -X -w -At `
        '--host' $targetHost '--port' $targetPort '--username' $AdminUser `
        '--dbname' 'postgres' '--command' "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$targetDatabase');")
    if ($LASTEXITCODE -ne 0) {
        throw "Scratch-target existence check failed with native exit code $LASTEXITCODE."
    }
    if ($existing.Count -ne 1 -or $existing[0] -notmatch '^(t|f)$') {
        throw "Scratch-target existence check returned an invalid boolean result."
    }
    if ($existing[0] -eq 't') {
        throw "Refusing to use existing scratch database: $targetDatabase. Cleanup is a separate approved action."
    }

    Invoke-NativeChecked -Executable $psql -Arguments @(
        '-X', '-w', '-v', 'ON_ERROR_STOP=1', '--host', $targetHost, '--port', $targetPort,
        '--username', $AdminUser, '--dbname', 'postgres',
        '--command', "DO `$`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN RAISE EXCEPTION 'restore administrator must be a superuser'; END IF; IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('campus_duo_migrator', 'campus_duo_app', 'campus_duo_admin_service', 'campus_duo_worker')) <> 4 THEN RAISE EXCEPTION 'all four required Campus Duo roles must exist'; END IF; END `$`$;"
    ) -Operation 'restore administrator and role prerequisite validation'

    Invoke-NativeChecked -Executable $psql -Arguments @(
        '-X', '-w', '-v', 'ON_ERROR_STOP=1', '--host', $targetHost, '--port', $targetPort,
        '--username', $AdminUser, '--dbname', 'postgres',
        '--command', "CREATE DATABASE $targetDatabase OWNER campus_duo_migrator TEMPLATE template0;"
    ) -Operation 'scratch database creation'
    $scratchCreated = $true

    Invoke-NativeChecked -Executable $pgRestore -Arguments @(
        '--no-password', '--exit-on-error', '--format=custom', '--host', $targetHost, '--port', $targetPort,
        '--username', $AdminUser, '--dbname', $targetDatabase, $ArchivePath
    ) -Operation 'scratch database restore'

    $countArgs = @(
        '-X', '-w', '-v', 'ON_ERROR_STOP=1', '--host', $targetHost, '--port', $targetPort,
        '--username', $AdminUser, '--dbname', $targetDatabase, '--file', $verifierPath,
        '--variable', "expected_user_account_count=$($manifest.row_counts.user_account)",
        '--variable', "expected_student_profile_count=$($manifest.row_counts.student_profile)",
        '--variable', "expected_profile_preferred_time_count=$($manifest.row_counts.profile_preferred_time)",
        '--variable', "expected_course_count=$($manifest.row_counts.course)",
        '--variable', "expected_profile_course_count=$($manifest.row_counts.profile_course)",
        '--variable', "expected_social_interest_count=$($manifest.row_counts.social_interest)",
        '--variable', "expected_profile_interest_count=$($manifest.row_counts.profile_interest)",
        '--variable', "expected_consent_record_count=$($manifest.row_counts.consent_record)",
        '--variable', "expected_consent_history_count=$($manifest.row_counts.consent_history)",
        '--variable', "expected_discovery_action_count=$($manifest.row_counts.discovery_action)",
        '--variable', "expected_connection_count=$($manifest.row_counts.connection)",
        '--variable', "expected_block_count=$($manifest.row_counts.block)",
        '--variable', "expected_study_location_count=$($manifest.row_counts.study_location)",
        '--variable', "expected_study_table_count=$($manifest.row_counts.study_table)",
        '--variable', "expected_study_slot_count=$($manifest.row_counts.study_slot)",
        '--variable', "expected_booking_count=$($manifest.row_counts.booking)",
        '--variable', "expected_booking_participant_count=$($manifest.row_counts.booking_participant)",
        '--variable', "expected_idempotency_record_count=$($manifest.row_counts.idempotency_record)",
        '--variable', "expected_notification_count=$($manifest.row_counts.notification)",
        '--variable', "expected_moderation_report_count=$($manifest.row_counts.moderation_report)",
        '--variable', "expected_audit_event_count=$($manifest.row_counts.audit_event)",
        '--variable', "expected_outbox_event_count=$($manifest.row_counts.outbox_event)"
    )
    Invoke-NativeChecked -Executable $psql -Arguments $countArgs -Operation 'scratch restore verification'

    $tempPrivilegeVerifier = Join-Path ([IO.Path]::GetTempPath()) ("db08-privilege-verifier-{0}.sql" -f [guid]::NewGuid())
    try {
        (Get-Content -LiteralPath $privilegeVerifierSource -Raw).Replace(
            "current_database() <> 'campus_duo_dev'",
            "current_database() <> '$targetDatabase'"
        ) | Set-Content -LiteralPath $tempPrivilegeVerifier -Encoding UTF8 -NoNewline
        Invoke-NativeChecked -Executable $psql -Arguments @(
            '-X', '-w', '-v', 'ON_ERROR_STOP=1', '--host', $targetHost, '--port', $targetPort,
            '--username', $AdminUser, '--dbname', $targetDatabase, '--file', $tempPrivilegeVerifier
        ) -Operation 'target-aware DB-07 privilege verification'
    }
    finally {
        Remove-Item -LiteralPath $tempPrivilegeVerifier -Force -ErrorAction SilentlyContinue
    }
    Write-Output "PASS: scratch restore and read-only verification completed for $targetDatabase."
    Write-Output 'The scratch database was intentionally not dropped.'
}
catch {
    if ($scratchCreated) {
        Write-Error "DB-08 restore failed after scratch creation. The partial scratch database $targetDatabase was retained for separate approved inspection/cleanup. No automatic drop was attempted."
    }
    else {
        Write-Error 'DB-08 restore failed before scratch database creation. No scratch database was created by this run.'
    }
    throw
}
finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $oldPassword, 'Process')
    $password = $null
}
