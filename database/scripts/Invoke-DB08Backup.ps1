[CmdletBinding()]
param(
    [string] $PgDumpPath = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe',
    [string] $PgRestorePath = 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe',
    [string] $PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
    [string] $BackupPath = '',
    [ValidateSet('campus_duo_migrator')]
    [string] $BackupIdentity = 'campus_duo_migrator',
    [switch] $Execute,
    [switch] $ConfirmSourceQuiescent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceHost = 'localhost'
$sourcePort = '5432'
$sourceDatabase = 'campus_duo_dev'
$databaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $databaseRoot '..')).Path

if (-not $Execute) {
    Write-Output "Preparation-only: would dump $sourceHost`:$sourcePort/$sourceDatabase in PostgreSQL custom format as $BackupIdentity."
    Write-Output 'Re-run with -Execute -ConfirmSourceQuiescent after explicit approval.'
    exit 0
}
if (-not $ConfirmSourceQuiescent) {
    throw 'Backup execution requires -ConfirmSourceQuiescent. Stop all source writers, migrations, tests, and dispatchers for the dump and metadata collection.'
}

function Resolve-Executable {
    param([string] $Path, [string] $Name)
    if ($Path) {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            throw "Executable was not found: $Path"
        }
        return (Resolve-Path -LiteralPath $Path).Path
    }
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name was not found on PATH."
    }
    return $command.Source
}

function Invoke-NativeChecked {
    param([string] $Executable, [string[]] $Arguments, [string] $Operation)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with native exit code $LASTEXITCODE."
    }
}

function Read-PrivatePassword {
    $secure = Read-Host "Enter $BackupIdentity password for DB-08 backup" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Assert-ExternalBackupPath {
    param([string] $Path)
    $resolved = [IO.Path]::GetFullPath($Path)
    $repo = [IO.Path]::GetFullPath($workspaceRoot).TrimEnd('\') + '\'
    $oneDrive = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE 'OneDrive')).TrimEnd('\') + '\'
    if ($resolved.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase) -or
        $resolved.StartsWith($oneDrive, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Backup archives must be stored outside the repository and OneDrive: $resolved"
    }
    return $resolved
}

$pgDump = Resolve-Executable -Path $PgDumpPath -Name 'pg_dump'
$pgRestore = Resolve-Executable -Path $PgRestorePath -Name 'pg_restore'
$psql = Resolve-Executable -Path $PsqlPath -Name 'psql'

if (-not $BackupPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $BackupPath = Join-Path $env:ProgramData "CampusDuo\backups\campus_duo_dev-$stamp.dump"
}
$archivePath = Assert-ExternalBackupPath $BackupPath
$metadataPath = "$archivePath.metadata.json"
$parent = Split-Path -Parent $archivePath
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
if (Test-Path -LiteralPath $archivePath -PathType Any) {
    throw "Refusing to overwrite existing backup archive: $archivePath"
}
if (Test-Path -LiteralPath $metadataPath -PathType Any) {
    throw "Refusing to overwrite existing backup metadata: $metadataPath"
}

$password = Read-PrivatePassword
$oldPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $password, 'Process')
    Invoke-NativeChecked -Executable $pgDump -Arguments @(
        '--format=custom', '--no-password', '--host', $sourceHost, '--port', $sourcePort,
        '--username', $BackupIdentity, '--dbname', $sourceDatabase, '--file', $archivePath
    ) -Operation 'pg_dump custom-format backup'

    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw "pg_dump reported success but archive was not created: $archivePath"
    }
    $archiveItem = Get-Item -LiteralPath $archivePath
    if ($archiveItem.Length -le 0) {
        throw "Backup archive is empty: $archivePath"
    }

    Invoke-NativeChecked -Executable $pgRestore -Arguments @(
        '--list', $archivePath
    ) -Operation 'pg_restore archive listing'

    $countsJson = & $psql -X -w -v ON_ERROR_STOP=1 -At `
        '--host' $sourceHost '--port' $sourcePort '--username' $BackupIdentity `
        '--dbname' $sourceDatabase '--command' @'
