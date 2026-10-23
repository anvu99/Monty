# Monty — Local Setup Guide

This guide covers setting up the Monty Full-Stack application from scratch.

---

## ⚡ Option 1: Quick Automated Setup (Recommended)

From the `monty-repo` root directory in PowerShell:

```powershell
.\setup.ps1
```

This single command will:
1. Verify Python 3.11+ and Node.js.
2. Create `backend/venv` and install all Python dependencies.
3. Copy `backend/.env.example` to `backend/.env` (if not already present).
4. Run Alembic database migrations to create all 8 tables.
5. Seed the database with demo families, goals, and 30-day transaction logs.
6. Run `npm install` in `frontend/`.

---

## 🛠 Option 2: Manual Setup Step-by-Step

### 1. Backend Setup

```powershell
# 1. Navigate to backend
cd backend

# 2. Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your local .env
copy .env.example .env
```

Open `backend/.env` and verify your `DATABASE_URL`:
* **Cloud PostgreSQL (Neon)**:
  `DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require`
* **Local Offline SQLite**:
  `DATABASE_URL=sqlite:///./monty.db`

```powershell
# 5. Run database migrations to create tables
alembic upgrade head

# 6. Seed the database with authentic demo data
python scripts/seed_db.py
```

---

### 2. Frontend Setup

```powershell
# 1. Navigate to frontend
cd ../frontend

# 2. Install packages
npm install
```

---

## 🚀 Running the Application Locally

Open **two terminal windows**:

### Terminal 1: Backend Server (FastAPI)
```powershell
cd monty-repo/backend
.\venv\Scripts\activate
uvicorn app.main:app --reload
```
* **API Server**: [http://localhost:8000](http://localhost:8000)
* **Swagger Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### Terminal 2: Frontend App (React + Vite)
```powershell
cd monty-repo/frontend
npm run dev
```
* **Web Application**: [http://localhost:5173](http://localhost:5173)

---

## 🔍 Verification Commands

To verify that your database and live endpoints are healthy:

```powershell
cd monty-repo/backend
.\venv\Scripts\activate

# Test database tables and connections
python scripts/verify_db.py

# Test all API endpoints against the live database
python scripts/test_api_live.py
```
