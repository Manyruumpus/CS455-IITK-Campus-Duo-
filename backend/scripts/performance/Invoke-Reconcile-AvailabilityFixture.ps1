[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ManifestPath,
    [string] $PsqlPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($manifest.database -ne 'campus_duo_perf_20261103') {
    throw 'Manifest database is not the allowlisted performance database.'
}
if ($manifest.slotIds.Count -ne 12) {
    throw 'Manifest must contain exactly 12 slot IDs.'
}
$psql = if ($PsqlPath) { (Resolve-Path -LiteralPath $PsqlPath).Path } else { (Get-Command psql -ErrorAction Stop).Source }
$sqlPath = Join-Path $PSScriptRoot 'availability-fixture-reconcile.sql'
$password = Read-Host 'Enter disposable database migrator password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try { $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$old = @{}
foreach ($name in @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD')) {
    $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGDATABASE = $manifest.database
    $env:PGUSER = 'campus_duo_migrator'
    $env:PGPASSWORD = $plainPassword
    $args = @('-X', '-v', 'ON_ERROR_STOP=1', '-f', $sqlPath,
        '-v', "ownership_id=$($manifest.ownershipId)",
        '-v', "actor_id=$($manifest.actorId)",
        '-v', "location_id=$($manifest.locationId)",
        '-v', "table_id=$($manifest.tableId)",
        '-v', "test_date=$($manifest.testDate)")
    for ($i = 0; $i -lt 12; $i++) { $args += @('-v', "slot_$($i + 1)=$($manifest.slotIds[$i])") }
    & $psql @args
    if ($LASTEXITCODE -ne 0) { throw 'Read-only fixture reconciliation failed closed.' }
} finally {
    $plainPassword = $null
    foreach ($name in $old.Keys) {
        if ($null -eq $old[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
        else { Set-Item "Env:$name" $old[$name] }
    }
}
