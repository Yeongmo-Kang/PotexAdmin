param(
  [string]$Branch = "main",
  [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"

function Log($msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$ts] $msg"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Log "Repo: $repoRoot"

if (-not (Test-Path ".git")) {
  throw "This script must live inside the Potex git repository."
}

$git = Get-Command git -ErrorAction Stop
Log "Using git: $($git.Source)"

$status = git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status failed"
}

if ($status) {
  Log "Local changes detected; refusing to auto-update."
  Write-Host $status
  exit 2
}

Log "Fetching $Remote/$Branch"
git fetch $Remote $Branch --prune
if ($LASTEXITCODE -ne 0) {
  throw "git fetch failed"
}

$currentBranch = (git branch --show-current).Trim()
if (-not $currentBranch) {
  throw "Could not determine current branch"
}
if ($currentBranch -ne $Branch) {
  Log "Switching branch: $currentBranch -> $Branch"
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) {
    throw "git checkout failed"
  }
}

Log "Fast-forwarding to $Remote/$Branch"
git pull --ff-only $Remote $Branch
if ($LASTEXITCODE -ne 0) {
  throw "git pull --ff-only failed"
}

$head = (git rev-parse --short HEAD).Trim()
$subject = (git log --oneline -1).Trim()
Log "Done. HEAD=$head"
Write-Host $subject
