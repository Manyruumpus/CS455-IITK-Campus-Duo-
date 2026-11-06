$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = 'C:\Users\mohit\.copilot\session-state\ed5aa75b-c756-46f5-987b-ea32cd764b28\files\pg-recovery-20261106'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$psql = Join-Path $pgBin 'psql.exe'
$node = (Get-Command node -ErrorAction Stop).Source
$serverEntry = Join-Path $repoRoot 'backend\dist\src\server.js'
$appPort = 4402
$database = 'campus_duo_dev'
$dbHost = '127.0.0.1'
$dbPort = 55432
$actorId = '00000000-0000-0000-0000-00000000D501'
$companionId = '00000000-0000-0000-0000-00000000D502'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runId = "KAN-86-recovery-$timestamp"
$evidenceDir = Join-Path $repoRoot "required docs\deliverable-3\evidence\recovery\$runId"
$clusterLog = Join-Path $evidenceDir 'postgres-ctl.log'
$appStdout = Join-Path $evidenceDir 'app.stdout.log'
$appStderr = Join-Path $evidenceDir 'app.stderr.log'
$transcriptPath = Join-Path $evidenceDir 'checkpoint-transcript.txt'
$metadataPath = Join-Path $evidenceDir 'recovery-metadata.json'
$commandsPath = Join-Path $evidenceDir 'commands.txt'
$appProcess = $null
$clusterStartedByRun = $false
$clusterWasRunning = $false
$bookingId = $null
$operationId = "recovery-$runId"
$fixture = $null
$failure = $null
$exitCode = 1

$environmentNames = @(
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'DATABASE_URL', 'HOST', 'PORT', 'NODE_ENV', 'ALLOW_TEST_HARNESS_AUTH'
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    $previousEnvironment[$name] = if ($null -ne $item) { $item.Value } else { $null }
}
$originalLocation = (Get-Location).Path

function Write-JsonFile {
    param([string]$Path, [object]$Value)
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Invoke-Psql {
    param(
        [string]$Sql,
        [string]$User = 'campus_duo_migrator'
    )
    $env:PGHOST = $dbHost
    $env:PGPORT = "$dbPort"
    $env:PGDATABASE = $database
    $env:PGUSER = $User
    $env:PGPASSWORD = ''
    $result = & $psql -X -v ON_ERROR_STOP=1 -At -c $Sql 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "psql failed for $User with exit code ${code}: $($result -join [Environment]::NewLine)"
    }
    return ($result -join [Environment]::NewLine).Trim()
}

function Save-Text {
    param([string]$Name, [object]$Value)
    ($Value | Out-String).TrimEnd() | Set-Content -LiteralPath (Join-Path $evidenceDir $Name) -Encoding UTF8
}

function Invoke-HttpJson {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body
    )
    $started = [DateTimeOffset]::UtcNow
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $status = $null
    $responseBody = $null
    $errorText = $null
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Uri -Headers $Headers -Body $Body -ContentType 'application/json' -TimeoutSec 10
        $status = [int]$response.StatusCode
        $responseBody = $response.Content
    }
    catch {
        $errorText = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $responseBody = $null
        }
    }
    finally {
        $watch.Stop()
    }
    $result = [ordered]@{
        name = $Name
        startedUtc = $started.ToString('o')
        completedUtc = [DateTimeOffset]::UtcNow.ToString('o')
        elapsedMilliseconds = $watch.Elapsed.TotalMilliseconds
        status = $status
        body = $responseBody
        error = $errorText
    }
    Write-JsonFile (Join-Path $evidenceDir "$Name.json") $result
    return [pscustomobject]$result
}

