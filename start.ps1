# start.ps1 - Start the Familia Budget stack.
#
# Starts the backend + Ollama containers in the background (detached), then
# runs the React (Vite) dev server in the FOREGROUND. Because the dev server
# is the last thing running, pressing Ctrl+C stops the whole app.
#
# Usage:   ./start.ps1
#          ./start.ps1 -SkipInstall   (skip 'npm install')

param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

Write-Host "==> Familia Budget: starting up" -ForegroundColor Cyan

# --- Sanity checks --------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: 'docker' was not found on PATH. Is Docker Desktop installed and running?" -ForegroundColor Red
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: 'npm' was not found on PATH. Install Node.js 20+." -ForegroundColor Red
    exit 1
}

# --- Start the backing containers (detached) ------------------------------
# We only start backend + ollama here and run the frontend locally so that
# Ctrl+C on the Vite dev server tears the app down cleanly.
Write-Host "==> Starting Docker containers (backend, ollama)..." -ForegroundColor Cyan
docker compose --project-directory "$ProjectRoot" up -d --build backend ollama
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose failed to start the containers." -ForegroundColor Red
    exit 1
}

Write-Host "==> Containers running:" -ForegroundColor Green
Write-Host "      Backend API  -> http://localhost:8000"
Write-Host "      Ollama       -> http://localhost:11434"

# --- Frontend dependencies ------------------------------------------------
$FrontendDir = Join-Path $ProjectRoot 'frontend'
if (-not $SkipInstall) {
    if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
        Write-Host "==> Installing frontend dependencies (npm install)..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        npm install
        Pop-Location
    }
}

# --- Run the React dev server in the foreground ---------------------------
# This is the LAST thing that runs. Ctrl+C here stops Vite and returns control.
Write-Host "==> Starting React dev server -> http://localhost:5173" -ForegroundColor Green
Write-Host "    (Press Ctrl+C to stop the app.)" -ForegroundColor Yellow

Push-Location $FrontendDir
try {
    npm run dev
}
finally {
    Pop-Location
    Write-Host ""
    Write-Host "==> React dev server stopped. Stopping Docker containers..." -ForegroundColor Cyan
    docker compose --project-directory "$ProjectRoot" stop backend ollama | Out-Null
    Write-Host "==> Done. (Data volumes preserved.)" -ForegroundColor Green
}
