# Monty — Implementation Plan & Progress Tracking

> **Strategy**: Contract-First Development.
> The frontend already defines the exact API contract in `src/api/client.ts`.
> We build the backend to match that contract **exactly**, verified live with PostgreSQL and FastAPI.

---

## 🚦 Project Status Dashboard

| Phase | Description | Status | Evidence / Milestone |
|:---:|:---|:---:|:---|
| **Phase 0** | Repo Setup & Foundation Architecture | ✅ **COMPLETED** | FastAPI, `.env`, Pydantic Settings, JWT, Base Models |
| **Phase 1** | Contract-First API Stubs & Schemas | ✅ **COMPLETED** | All 22 endpoints defined and matched 1:1 with `client.ts` |
| **Phase 2** | Database Foundation & Alembic Migrations | ✅ **COMPLETED** | Neon PostgreSQL connected, 8 models created, migrations applied |
| **Phase 3** | Data Seeder & Repository Layer | ✅ **COMPLETED** | 30-day time-series seeded, 5 domain repositories verified |
| **Phase 4** | Service Layer & Endpoint Wiring | ✅ **COMPLETED** | Thin controllers, rich services, live data flowing to frontend |
| **Phase 5** | Core AI Engine: Gemini LLM & Agentic Memory | ⏳ **NEXT UP** | Multi-turn companion, episodic memory recall, flowchart logs |
| **Phase 6** | Core ML Engine: Impulse Pipeline & LSTM | ⏳ **PENDING** | Sequential time-series impulse modeling, Chrome extension API |
| **Phase 7** | Testing, Polish & Production Deployment | ⏳ **PENDING** | Pytest test suite, Docker containerization, Cloud hosting |

---

## Detailed Log of Completed Work

### ✅ PHASE 0 — Repo Setup & Core Foundation
- Initialized clean directory structure (`backend/app/**`, `frontend/`, `tests/`).
- Configured `.gitignore` to protect sensitive `.env` files and `node_modules/`.
- Pinned and installed Python dependencies in virtual environment.
- Implemented `app/core/config.py` using Pydantic Settings for type-safe environment loading.
- Implemented `app/core/database.py` with `pool_pre_ping=True` and `get_db` generator.
- Implemented `app/core/security.py` with bcrypt password hashing and JWT encoding/decoding.
- Scaffolded `BaseModel` with UUID primary keys and timezone-aware timestamps.

### ✅ PHASE 1 — Contract-First Pydantic Schemas & API Stubs
- Analyzed every TypeScript interface and fetch call in `frontend/src/api/client.ts`.
- Built Pydantic Schemas matching all request/response bodies:
  - `app/schemas/family.py` (`ApiFamily`, `ApiChild`, `ApiFamilyOverview`)
  - `app/schemas/goals.py` (`ApiSavingsGoal`, `GoalCreateRequest`, `AddMoneyRequest`)
  - `app/schemas/analytics.py` (`ApiSpending`, `CategoryStats`, `ApiStreak`, `ApiImpulseScore`)
  - `app/schemas/coaching.py` (`ApiMemory`, `ApiDecisionLog`, `ApiChatResponse`, `ApiLiveFeed`)
  - `app/schemas/extension.py` (`ApiRiskScore`, `ApiCheckRiskResponse`, `DismissAlertResponse`)
- Stubbed all 22 routes in `app/api/v1/endpoints/` and verified with FastAPI `TestClient`.

### ✅ PHASE 2 — Database Foundation (Neon Cloud PostgreSQL)
- Provisioned and connected to serverless PostgreSQL on **Neon** (`ep-dry-wildflower-b42cakqh`).
- Built 8 production-grade SQLAlchemy ORM models:
  - `Family`, `User`, `Child` (Household hierarchy with cascade deletion)
  - `SavingsGoal` (Exact currency precision with `Numeric(10,2)`)
  - `Transaction` (Temporal sequence modeling with composite index on `child_id, timestamp`)
  - `ImpulseScore` (Dynamic feature storage with PostgreSQL `JSONB`)
  - `Memory` (AI long-term episodic context with confidence ratings)
  - `DecisionLog` (Visual flowchart graph storage with ReactFlow nodes & edges)
- Initialized Alembic migrations, dynamically configured `env.py`, and applied migration `7d5839715881`.
- Verified live tables and foreign key constraints directly on Neon.