try {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    @(
        "RunId=$runId"
        "DataDir=$dataDir"
        "Cluster=$dbHost`:$dbPort/$database"
        "SharedPortNeverInterrupted=127.0.0.1:5432"
        "pg_ctl status -D `"$dataDir`""
        "pg_ctl start -D `"$dataDir`" -o `"-p $dbPort -h $dbHost`" -l `"$clusterLog`" -w"
        "pg_ctl stop -D `"$dataDir`" -m immediate -w"
        "pg_ctl start -D `"$dataDir`" -o `"-p $dbPort -h $dbHost`" -l `"$clusterLog`" -w"
    ) | Set-Content -LiteralPath $commandsPath -Encoding UTF8

    foreach ($path in @($dataDir, $pgCtl, $psql, $serverEntry)) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Required recovery path is missing: $path"
        }
    }
    $owner = (Get-Acl -LiteralPath $dataDir).Owner
    if ($owner -notmatch '(?i)\\mohit$') {
        throw "Recovery data-directory owner is unexpected: $owner"
    }
    $config = Get-Content -LiteralPath (Join-Path $dataDir 'postgresql.conf') -Raw
    $startupOptions = Get-Content -LiteralPath (Join-Path $dataDir 'postmaster.opts') -Raw
    $configIsLoopback = $config -match "(?m)^\s*port\s*=\s*55432\s*$" -and
        $config -match "(?m)^\s*listen_addresses\s*=\s*'127\.0\.0\.1'\s*$"
    $optionsAreLoopback = $startupOptions -match '"-p"\s+"55432"' -and
        $startupOptions -match '"-h"\s+"127\.0\.0\.1"'
    if (-not $configIsLoopback -and -not $optionsAreLoopback) {
        throw 'Recovery cluster configuration/startup options did not verify as loopback port 55432.'
    }

    $sharedBefore = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq 5432 } |
        Select-Object LocalAddress, LocalPort, OwningProcess)
    $sharedBefore | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidenceDir 'shared-port-before.json') -Encoding UTF8

    & $pgCtl status -D $dataDir 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'pg-status-before.log')
    $statusCode = $LASTEXITCODE
    $clusterWasRunning = ($statusCode -eq 0)
    if (-not $clusterWasRunning) {
        Write-Host 'Starting isolated PostgreSQL cluster...'
        & $pgCtl start -D $dataDir -o "-p $dbPort -h $dbHost" -l $clusterLog -w
        if ($LASTEXITCODE -ne 0) { throw 'The verified isolated cluster could not be started.' }
        $clusterStartedByRun = $true
    }

    Write-Host 'Checking isolated migrator identity...'
    $identity = Invoke-Psql "SELECT current_database() || '|' || current_user || '|' || inet_server_addr() || '|' || inet_server_port();"
    if ($identity -ne "$database|campus_duo_migrator|127.0.0.1/32|$dbPort") {
        throw "Isolated identity mismatch: $identity"
    }
    Write-Host 'Checking isolated application identity...'
    $appIdentity = Invoke-Psql "SELECT current_database() || '|' || current_user || '|' || inet_server_addr() || '|' || inet_server_port();" 'campus_duo_app'
    if ($appIdentity -ne "$database|campus_duo_app|127.0.0.1/32|$dbPort") {
        throw "Application identity mismatch: $appIdentity"
    }

    $candidateSql = @"
SELECT json_build_object(
  'tableId', s.table_id,
  'locationId', s.location_id,
  'slotId', s.slot_id,
  'localDate', s.local_date,
  'actorId', '$actorId'::uuid,
  'companionStudentId', '$companionId'::uuid
)
FROM campus_duo.study_slot s
WHERE s.local_date = DATE '2026-12-06'
  AND s.status = 'AVAILABLE'
  AND s.active
  AND s.location_id = '00000000-0000-0000-0000-00000000D571'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM campus_duo.booking b
    WHERE b.table_id = s.table_id AND b.local_date = s.local_date
      AND b.slot_id = s.slot_id AND b.status = 'CONFIRMED'
  )
ORDER BY s.slot_id
LIMIT 1;
"@
    Write-Host 'Selecting an unbooked synthetic recovery slot...'
    $candidateRaw = Invoke-Psql $candidateSql
    if ([string]::IsNullOrWhiteSpace($candidateRaw)) {
        throw 'No unbooked owned recovery slot was available; no booking was attempted.'
    }
    $fixture = $candidateRaw | ConvertFrom-Json
    $actorCheck = Invoke-Psql "SELECT count(*) FROM campus_duo.user_account WHERE user_id IN ('$actorId'::uuid, '$companionId'::uuid);"
    if ($actorCheck -ne '2') { throw 'Recovery actor identities were not both present.' }

    $env:PGHOST = $dbHost
    $env:PGPORT = "$dbPort"
    $env:PGDATABASE = $database
    $env:PGUSER = 'campus_duo_app'
    $env:PGPASSWORD = ''
    $env:HOST = $dbHost
    $env:PORT = "$appPort"
    $env:NODE_ENV = 'development'
    $env:ALLOW_TEST_HARNESS_AUTH = 'true'
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Write-Host "Starting recovery app on $dbHost`:$appPort..."
    Set-Location -LiteralPath (Join-Path $repoRoot 'backend')
    $appProcess = Start-Process -FilePath $node -ArgumentList @("`"$serverEntry`"") `
        -WorkingDirectory (Join-Path $repoRoot 'backend') `
        -RedirectStandardOutput $appStdout -RedirectStandardError $appStderr -PassThru

    $healthUri = "http://$dbHost`:$appPort/api/health"
    $health = $null
    $healthDeadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $healthDeadline) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 2
            if ($health.StatusCode -eq 200) { break }
        } catch { Start-Sleep -Milliseconds 250 }
        if ($appProcess.HasExited) { throw "Recovery app exited before readiness: $appStderr" }
    }
    if ($null -eq $health -or $health.StatusCode -ne 200) { throw 'Recovery app did not become ready.' }
    $health.Content | Set-Content -LiteralPath (Join-Path $evidenceDir 'health-before.json') -Encoding UTF8

    $payload = [ordered]@{
        clientOperationId = $operationId
        tableId = "$($fixture.tableId)"
        locationId = "$($fixture.locationId)"
        localDate = "$($fixture.localDate)"
        slotId = "$($fixture.slotId)"
        companionStudentId = $companionId
    } | ConvertTo-Json -Compress
    $headers = @{ 'X-Campus-Duo-Test-Actor' = $actorId }
    $first = Invoke-HttpJson 'booking-first' 'Post' "http://$dbHost`:$appPort/api/booking" $headers $payload
    if ($first.status -ne 201) { throw "Initial recovery booking failed with status $($first.status)." }
    $firstBody = $first.body | ConvertFrom-Json
    $bookingId = "$($firstBody.data.bookingId)"
    $replayBefore = Invoke-HttpJson 'booking-replay-before-outage' 'Post' "http://$dbHost`:$appPort/api/booking" $headers $payload
    if ($replayBefore.status -ne 200 -or "$(($replayBefore.body | ConvertFrom-Json).data.bookingId)" -ne $bookingId) {
        throw 'Pre-outage replay did not return the original booking.'
    }

    $stateSql = @"
