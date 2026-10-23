# Architecture & Design Patterns: Monty Backend Reimplementation

## 1. High-Level Architectural Pattern: Clean Layered Architecture

We follow the **Clean Layered Architecture** (Separation of Concerns). Each layer has a single responsibility and only depends inwards on lower layers:

```
┌────────────────────────────────────────────────────────┐
│               API Layer (Routers & Endpoints)          │  <- Handles HTTP, query params, status codes
└───────────────────────────┬────────────────────────────┘
                            │ (Calls)
┌───────────────────────────▼────────────────────────────┐
│                  Service Layer (Business Logic)        │  <- Validation, calculations, workflows, LLM
└───────────────────────────┬────────────────────────────┘
                            │ (Calls)
┌───────────────────────────▼────────────────────────────┐
│            Repository Layer (Data Access Layer - DAL)   │  <- Database queries, aggregations, CRUD
└───────────────────────────┬────────────────────────────┘
                            │ (Reads/Writes)
┌───────────────────────────▼────────────────────────────┐
│               Database Models (SQLAlchemy ORM)         │  <- PostgreSQL tables, schemas, relations
└────────────────────────────────────────────────────────┘
```

Cross-cutting across all layers:
- **Schemas (Pydantic)**: Strict Request / Response validation (DTOs).
- **Core**: Configuration (`BaseSettings`), DB connection pool, security/auth, custom exceptions.

---

## 2. Directory Structure

```text
monty-repo/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py          # /api/v1/auth
│   │   │   │   │   ├── users.py         # /api/v1/users
│   │   │   │   │   ├── purchases.py     # /api/v1/purchases
│   │   │   │   │   ├── analytics.py     # /api/v1/analytics
│   │   │   │   │   └── insights.py      # /api/v1/insights
│   │   │   │   └── router.py            # Combines all v1 endpoint routers
│   │   ├── core/
│   │   │   ├── config.py                # Environment configs (pydantic-settings)
│   │   │   ├── database.py              # SQLAlchemy engine, session maker, get_db
│   │   │   ├── security.py              # Password hashing (argon2/bcrypt), JWT encode/decode
│   │   │   └── exceptions.py            # Custom domain exception classes & handlers
│   │   ├── models/                      # SQLAlchemy ORM Models (DB tables)
│   │   │   ├── base.py                  # Base class with id, created_at, updated_at
│   │   │   ├── user.py
│   │   │   └── purchase.py
│   │   ├── schemas/                     # Pydantic schemas (Request / Response DTOs)
│   │   │   ├── user.py                  # UserCreate, UserResponse, Token
│   │   │   ├── purchase.py              # PurchaseCreate, PurchaseResponse, PurchaseFilter
│   │   │   └── analytics.py             # SpendingSummary, CategoryBreakdown
│   │   ├── repositories/                # Data Access Layer (Clean DB queries)
│   │   │   ├── base.py                  # Generic BaseRepository[T] (get, list, create, delete)
│   │   │   ├── user_repo.py             # User-specific queries (e.g. get_by_email)
│   │   │   └── purchase_repo.py         # Purchase filtering, date ranges, aggregations
│   │   ├── services/                    # Business Logic Layer
│   │   │   ├── auth_service.py          # Login, register, token issuance, password verify
│   │   │   ├── purchase_service.py      # Batch import, category normalization
│   │   │   └── analytics_service.py     # Aggregation logic, trend calculation, insight generation
│   │   └── main.py                      # FastAPI app initialization, CORS, middleware
│   ├── alembic/                         # Database migration scripts
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── conftest.py                  # Test DB fixtures, mock clients
│   │   ├── api/
│   │   └── services/
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                            # Inherited React/Next.js frontend
├── chrome-extension/                    # Browser extension
├── .gitignore
├── DESIGN_PATTERNS.md
└── README.md
```

---

## 3. Core Design Patterns We Implement

### 1. Repository Pattern (Data Access Layer)
- **Problem solved**: Directly calling `db.query(...)` inside endpoints tightly couples the HTTP routes with the database, making it impossible to mock for unit testing and causing repetitive SQL queries across files.
- **Implementation**:
  - `BaseRepository[ModelType]` provides standard CRUD (`get`, `get_multi`, `create`, `update`, `delete`).
  - Specialized repositories inherit from `BaseRepository` and add domain-specific queries (e.g., `purchase_repo.get_user_monthly_spend(user_id, year, month)`).

### 2. Dependency Injection (FastAPI `Depends`)
- **Problem solved**: Hard-coded global connections make unit testing difficult and lead to connection leaks.
- **Implementation**:
  - Inject database sessions via `get_db`.
  - Inject current authenticated user via `get_current_user`.
  - Inject repositories and services directly into route handlers.

### 3. Data Transfer Object (DTO) Pattern via Pydantic
- **Problem solved**: Never expose raw database entities directly to clients (prevents password hash leaks, internal IDs, or accidental modification of sensitive fields).
- **Implementation**:
  - `PurchaseCreate` (what client sends).
  - `PurchaseUpdate` (fields allowed to be patched).
  - `PurchaseResponse` (what the client receives with `from_attributes = True`).

### 4. Service Layer Pattern (Domain Orchestration)
- **Problem solved**: "Fat controllers" where endpoint functions have 150 lines of database calls, math, validation, and email logic.
- **Implementation**:
  - Routers stay under 15–20 lines per endpoint.
  - Endpoints only parse input -> pass to Service -> return Pydantic Response.
  - Services contain all pure business logic, calculations, and integrations (e.g., Gemini LLM API calls).

### 5. Singleton / Settings Pattern
- **Implementation**:
  - Using `@lru_cache()` with `pydantic_settings.BaseSettings` ensures configuration is validated at startup and loaded only once.

---

## 4. Separation of Work for 2 Backend Developers

To ensure both developers work smoothly without merge conflicts:

| Feature Area | Developer A | Developer B |
| :--- | :--- | :--- |
| **Authentication & Users** | User Model, Password Hashing, JWT Tokens, Auth Endpoints (`/login`, `/register`, `/me`), Auth Middleware | — |
| **Purchase & Transactions** | — | Purchase Model, Purchase Repo, CRUD Endpoints, Receipt Parser / Ingestion |
| **Analytics & Reporting** | — | Monthly aggregation queries, category breakdown service, `/analytics` endpoints |
| **AI / Insights Engine** | AI Insights Service (LLM Prompting, financial tips generation) | — |
| **Infra & Database** | Alembic Setup, Dockerfile & Render/Neon setup | Local Seed Scripts & Mock Data generators |

---

## 5. Development Standards & Conventions

1. **Async by Default**: Use `async def` and `AsyncSession` (or consistent sync SQLAlchemy with connection pooling).
2. **Explicit Type Hints**: All functions must have type hints for arguments and return types.
3. **No Raw Secrets in Code**: All database URLs and secrets must come from `.env` loaded into `core/config.py`.
4. **Git Workflow**:
   - `main`: Production-ready code.
   - Feature branches: `feat/auth-jwt`, `feat/purchase-repo`, `feat/analytics-service`.
   - Never commit directly to `main`; submit PRs with descriptive titles.
