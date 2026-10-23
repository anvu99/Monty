# Monty — Step-by-Step Implementation Plan

> **Strategy**: Contract-First Development.
> The frontend already defines the exact API contract in `src/api/client.ts`.
> We build the backend to match that contract **exactly**, stub first, then replace with real logic.
> This guarantees zero frontend-backend misalignment.

---

## Legend

| Symbol | Meaning |
|:---:|:---|
| 🧱 | Both developers together (foundation / shared work) |
| 👤 A | Developer A does this |
| 👤 B | Developer B does this |
| ✅ | Milestone / verification checkpoint |

---

## PHASE 0 — Repo Setup (Day 1 AM, ~2 hours) 🧱

Do this **together** once. Everything after depends on it.

### 0.1 — Initialize monty-repo structure

```
monty-repo/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/v1/
│   │   │   ├── __init__.py
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   └── exceptions.py
│   │   ├── models/
│   │   │   └── base.py
│   │   ├── schemas/
│   │   ├── repositories/
│   │   │   └── base.py
│   │   └── services/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/              <- copy of existing frontend
├── DESIGN_PATTERNS.md
├── IMPLEMENTATION_PLAN.md
├── .gitignore
└── README.md
```

Tasks:
- [ ] Create all directories and `__init__.py` files above
- [ ] Copy existing `frontend/web/` into `monty-repo/frontend/`
- [ ] Create `.gitignore` (cover `venv/`, `.env`, `__pycache__/`, `*.db`, `node_modules/`)

### 0.2 — Create `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
alembic==1.13.0
pydantic==2.9.0
pydantic-settings==2.5.0
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
httpx==0.27.0
google-generativeai==0.7.0
pytest==8.3.0
pytest-asyncio==0.23.0
```

### 0.3 — Create `.env.example`

```bash
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=change-me-to-a-random-string-of-64-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200
GEMINI_API_KEY=your-gemini-api-key-here
ENVIRONMENT=development
```

### 0.4 — Bootstrap `app/core/config.py`

```python
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200
    GEMINI_API_KEY: str = ""
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### 0.5 — Bootstrap `app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router

