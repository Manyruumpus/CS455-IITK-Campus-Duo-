$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$node = Get-Command node -ErrorAction Stop
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "Campus Duo argument regression $([guid]::NewGuid().Guid)"
$nodeScript = Join-Path $testRoot 'echo-arguments.js'
$stdoutPath = Join-Path $testRoot 'stdout.json'
$stderrPath = Join-Path $testRoot 'stderr.log'
$evidenceDir = Join-Path $repoRoot 'required docs\deliverable-3\evidence\performance\process-argument-regression'
$evidencePath = Join-Path $evidenceDir "start-process-spaces-$((Get-Date).ToString('yyyyMMdd-HHmmss-fff')).json"
$process = $null

try {
    New-Item -ItemType Directory -Force -Path $testRoot, $evidenceDir | Out-Null
    @'
process.stdout.write(JSON.stringify(process.argv.slice(2)));
'@ | Set-Content -LiteralPath $nodeScript -Encoding UTF8

    $expected = @('--alpha', 'value with spaces', '--beta', 'second value')
    $arguments = @(
        "`"$nodeScript`"",
        '--alpha',
        '"value with spaces"',
        '--beta',
        '"second value"'
    )
    $process = Start-Process -FilePath $node.Source `
        -ArgumentList $arguments `
        -WorkingDirectory $testRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -NoNewWindow `
        -PassThru `
        -Wait

    $actual = @(Get-Content -LiteralPath $stdoutPath -Raw | ConvertFrom-Json)
    if ($process.ExitCode -ne 0) {
        throw "Node regression process exited with code $($process.ExitCode): $(Get-Content -LiteralPath $stderrPath -Raw)"
    }
    if (($actual -join "`n") -ne ($expected -join "`n")) {
        throw "Argument boundary regression failed. Expected '$($expected -join '|')'; received '$($actual -join '|')'."
    }

    [ordered]@{
        timestamp = (Get-Date).ToString('o')
        node = $node.Source
        nodeScript = $nodeScript
        expectedArguments = $expected
        actualArguments = $actual
        result = 'PASS'
        regression = 'Start-Process preserves a Node script path and arguments containing spaces when explicitly quoted.'
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $evidencePath -Encoding UTF8

    Write-Output "PASS: Node path and arguments containing spaces were preserved."
    Write-Output "Evidence: $evidencePath"
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
