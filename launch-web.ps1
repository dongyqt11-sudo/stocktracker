$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$devScript = Join-Path $root "dev.ps1"
$frontendUrl = "http://127.0.0.1:5173"
$backendHealthUrl = "http://127.0.0.1:8000/api/health"

& $devScript

$deadline = (Get-Date).AddSeconds(30)
$frontendReady = $false
$backendReady = $false

while ((Get-Date) -lt $deadline -and (-not ($frontendReady -and $backendReady))) {
  if (-not $frontendReady) {
    try {
      $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 3
      $frontendReady = $response.StatusCode -eq 200
    } catch {
      $frontendReady = $false
    }
  }

  if (-not $backendReady) {
    try {
      $response = Invoke-WebRequest -Uri $backendHealthUrl -UseBasicParsing -TimeoutSec 3
      $backendReady = $response.StatusCode -eq 200
    } catch {
      $backendReady = $false
    }
  }

  if (-not ($frontendReady -and $backendReady)) {
    Start-Sleep -Seconds 1
  }
}

Start-Process $frontendUrl