SELECT jsonb_build_object(
    'user_account', (SELECT count(*) FROM campus_duo.user_account),
    'student_profile', (SELECT count(*) FROM campus_duo.student_profile),
    'profile_preferred_time', (SELECT count(*) FROM campus_duo.profile_preferred_time),
    'course', (SELECT count(*) FROM campus_duo.course),
    'profile_course', (SELECT count(*) FROM campus_duo.profile_course),
    'social_interest', (SELECT count(*) FROM campus_duo.social_interest),
    'profile_interest', (SELECT count(*) FROM campus_duo.profile_interest),
    'consent_record', (SELECT count(*) FROM campus_duo.consent_record),
    'consent_history', (SELECT count(*) FROM campus_duo.consent_history),
    'discovery_action', (SELECT count(*) FROM campus_duo.discovery_action),
    'connection', (SELECT count(*) FROM campus_duo.connection),
    'block', (SELECT count(*) FROM campus_duo.block),
    'study_location', (SELECT count(*) FROM campus_duo.study_location),
    'study_table', (SELECT count(*) FROM campus_duo.study_table),
    'study_slot', (SELECT count(*) FROM campus_duo.study_slot),
    'booking', (SELECT count(*) FROM campus_duo.booking),
    'booking_participant', (SELECT count(*) FROM campus_duo.booking_participant),
    'idempotency_record', (SELECT count(*) FROM campus_duo.idempotency_record),
    'notification', (SELECT count(*) FROM campus_duo.notification),
    'moderation_report', (SELECT count(*) FROM campus_duo.moderation_report),
    'audit_event', (SELECT count(*) FROM campus_duo.audit_event),
    'outbox_event', (SELECT count(*) FROM campus_duo.outbox_event)
)::text;
'@
    if ($LASTEXITCODE -ne 0) {
        throw "Backup-time row-count query failed with native exit code $LASTEXITCODE."
    }
    $counts = $countsJson.Trim() | ConvertFrom-Json

    $fixtureJson = & $psql -X -w -v ON_ERROR_STOP=1 -At `
        '--host' $sourceHost '--port' $sourcePort '--username' $BackupIdentity `
        '--dbname' $sourceDatabase '--command' @'
SELECT jsonb_build_object(
    'alex_user', (SELECT to_jsonb(u) FROM campus_duo.user_account u WHERE user_id = '00000000-0000-0000-0000-00000000D501'::uuid),
    'sam_user', (SELECT to_jsonb(u) FROM campus_duo.user_account u WHERE user_id = '00000000-0000-0000-0000-00000000D502'::uuid),
    'discovery_action', (SELECT to_jsonb(d) FROM campus_duo.discovery_action d WHERE action_id = '00000000-0000-0000-0000-00000000D551'::uuid),
    'connection', (SELECT to_jsonb(c) FROM campus_duo.connection c WHERE connection_id = '00000000-0000-0000-0000-00000000D561'::uuid),
    'successor_slot', (SELECT to_jsonb(s) FROM campus_duo.study_slot s WHERE slot_id = '00000000-0000-0000-0000-00000000D576'::uuid),
    'source_booking', (SELECT to_jsonb(b) FROM campus_duo.booking b WHERE booking_id = '00000000-0000-0000-0000-00000000D581'::uuid),
    'historical_booking', (SELECT to_jsonb(b) FROM campus_duo.booking b WHERE booking_id = '00000000-0000-0000-0000-00000000D582'::uuid),
    'notification', (SELECT to_jsonb(n) FROM campus_duo.notification n WHERE notification_id = '00000000-0000-0000-0000-00000000D5A1'::uuid)
)::text;
'@
    if ($LASTEXITCODE -ne 0) {
        throw "Backup-time fixture identity query failed with native exit code $LASTEXITCODE."
    }
    $fixtures = $fixtureJson.Trim() | ConvertFrom-Json

    $sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    $manifest = [ordered]@{
        format = 'PostgreSQL custom'
        source_host = $sourceHost
        source_port = $sourcePort
        source_database = $sourceDatabase
        backup_identity = $BackupIdentity
        archive_path = $archivePath
        archive_size_bytes = [int64]$archiveItem.Length
        archive_sha256 = $sha256
        created_utc = [DateTime]::UtcNow.ToString('o')
        consistency_mode = 'operator-confirmed-quiescent'
        row_counts = $counts
        fixture_identities = $fixtures
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding UTF8 -NoNewline
    Write-Output "PASS: backup archive, listing, size, SHA-256, and password-free metadata manifest created."
    Write-Output "Archive: $archivePath"
    Write-Output "Manifest: $metadataPath"
}
finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $oldPassword, 'Process')
    $password = $null
}
