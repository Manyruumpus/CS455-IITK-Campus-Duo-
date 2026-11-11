param(
  [string]$BaseUrl = $(if ($env:CAMPUS_DUO_BASE_URL) { $env:CAMPUS_DUO_BASE_URL } else { 'http://localhost:4000' }),
  [Parameter(Mandatory = $true)][string]$SlotId,
  [Parameter(Mandatory = $true)][string]$TableId,
  [Parameter(Mandatory = $true)][string]$LocationId,
  [Parameter(Mandatory = $true)][string]$StudentAToken,
  [Parameter(Mandatory = $true)][string]$StudentBToken,
  [Parameter(Mandatory = $true)][string]$StudentACompanionId,
  [Parameter(Mandatory = $true)][string]$StudentBCompanionId
)

$uri = "$BaseUrl/api/booking"

$bodyA = @{
  clientOperationId  = [guid]::NewGuid().ToString()
  tableId            = $TableId
  locationId         = $LocationId
  localDate          = $(if ($env:CAMPUS_DUO_DEMO_DATE) { $env:CAMPUS_DUO_DEMO_DATE } else { (Get-Date).AddDays(1).ToString('yyyy-MM-dd') })
  slotId             = $SlotId
  companionStudentId = $StudentACompanionId
} | ConvertTo-Json -Compress

$bodyB = @{
  clientOperationId  = [guid]::NewGuid().ToString()
  tableId            = $TableId
  locationId         = $LocationId
  localDate          = $(if ($env:CAMPUS_DUO_DEMO_DATE) { $env:CAMPUS_DUO_DEMO_DATE } else { (Get-Date).AddDays(1).ToString('yyyy-MM-dd') })
  slotId             = $SlotId
  companionStudentId = $StudentBCompanionId
} | ConvertTo-Json -Compress

$request = {
  param($RequestUri, $Token, $Body)
  $response = Invoke-WebRequest `
    -Uri $RequestUri `
    -Method Post `
    -Headers @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' } `
    -Body $Body `
    -SkipHttpErrorCheck
  [pscustomobject]@{
    Status = [int]$response.StatusCode
    Body   = $response.Content
  }
}

$jobA = Start-Job -ScriptBlock $request -ArgumentList $uri, $StudentAToken, $bodyA
$jobB = Start-Job -ScriptBlock $request -ArgumentList $uri, $StudentBToken, $bodyB
Wait-Job $jobA, $jobB | Out-Null
$resultA = Receive-Job $jobA
$resultB = Receive-Job $jobB
Remove-Job $jobA, $jobB

Write-Output "STUDENT_A_STATUS=$($resultA.Status)"
Write-Output "STUDENT_A_RESPONSE=$($resultA.Body)"
Write-Output "STUDENT_B_STATUS=$($resultB.Status)"
Write-Output "STUDENT_B_RESPONSE=$($resultB.Body)"
Write-Output 'Expected outcome: one 201 response and one 409 conflict response.'
