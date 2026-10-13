[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('info', 'validate', 'migrate', 'catalog')]
    [string] $Action,

    [string] $FlywayPath,

    [string] $PsqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',

    [switch] $ConfirmMigrate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$databaseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $databaseRoot '..')).Path
$configPath = Join-Path $databaseRoot 'config\flyway.toml'
$catalogTestPath = Join-Path $databaseRoot 'tests\01_catalog_verification.sql'

function Resolve-Executable {
    param(
        [string] $ExplicitPath,
        [string] $CommandName
    )

    if ($ExplicitPath) {
        if (-not (Test-Path -LiteralPath $ExplicitPath -PathType Leaf)) {
            throw "Executable was not found: $ExplicitPath"
        }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$CommandName was not found on PATH. Install it separately or pass an explicit path."
    }
    return $command.Source
}

function Read-FlywayPassword {
    $secure = Read-Host 'Enter campus_duo_migrator password for this Flyway operation' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Assert-NoConflictingFlywayEnvironment {
    $conflicts = Get-ChildItem Env: |
        Where-Object {
            $_.Name -match '^(?i:FLYWAY_|ENVIRONMENTS_DEFAULT_)' -and
            $_.Name -notin @('FLYWAY_PASSWORD')
        } |
        Select-Object -ExpandProperty Name

    if ($conflicts) {
        throw (
            'Conflicting inherited Flyway settings could redirect the target or user: ' +
            ($conflicts -join ', ') +
            '. Remove them before running this wrapper.'
        )
    }
}

function Invoke-NativeChecked {
    param(
        [string] $Executable,
        [string[]] $Arguments,
        [string] $Operation
    )

    try {
        & $Executable @Arguments
    }
    catch {
        throw "Native $Operation invocation threw before returning an exit code: $($_.Exception.Message)"
    }

    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with native exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Flyway configuration was not found: $configPath"
}

if ($Action -eq 'migrate' -and -not $ConfirmMigrate) {
    throw 'Migration is disabled by default. Re-run with -ConfirmMigrate after reviewing Flyway validate output.'
}

if ($Action -eq 'catalog') {
    $psql = Resolve-Executable -ExplicitPath $PsqlPath -CommandName 'psql'
    if (-not (Test-Path -LiteralPath $catalogTestPath -PathType Leaf)) {
        throw "Catalog verification SQL was not found: $catalogTestPath"
    }

    Invoke-NativeChecked -Executable $psql -Arguments @(
        '-X', '-W', '-v', 'ON_ERROR_STOP=1', '-h', 'localhost', '-p', '5432',
        '-U', 'campus_duo_migrator', '-d', 'campus_duo_dev', '-f', $catalogTestPath
    ) -Operation 'catalog verification'
    exit 0
}

Assert-NoConflictingFlywayEnvironment
$flyway = Resolve-Executable -ExplicitPath $FlywayPath -CommandName 'flyway'
$password = Read-FlywayPassword
$previousPassword = [Environment]::GetEnvironmentVariable('FLYWAY_PASSWORD', 'Process')
$workingDirectory = Get-Location

try {
    # Process-scoped exposure is temporary plumbing, not secure-vault storage.
    [Environment]::SetEnvironmentVariable('FLYWAY_PASSWORD', $password, 'Process')
    Set-Location -LiteralPath $workspaceRoot
    Invoke-NativeChecked -Executable $flyway -Arguments @(
        "-configFiles=$configPath", '-environment=default', $Action
    ) -Operation "Flyway $Action"
}
finally {
    [Environment]::SetEnvironmentVariable('FLYWAY_PASSWORD', $previousPassword, 'Process')
    $password = $null
    Set-Location -LiteralPath $workingDirectory
}