app = FastAPI(title="Monty API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### 0.6 — First Commit & Push

```bash
git add .
git commit -m "chore: initialize project structure and base config"
git push origin main
```

> ✅ **Milestone**: Both developers run `uvicorn app.main:app --reload` and see Swagger at `http://localhost:8000/docs`

---

## PHASE 1 — Stub All API Endpoints (Day 1 PM, ~4 hours) 🧱

**Goal**: Make the frontend load completely against a running backend **before any database code is written**.

The frontend's `vite.config.ts` already proxies `/api → http://localhost:8000`, so this works out of the box.

### Full Endpoint Inventory (from client.ts)

| Endpoint | Method | Route | Group |
|:---|:---:|:---|:---|
| fetchFamilies | GET | `/api/families` | Discovery |
| selectFamilyByKidCount | GET | `/api/families/select-by-kid-count/{kid_count}` | Discovery |
| fetchFamilyOverview | GET | `/api/family/{family_id}/overview` | Parent Dashboard |
| fetchChildGoals | GET | `/api/child/{child_id}/goals` | Goals |
| createGoal | POST | `/api/child/{child_id}/goals` | Goals |
| updateGoal | POST | `/api/child/{child_id}/goals/{goal_id}` | Goals |
| addMoneyToGoal | POST | `/api/child/{child_id}/goals/{goal_id}/add-money` | Goals |
| fetchChildSpending | GET | `/api/child/{child_id}/spending` | Analytics |
| fetchChildInsights | GET | `/api/child/{child_id}/insights` | Analytics |
| fetchChildStreak | GET | `/api/child/{child_id}/streak` | Gamification |
| fetchChildImpulseScores | GET | `/api/child/{child_id}/impulse-scores` | Impulse Control |
| fetchChildMemories | GET | `/api/child/{child_id}/memories` | AI Memory |
| fetchDecisionLog | GET | `/api/flowchart/{child_id}/decision-log` | AI Decisions |
| sendChatMessage | POST | `/api/coaching/chat` | AI Coach |
| fetchProactiveNudge | GET | `/api/coaching/proactive-nudge/{child_id}` | AI Coach |
| fetchCheckRisk | GET | `/api/extension/check-risk?child_id=...` | Chrome Extension |
| dismissAlert | POST | `/api/extension/dismiss-alert?alert_id=...` | Chrome Extension |
| fetchIntentions | GET | `/api/child/{child_id}/implementation-intentions` | Intentions |
| createIntention | POST | `/api/child/{child_id}/implementation-intentions` | Intentions |
| fetchLiveFeed | GET | `/api/child/{child_id}/live-feed` | Live Feed |

### Stub Approach

Each endpoint returns hardcoded dict/list data matching the TypeScript shape:

```python
# app/api/v1/endpoints/children.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/child/{child_id}/goals")
def get_child_goals(child_id: str):
    return {"goals": [
        {"id": "stub-1", "child_id": child_id, "name": "Nintendo Switch",
         "target_amount": 300.0, "current_amount": 75.0,
         "weekly_contribution": 10.0, "nessie_account_id": "", "created_at": "2024-01-01"}
    ]}
```

Create stub router files:
- `app/api/v1/endpoints/families.py`
- `app/api/v1/endpoints/children.py`
- `app/api/v1/endpoints/coaching.py`
- `app/api/v1/endpoints/extension.py`

> ✅ **Milestone**: `npm run dev` in `frontend/` connects to FastAPI. All pages render without network errors. Check DevTools Network tab — every `/api/...` returns 200.

```bash
git add .
git commit -m "feat: stub all API endpoints to match frontend contract"
git push origin main
```

---

## PHASE 2 — Database Foundation (Day 2, ~3 hours) 👤 A

Developer A owns this. Developer B works on Phase 3 in parallel.

### 2.1 — Sign up for Neon (free PostgreSQL)

1. Go to [neon.tech](https://neon.tech) → Sign up with GitHub
2. Create project: `monty-prod`
3. Copy the `DATABASE_URL` connection string → paste into `.env`
4. **Never commit `.env`** — it's in `.gitignore`

### 2.2 — Setup `app/core/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 2.3 — Create Base Model (`app/models/base.py`)

```python
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
import uuid

class Base(DeclarativeBase):
    pass

class BaseModel(Base):
    __abstract__ = True
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
```

### 2.4 — Create ORM Models

- **`app/models/family.py`** — `Family`, `Child`
- **`app/models/goal.py`** — `SavingsGoal`
- **`app/models/purchase.py`** — `Purchase`, `ImpulseScore`
- **`app/models/streak.py`** — `Streak`
- **`app/models/memory.py`** — `Memory`, `Intention`, `DecisionLog`

### 2.5 — Setup Alembic

```bash
cd backend
alembic init alembic
# Edit alembic/env.py to import Base and settings.DATABASE_URL
alembic revision --autogenerate -m "initial tables"
alembic upgrade head
```

> ✅ **Milestone**: Tables exist in Neon dashboard → Tables section.

```bash
git checkout -b feat/db-models-alembic
git add .
git commit -m "feat: add SQLAlchemy models and initial Alembic migration"
# Open PR → Dev B reviews → Merge to main
```

---

## PHASE 3 — Pydantic Schemas (Day 2, ~2 hours) 👤 B

Developer B does this **in parallel with Phase 2**. No database dependency.

Translate every TypeScript interface from `client.ts` 1-to-1 into Pydantic:

### Schema Files to Create

**`app/schemas/family.py`**
```python
from pydantic import BaseModel

class ChildBase(BaseModel):
    id: str
    name: str
    age: int

class FamilyResponse(BaseModel):
    id: str
    children: list[ChildBase]

class FamiliesResponse(BaseModel):
    families: list[FamilyResponse]
```

- **`app/schemas/goal.py`** — mirror `ApiSavingsGoal`
- **`app/schemas/spending.py`** — mirror `ApiSpending`
- **`app/schemas/streak.py`** — mirror `ApiStreak`
- **`app/schemas/impulse.py`** — mirror `ApiImpulseScore`
- **`app/schemas/memory.py`** — mirror `ApiMemory`, `ApiIntention`
- **`app/schemas/coaching.py`** — mirror `ApiChatResponse`, `ApiProactiveNudge`
- **`app/schemas/risk.py`** — mirror `ApiCheckRiskResponse`, `ApiRiskScore`
- **`app/schemas/decision.py`** — mirror `ApiDecisionLog`

> **Rule**: Field names **must exactly match** the TypeScript interface field names (already snake_case).

> ✅ **Milestone**: Update stub routers to use `response_model=` with proper schema. FastAPI now validates all responses.

```bash
git checkout -b feat/pydantic-schemas
git add .
git commit -m "feat: add all Pydantic schemas matching frontend API contract"
# Open PR → Dev A reviews → Merge to main
```

---

## PHASE 4 — Repository Layer (Day 3, ~4 hours) 👤 A + 👤 B

Split repositories by domain. **No merge conflicts possible** because each dev owns different files.

### BaseRepository (`app/repositories/base.py`) — 👤 A first

```python
from typing import TypeVar, Generic, Type
from sqlalchemy.orm import Session
from app.models.base import BaseModel

T = TypeVar("T", bound=BaseModel)

class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get(self, id: str) -> T | None:
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_multi(self, skip: int = 0, limit: int = 100) -> list[T]:
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def create(self, obj: T) -> T:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, id: str) -> None:
        obj = self.get(id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
```

### Repository Split

| File | Developer | Key Methods |
|:---|:---:|:---|
| `repositories/family_repo.py` | 👤 A | `get_all()`, `get_by_kid_count(n)`, `get_family_overview(family_id)` |
| `repositories/streak_repo.py` | 👤 A | `get_streak(child_id)`, `increment()`, `reset()` |
| `repositories/memory_repo.py` | 👤 A | `get_memories(child_id)`, `get_intentions(child_id)`, `create_intention()` |
| `repositories/goal_repo.py` | 👤 B | `get_by_child(child_id)`, `create_goal()`, `add_money(goal_id, amount)` |
| `repositories/purchase_repo.py` | 👤 B | `get_by_child(child_id)`, `get_spending_summary(child_id)` |
| `repositories/impulse_repo.py` | 👤 B | `get_scores(child_id)`, `get_decision_log(child_id)` |

```bash
# Developer A
git checkout -b feat/repo-family-streak-memory

# Developer B
git checkout -b feat/repo-goal-purchase-impulse
```

> ✅ **Milestone**: Both PRs merged. Every repository method confirmed working with Neon DB.

---

## PHASE 5 — Service Layer (Day 4, ~5 hours) 👤 A + 👤 B

Implement business logic. Services call repositories, apply calculations, then return Pydantic schemas.

### Service Split

| File | Developer | Responsibility |
|:---|:---:|:---|
| `services/family_service.py` | 👤 A | Aggregate child data into `FamilyOverview` response |
| `services/streak_service.py` | 👤 A | Streak logic (daily increment, detect resets) |
| `services/coaching_service.py` | 👤 A | Gemini API calls for chat responses and nudges |
| `services/risk_service.py` | 👤 A | Risk score calculation and alert generation |
| `services/memory_service.py` | 👤 A | AI memory creation, intention suggestions |
| `services/goal_service.py` | 👤 B | Goal CRUD, progress %, milestone detection |
| `services/spending_service.py` | 👤 B | Category aggregation, weekly trend calculation |
| `services/impulse_service.py` | 👤 B | Impulse score calculation pipeline |

> ✅ **Milestone**: All stub hardcoded data replaced with real service calls.

---

## PHASE 6 — Wire Endpoints to Services (Day 5, ~2 hours) 👤 A + 👤 B

Replace stub logic in router files with real service calls using FastAPI `Depends`:

```python
# app/api/v1/endpoints/children.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.goal import GoalsResponse
from app.services.goal_service import GoalService

router = APIRouter()

@router.get("/child/{child_id}/goals", response_model=GoalsResponse)
def get_goals(child_id: str, db: Session = Depends(get_db)):
    return GoalService(db).get_child_goals(child_id)
```

> ✅ **Milestone**: Full end-to-end test. Open the frontend, navigate every page, verify real data from PostgreSQL renders correctly.

---

## PHASE 7 — Seed Data & Testing (Day 6, ~3 hours) 👤 B

### 7.1 — Create Seed Script

Port `generate_rich_purchase_data.py` into:
- `backend/scripts/seed_db.py`
- Creates: 2 sample families, 4 children, 200+ purchases, goals, streaks, memories

Run with: `python -m scripts.seed_db`

### 7.2 — Write Tests

```
tests/
├── conftest.py             # SQLite in-memory test DB, overrides get_db dependency
├── api/
│   ├── test_families.py
│   ├── test_goals.py
│   └── test_coaching.py
└── services/
    ├── test_goal_service.py
    └── test_spending_service.py
```

Run: `pytest tests/ -v`

> ✅ **Milestone**: All tests pass. Coverage above 60%.

---

## PHASE 8 — Dockerize & Deploy (Day 7, ~3 hours) 🧱

### 8.1 — `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 — Deploy Backend to Render (free)

1. [render.com](https://render.com) → New → Web Service
2. Connect GitHub `monty-repo` repo
3. **Root Directory**: `backend`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add env vars: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`
6. Deploy → Get URL: `https://monty-api.onrender.com`

### 8.3 — Deploy Frontend to Vercel (free)

1. [vercel.com](https://vercel.com) → New Project
2. Connect `monty-repo` → Root Directory: `frontend`
3. Add env var: `VITE_API_BASE=https://monty-api.onrender.com`
4. Update `vite.config.ts` to use `process.env.VITE_API_BASE` in production
5. Deploy → Get link: `https://monty.vercel.app`

> ✅ **FINAL MILESTONE**: Share `https://monty.vercel.app` with recruiters!

---

## Summary Timeline

| Day | AM | PM | Who |
|:---:|:---|:---|:---:|
| 1 | Phase 0: Repo setup + first commit | Phase 1: Stub all 20 endpoints | 🧱 Both |
| 2 | Phase 2: DB models + Alembic | Phase 3: Pydantic schemas | 👤 A + 👤 B |
| 3 | Phase 4: Repository layer | Phase 4: Repository layer (cont.) | 👤 A + 👤 B |
| 4 | Phase 5: Service layer | Phase 5: Service layer (cont.) | 👤 A + 👤 B |
| 5 | Phase 6: Wire endpoints to services | Phase 6: Full E2E integration test | 👤 A + 👤 B |
| 6 | Phase 7: Seed script | Phase 7: Tests | 👤 B |
| 7 | Phase 8: Dockerfile + Deploy | Phase 8: Verify live link | 🧱 Both |

---

## Git Workflow Rules

```
main ── chore: init ── feat: stub endpoints ── feat: db models ── feat: schemas ── ...
                                                     ^                    ^
                              feat/db-models (Dev A) ┘   feat/schemas (Dev B) ┘
```

1. **Never push directly to `main`** after Phase 0.
2. Branch naming: `feat/<area>`, `fix/<bug>`, `chore/<task>`
3. PR descriptions must include: what you built + a working `curl` example to test it.
4. Merge in order: infra → repos → services. **Never merge a service before its repo exists.**
