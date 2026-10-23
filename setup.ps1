# =====================================================================
# Monty — Full Stack Automated Setup Script (Windows PowerShell)
# =====================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       🚀 Setting Up Monty Full-Stack Application         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RepoRoot = $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

# ---------------------------------------------------------------------
# Step 1: Check Prerequisites
# ---------------------------------------------------------------------
Write-Host "`n[1/5] Checking Prerequisites..." -ForegroundColor Yellow

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "❌ Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Found Python: $(python --version)" -ForegroundColor Green

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "❌ Error: Node.js / npm is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Found npm: $(npm -v)" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 2: Setup Backend Virtual Environment & Dependencies
# ---------------------------------------------------------------------
Write-Host "`n[2/5] Setting up Backend Virtual Environment..." -ForegroundColor Yellow

$VenvDir = Join-Path $BackendDir "venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "  Creating Python virtual environment in backend/venv..."
    & python -m venv $VenvDir
} else {
    Write-Host "  ✓ Existing virtual environment found." -ForegroundColor Green
}

$PipExe = Join-Path $VenvDir "Scripts\pip.exe"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"

Write-Host "  Installing backend dependencies from requirements.txt..."
& $PipExe install -r (Join-Path $BackendDir "requirements.txt") --quiet
Write-Host "  ✓ Backend packages installed successfully." -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 3: Configure Environment Variables (.env)
# ---------------------------------------------------------------------
Write-Host "`n[3/5] Checking Environment Configuration..." -ForegroundColor Yellow

$EnvFile = Join-Path $BackendDir ".env"
$EnvExample = Join-Path $BackendDir ".env.example"

if (-not (Test-Path $EnvFile)) {
    Write-Host "  Copying .env.example to .env..."
    Copy-Item $EnvExample $EnvFile
    Write-Host "  ⚠️  NOTICE: Created backend/.env with default settings." -ForegroundColor Yellow
    Write-Host "  Please ensure your DATABASE_URL in backend/.env points to your Neon PostgreSQL or SQLite." -ForegroundColor Yellow
} else {
    Write-Host "  ✓ backend/.env file exists." -ForegroundColor Green
}

# ---------------------------------------------------------------------
# Step 4: Run Migrations & Seed Database
# ---------------------------------------------------------------------
Write-Host "`n[4/5] Running Migrations & Seeding Database..." -ForegroundColor Yellow

$AlembicExe = Join-Path $VenvDir "Scripts\alembic.exe"

Push-Location $BackendDir
try {
    Write-Host "  Applying Alembic database migrations..."
    & $AlembicExe upgrade head
    Write-Host "  ✓ Database migrations applied." -ForegroundColor Green

    Write-Host "  Seeding database with authentic demo data..."
    & $PythonExe "scripts/seed_db.py"
    Write-Host "  ✓ Database successfully seeded." -ForegroundColor Green
} catch {
    Write-Host "  ❌ Database migration/seed encountered an issue: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------
# Step 5: Install Frontend Dependencies
# ---------------------------------------------------------------------
Write-Host "`n[5/5] Installing Frontend Dependencies..." -ForegroundColor Yellow

Push-Location $FrontendDir
try {
    Write-Host "  Running npm install in frontend/..."
    & npm install --silent
    Write-Host "  ✓ Frontend dependencies installed successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------
# Completion Instructions
# ---------------------------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "       🎉 Setup Completed Successfully!                   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "`nTo start the application, open two terminal tabs:`n"

Write-Host "Terminal 1 (Backend API):" -ForegroundColor Cyan
Write-Host "  cd backend"
Write-Host "  .\venv\Scripts\activate"
Write-Host "  uvicorn app.main:app --reload`n"

Write-Host "Terminal 2 (Frontend UI):" -ForegroundColor Cyan
Write-Host "  cd frontend"
Write-Host "  npm run dev`n"

Write-Host "API Docs:     http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "Frontend App: http://localhost:5173" -ForegroundColor Yellow
Write-Host "==========================================================`n"
