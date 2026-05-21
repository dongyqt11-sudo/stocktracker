$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

$escapedBackend = $backend.Replace("\", "\\")
$escapedFrontend = $frontend.Replace("\", "\\")
Get-CimInstance Win32_Process |
  Where-Object {
    ($_.CommandLine -like "*$backend*" -and ($_.CommandLine -like "*uvicorn*" -or $_.CommandLine -like "*uv run*")) -or
    ($_.CommandLine -like "*$frontend*" -and ($_.CommandLine -like "*vite*" -or $_.CommandLine -like "*node_modules*"))
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Start-Sleep -Seconds 1

Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$backend'; python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$frontend'; pnpm dev --host 127.0.0.1 --port 5173"
)

Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://127.0.0.1:5173"
