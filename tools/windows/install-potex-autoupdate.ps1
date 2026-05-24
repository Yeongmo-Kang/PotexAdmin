param(
  [string]$TaskName = "PotexAutoUpdate",
  [string]$Branch = "main",
  [string]$Remote = "origin",
  [int]$IntervalMinutes = 15
)

$ErrorActionPreference = "Stop"

function Log($msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$ts] $msg"
}

if ($IntervalMinutes -lt 1) {
  throw "IntervalMinutes must be >= 1"
}

$updateScript = Join-Path $PSScriptRoot "update-potex.ps1"
if (-not (Test-Path $updateScript)) {
  throw "Missing update script: $updateScript"
}

$quotedScript = '"' + $updateScript + '"'
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $quotedScript -Branch `"$Branch`" -Remote `"$Remote`""

schtasks /Create /F /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR $taskCommand | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "schtasks /Create failed"
}

Log "Installed scheduled task '$TaskName'"
Log "Runs every $IntervalMinutes minutes: $taskCommand"