### ✅ PHASE 3 — Synthetic Time-Series Seeder & Repositories
- Built `backend/scripts/seed_db.py` to seed authentic behavioral personas:
  - Emma (Age 10, learning to save for Skateboard, active weekly allowances)
  - Lucas (Age 7, Lego enthusiast)
  - Marcus (Age 14, impulsive late-night weekend gaming bursts)
- Generated 30 days of timestamped purchases across 4 merchant categories.
- Built domain repositories extending `BaseRepository[T]`:
  - `FamilyRepository` (with `joinedload` query preloading)
  - `GoalRepository` (atomic balance mutations)
  - `TransactionRepository` (chronological time-series queries and SQL `GROUP BY` aggregations)
  - `MemoryRepository` (episodic context retrieval and storage)
  - `ImpulseRepository` (historical impulse scores and flowchart audit logs)
- Verified all repository methods with automated test scripts.

### ✅ PHASE 4 — Service Layer & Live Endpoint Wiring
- Implemented **3-Tier Architecture** ("Thin Controllers, Rich Services"):
  - `GoalService`: Computes progress percentages, calculates weeks remaining, handles completion milestones.
  - `FamilyService`: Orchestrates multiple data sources into the unified parent dashboard overview.
  - `SpendingService`: Transforms raw database transactions into category aggregates and evening/weekend ratios.
- Replaced stubbed endpoints in `app/api/v1/endpoints/` with live dependency-injected services (`Depends(get_db)`).
- Tested and verified live queries and mutations via `scripts/test_api_live.py`:
  - `GET /api/families` returns live records from Neon.
  - `GET /api/family/family-001/overview` delivers preloaded kids with computed metrics.
  - `POST /api/child/kid-1/goals/goal-1/add-money` updates database balances atomically.
- Verified frontend connection at `http://localhost:5173`.

---

## 📋 Remaining Phases & Implementation Plan

### 🧠 PHASE 5 — Core AI Engine: Gemini LLM & Agentic Memory (Next Up)
**Goal**: Build the empathetic AI financial coach ("Monty") with long-term memory and visual reasoning.
- **5.1 Setup Gemini Client**: Configure Google Generative AI SDK (`gemini-1.5-flash`/`pro`) in `app/core/ai.py`.
- **5.2 Episodic Memory Retrieval**: Build context-retrieval pipeline that pulls child goals and past impulse triggers into the prompt.
- **5.3 Empathetic Prompt Engineering**: Multi-turn financial coaching persona using Cognitive Framing (Implementation Intentions).
- **5.4 Visual Decision Node Generator**: Transform LLM reasoning into interactive flowchart nodes and edges for `/flowchart/{child_id}/decision-log`.
- **5.5 Proactive Nudges**: Generate timely reminders (e.g. "Friday evening coming up - remember your Skateboard goal!").

---

### 📈 PHASE 6 — Core ML Engine: Impulse Control Pipeline / LSTM Modeling
**Goal**: Predict impulse risk spikes before transactions occur and power Chrome extension interventions.
- **6.1 Temporal Sequence Modeling / LSTM**:
  - Process chronological transaction streams (`(child_id, timestamp)`) from Neon.
  - Detect burst patterns, inter-purchase intervals, and evening risk multipliers.
- **6.2 5-Factor Composite Scorer**:
  - Price-to-Goal Ratio, Category Risk, Time of Day, Recent Purchase Velocity, Emotional Trigger Memory.
- **6.3 Chrome Extension API**:
  - Live risk assessment endpoint (`/api/extension/check-risk?child_id=...`).
  - Alert dismissal and pause timers (`/api/extension/dismiss-alert`).
- **6.4 Real-time Polling Live Feed**:
  - Polling endpoint (`/api/child/{child_id}/live-feed`) for instant notifications.

---

### 🧪 PHASE 7 — End-to-End Integration, Testing & Production Deployment
**Goal**: Achieve production readiness with automated testing and cloud deployment.
- **7.1 Automated Pytest Suite**:
  - Test SQLite in-memory overrides for unit tests.
  - Full API integration tests covering auth, goals, spending, and AI endpoints.
- **7.2 Dockerization**:
  - Create multi-stage `Dockerfile` and `docker-compose.yml` for reproducible builds.
- **7.3 Cloud Deployment**:
  - Deploy FastAPI backend to Render / Railway.
  - Deploy React frontend to Vercel.
  - Final end-to-end verification of production URLs.