SELECT json_build_object(
  'bookingCount', (SELECT count(*) FROM campus_duo.booking WHERE booking_id = '$bookingId'::uuid AND status = 'CONFIRMED'),
  'participantCount', (SELECT count(*) FROM campus_duo.booking_participant WHERE booking_id = '$bookingId'::uuid AND removed_at IS NULL),
  'idempotencyCount', (SELECT count(*) FROM campus_duo.idempotency_record WHERE actor_user_id = '$actorId'::uuid AND client_operation_id = '$operationId'),
  'auditCount', (SELECT count(*) FROM campus_duo.audit_event WHERE operation_id = '$operationId' OR target_id = '$bookingId'::uuid),
  'auditSuccessCount', (SELECT count(*) FROM campus_duo.audit_event WHERE operation_id = '$operationId' AND outcome = 'SUCCESS'),
  'outboxCount', (SELECT count(*) FROM campus_duo.outbox_event WHERE aggregate_id = '$bookingId'::uuid OR correlation_id = '$operationId')
);
"@
    $beforeState = Invoke-Psql $stateSql | ConvertFrom-Json
    Write-JsonFile (Join-Path $evidenceDir 'state-before-outage.json') $beforeState

    $stopRequested = [DateTimeOffset]::UtcNow
    & $pgCtl stop -D $dataDir -m immediate -w
    if ($LASTEXITCODE -ne 0) { throw 'Approved isolated PostgreSQL stop failed.' }
    $stoppedAt = [DateTimeOffset]::UtcNow
    $outage = Invoke-HttpJson 'health-during-outage' 'Get' $healthUri @{} ''
    if ($outage.status -eq 200) { throw 'Health remained successful while the isolated database was stopped.' }

    $restartRequested = [DateTimeOffset]::UtcNow
    & $pgCtl start -D $dataDir -o "-p $dbPort -h $dbHost" -l $clusterLog -w
    if ($LASTEXITCODE -ne 0) { throw 'Approved isolated PostgreSQL restart failed.' }
    $restartCommandCompleted = [DateTimeOffset]::UtcNow
    $healthAfter = $null
    $healthAfterDeadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $healthAfterDeadline) {
        try {
            $healthAfter = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 2
            if ($healthAfter.StatusCode -eq 200) { break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if ($null -eq $healthAfter -or $healthAfter.StatusCode -ne 200) { throw 'Application did not reconnect after isolated database restart.' }
    $healthAfter.Content | Set-Content -LiteralPath (Join-Path $evidenceDir 'health-after-restart.json') -Encoding UTF8

    $replayAfter = Invoke-HttpJson 'booking-replay-after-restart' 'Post' "http://$dbHost`:$appPort/api/booking" $headers $payload
    if ($replayAfter.status -ne 200 -or "$(($replayAfter.body | ConvertFrom-Json).data.bookingId)" -ne $bookingId) {
        throw 'Post-restart replay did not return the durable original booking.'
    }
    $afterState = Invoke-Psql $stateSql | ConvertFrom-Json
    Write-JsonFile (Join-Path $evidenceDir 'state-after-restart.json') $afterState
    if ($afterState.bookingCount -ne 1 -or $afterState.participantCount -ne 2 -or
        $afterState.idempotencyCount -ne 1 -or $afterState.auditSuccessCount -lt 1 -or
        $afterState.outboxCount -lt 1) {
        throw 'Post-restart durable-state or audit/outbox assertions failed.'
    }

    $timing = [ordered]@{
        stopRequestedUtc = $stopRequested.ToString('o')
        stoppedUtc = $stoppedAt.ToString('o')
        restartRequestedUtc = $restartRequested.ToString('o')
        restartCommandCompletedUtc = $restartCommandCompleted.ToString('o')
        outageObservedMilliseconds = ($stoppedAt - $stopRequested).TotalMilliseconds
        restartCommandMilliseconds = ($restartCommandCompleted - $restartRequested).TotalMilliseconds
        postRestartHealthObservedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    }
    Write-JsonFile (Join-Path $evidenceDir 'recovery-timing.json') $timing
    $exitCode = 0
}
catch {
    $failure = $_.Exception.Message
    Write-Error $failure
}
finally {
    try {
        if ($appProcess -and -not $appProcess.HasExited) {
            Stop-Process -Id $appProcess.Id
            $appProcess.WaitForExit()
        }
    } catch { Write-Warning "Application cleanup failed: $($_.Exception.Message)" }

    if ($bookingId) {
        try {
            & $pgCtl status -D $dataDir *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-Host 'Restarting the isolated cluster for exact fixture cleanup...'
                & $pgCtl start -D $dataDir -o "-p $dbPort -h $dbHost" -l $clusterLog -w
                if ($LASTEXITCODE -ne 0) { throw 'Could not restart the isolated cluster for fixture cleanup.' }
            }
            $cleanupSql = @"
BEGIN;
DELETE FROM campus_duo.outbox_event WHERE aggregate_id = '$bookingId'::uuid OR correlation_id = '$operationId';
DELETE FROM campus_duo.audit_event WHERE operation_id = '$operationId' OR target_id = '$bookingId'::uuid;
DELETE FROM campus_duo.idempotency_record WHERE actor_user_id = '$actorId'::uuid AND client_operation_id = '$operationId';
DELETE FROM campus_duo.booking_participant WHERE booking_id = '$bookingId'::uuid;
DELETE FROM campus_duo.booking WHERE booking_id = '$bookingId'::uuid;
COMMIT;
"@
            $cleanupResult = Invoke-Psql $cleanupSql
            Save-Text 'fixture-cleanup.txt' $cleanupResult
        } catch {
            $cleanupFailure = "Fixture cleanup failed: $($_.Exception.Message)"
            $failure = if ($failure) { "$failure; $cleanupFailure" } else { $cleanupFailure }
            Write-Error $cleanupFailure
        }
    }

    try {
        & $pgCtl status -D $dataDir | Set-Content -LiteralPath (Join-Path $evidenceDir 'pg-status-after.log') -Encoding UTF8
        if ($LASTEXITCODE -eq 0 -and $clusterStartedByRun -and -not $clusterWasRunning) {
            & $pgCtl stop -D $dataDir -m fast -w
        }
    } catch { Write-Warning "Final isolated cluster cleanup failed: $($_.Exception.Message)" }

    $sharedAfter = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq 5432 } |
        Select-Object LocalAddress, LocalPort, OwningProcess)
    $sharedAfter | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidenceDir 'shared-port-after.json') -Encoding UTF8
    $metadata = [ordered]@{
        runId = $runId
        association = 'KAN-86'
        exitCode = $exitCode
        failure = $failure
        dataDirectory = $dataDir
        dataDirectoryOwner = (Get-Acl -LiteralPath $dataDir).Owner
        target = "$dbHost`:$dbPort/$database"
        sharedPort = '127.0.0.1:5432'
        actorId = $actorId
        companionId = $companionId
        operationId = $operationId
        bookingId = $bookingId
        fixture = $fixture
        evidenceDirectory = $evidenceDir
        appPort = $appPort
        appEntry = $serverEntry
        clusterWasRunning = $clusterWasRunning
        clusterStartedByRun = $clusterStartedByRun
        baselineEvidence = 'recovery-20261106-20261106-104151-204'
        scope = 'Approved isolated recovery only; shared port 5432 was not interrupted.'
    }
    Write-JsonFile $metadataPath $metadata
    foreach ($name in $environmentNames) {
        $value = $previousEnvironment[$name]
        if ($null -eq $value) { Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue }
        else { Set-Item -Path "Env:$name" -Value $value }
    }
    Set-Location -LiteralPath $originalLocation
    Write-Host "Recovery evidence: $evidenceDir"
    Write-Host "Exit code: $exitCode"
    if ($failure) { Write-Host "Failure: $failure" }
}

if ($exitCode -ne 0) { exit 1 }
