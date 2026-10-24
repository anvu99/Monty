# Monty: two-person implementation plan

## Goal and starting point

Deliver a working, authenticated flow from purchase input to impulse assessment, personalized coaching, and a recorded outcome, with parent and child dashboards reflecting persisted data.

The repository already has database models, a migration, a seeder, repositories, and database-backed family, goal, spending, and historical score endpoints. Verify and extend these rather than rebuilding them. Coaching, risk checks, streaks, and several dashboard metrics still use demo behavior. There is no implemented browser extension or bank integration.

## Work allocation

| Person | Track | Primary responsibility |
| --- | --- | --- |
| A | Platform, data, and access | Persistence, purchase ingestion, authentication, authorization, migrations, and backend deployment |
| B | Intelligence and product integration | Impulse detection, personal support agent, coaching orchestration, and frontend integration |

Person A owns the reliable, protected data foundation. Person B owns the behavior users experience. Both write tests for their own work. Person B can develop against fixtures and in-memory adapters while Person A implements production persistence.

## Person A: platform, data, and access

### A1. Verify and complete the database foundation

- Run migrations against a disposable PostgreSQL database and verify all model relationships.
- Make demo seeding repeatable without duplicating records; keep synthetic demo data separate from real households.
- Add persistence for conversations, implementation intentions, alerts, intervention outcomes, and other state agreed in the shared contracts.
- Implement data adapters for B's context retrieval and result persistence interfaces. Keep ORM objects inside the data layer.
- Make stored timestamps, money values, and transaction boundaries consistent.

### A2. Implement authentication and authorization

- Add registration/login/session endpoints and authenticated-user dependencies using the existing security utilities.
- Implement parent/child permissions and household ownership checks on every endpoint, including B's coaching and risk routes through shared route dependencies.
- Replace public demo-family discovery in normal account flows with household-scoped discovery. Keep any demo mode explicit and isolated.
- Fix goal mutation ownership checks, validation, and missing-record behavior; return appropriate errors instead of fabricated success responses or fallback records.
- Supply B with the frontend auth contract and shared backend access dependency early.

### A3. Implement purchase ingestion and persisted analytics

- Provide authenticated manual purchase submission first, with validation, ownership checks, timestamps, and idempotency to prevent duplicate records.
- Store completed purchases separately from proposed purchases being assessed; a risk check must not automatically count as spending.
- Wire ingestion to B's assessment service after it becomes available.
- Replace hardcoded streak and habit metrics with documented calculations from stored events. Define what counts as a streak day and a successful intervention.
- Select a real transaction source together before implementing a bank-provider connector or browser extension. These require separate integration work; manual entry supports the first complete release.

### A4. Own backend operational readiness

- Add database and API integration tests covering migrations, repeatable seeds, permissions, money mutations, and ingestion retries.
- Provide a disposable test database and shared test fixtures; avoid tests that mutate a developer or cloud demo database.
- Add backend container/startup configuration, environment documentation, health/readiness checks, structured logging, and migration deployment instructions.
- Document backups and restore verification. Configure secrets outside source control and avoid logging child conversations or credentials.

**Done when:** a fresh database can be migrated and optionally seeded, two households cannot access each other's records, validated purchases and AI artifacts survive restart, and the backend has passing integration tests and a reproducible deployment path.

## Person B: intelligence and product integration

### B1. Define and implement impulse assessment

- Define structured purchase inputs and a documented risk policy using goal impact, amount, category, timing, purchase velocity, and relevant historical context.
- Start with an explainable scoring baseline and use AI for contextual interpretation and coaching. A trained sequence model is a later task requiring suitable data and evidence that it improves results.
- Standardize score scales at the boundary: use 0–100 for risk scores and 0–1 for confidence/factor contributions. Audit existing frontend charts and transforms, some of which assume 0–1 scores.
- Produce structured assessment results, explanatory factors, an intervention action, and user-facing explanations. Explanations should describe evidence and uncertainty.
- Implement model response validation, timeouts, bounded retries, and a useful fallback when the provider is unavailable.

### B2. Build the personal support agent

- Add the AI provider client, configurable model selection, prompts, and structured output validation.
- Retrieve household-authorized child context through the shared data interface: goals, recent purchases, conversations, intentions, and relevant memories.
- Support ongoing conversations and deliberate memory updates; report `memory_updated` only after a successful write.
- Build age-appropriate coaching and boundaries, with tests for manipulative purchase content, unsupported financial claims, and sensitive information.
- Generate relevant nudges and suggested intentions from actual context. Persist decisions and outcomes through A's adapters.

### B3. Integrate intelligence endpoints

- Replace demo behavior in coaching and extension endpoints with the new services.
- Implement persistent alert dismissal, decision history, intention creation, and live-feed responses through the data interface.
- Distinguish current risk summaries from assessment of a specific proposed purchase; preserve existing client contracts where possible and add a purchase-assessment endpoint where necessary.
- Make polling honor its cursor or `since` value so old events are not repeatedly shown as new.
- Record observed outcomes separately from predictions; avoid presenting generated suggestions as measured behavior.

### B4. Complete the frontend and its release configuration

- Connect real sign-in, household onboarding, and role-aware navigation to A's contracts.
- Replace remaining demo data and local-only settings with API-backed state where persistence is expected.
- Connect purchase entry/assessment, chat, memories, intentions, alerts, decision outcomes, and dashboard refreshes.
- Add consistent loading, empty, error, and provider-unavailable states; remove misleading success states.
- Configure production API routing separately from the Vite development proxy and prepare the frontend deployment.
- Test critical frontend flows and maintain a small AI evaluation fixture set covering different children, purchase patterns, failures, and safety boundaries.

**Done when:** a purchase receives a contextual assessment, a child can have an ongoing personalized conversation, outcomes and memories persist, the UI displays real results consistently, and provider failure does not break basic product use.

## File ownership to reduce merge conflicts

| Area | Owner | Coordination rule |
| --- | --- | --- |
| `backend/app/models/`, `repositories/`, `alembic/`, `scripts/` | A | B requests fields and adapter methods through the shared contract. |
| `backend/app/core/security.py`, `database.py`, `config.py` | A | B supplies required AI settings; A adds them. |
| New auth dependencies, auth routes, purchase ingestion routes | A | Publish example requests/responses early. |
| Existing family, goal, and analytics endpoints and services | A | B consumes their contracts and flags changes needed for UI integration. |
| `backend/app/core/ai.py` and new AI/agent/scoring services | B | Keep database access behind interfaces. |
| `backend/app/api/v1/endpoints/coaching.py`, `extension.py` | B | A supplies access dependencies; B applies them. |
| `backend/app/schemas/coaching.py`, `extension.py`, new AI schemas | B | A maps persisted records to these schemas. |
| Other existing schemas and new auth/purchase schemas | A | Agree cross-track payloads before implementation. |
| New `backend/app/contracts/` interfaces and fixtures | B | Both agree initial contract; changes require notifying the other person. |
| `backend/app/main.py`, API router registration | A | B provides new router imports and setup requirements for A to apply. |
| All `frontend/` files | B | A provides backend API examples rather than editing frontend files. |
| Shared test configuration, data/API tests, backend infrastructure | A | B keeps AI tests in separate files under `backend/tests/ai/`. |
| Frontend tests and AI evaluation fixtures | B | Neither edits the other's test files without coordination. |
| `SETUP_GUIDE.md`, `setup.ps1`, backend environment examples | A | B supplies frontend and AI setup instructions for incorporation. |
| `IMPLEMENTATION_PLAN.md` | A | B reports milestones for A to update. |

## First joint checkpoint: freeze the integration contracts

Do this before either person depends on the other's implementation. Keep it short and commit examples plus Python interfaces under `backend/app/contracts/`.

1. **Identity and access:** authenticated user/household/child identifiers, permitted roles, token/session transport, and the backend dependency that resolves an authorized child. Demo shortcuts must not bypass production checks.
2. **Purchase input:** child ID, product/merchant/category, amount/currency, event time, proposed versus completed status, and an idempotency key. Agree endpoints and validation errors.
3. **Assessment result:** assessment/event ID, risk score (0–100), risk level, factors, chosen action, coaching message, creation time, and provider/fallback status. Agree the mapping to existing API response schemas.
4. **Agent context:** serializable snapshots of child profile, goals, recent transactions, intentions, conversation history, and selected memories. Explicitly define lookback windows and ordering.
5. **Data interface:** context retrieval; conversation append; memory update; assessment/decision save; intention create/list; alert dismiss; outcome save; cursor-based event retrieval. Specify return values, errors, transaction ownership, and sync/async behavior.
6. **Outcomes and retention:** shared status values for waited/proceeded/dismissed, alert lifecycle, conversation/memory retention, and parent visibility. Reconcile existing inconsistent status strings.

B supplies fixtures and an in-memory implementation of the data interface. A implements its SQLAlchemy adapter. Service tests use the same fixtures to verify both implementations against the agreed behavior.

## Parallel delivery sequence

| Checkpoint | Person A | Person B | Integration gate |
| --- | --- | --- | --- |
| 1. Contracts agreed | Publish identity/purchase API examples and data adapter plan | Publish AI/data interfaces, sample results, and fixtures | Both can start independently using stable examples. |
| 2. Independent core work | Database verification, migrations, auth, ingestion, adapters | Risk baseline, provider client, agent, endpoint logic using fixtures | Each track passes its own tests without the other track running. |
| 3. First complete flow | Supply real adapters and authenticated API | Swap fixture adapters for real adapters and connect UI | Purchase → assessment → coaching → stored outcome works for an authorized child. |
| 4. Hardening | Access isolation, data integrity, persisted metrics, backend release setup | UI completeness, AI evaluations, failure states, frontend release setup | Shared acceptance checklist passes. |

Do not wait until checkpoint 4 to merge. Use separate branches, small pull requests, and short regular integration checks. Keep incomplete features behind configuration where needed. Only A authors migrations; B sends schema needs early to avoid competing Alembic heads. If a contract changes, update its example fixture and notify the other person before merging.

## Shared release acceptance checklist

- A clean environment can start the application using documented steps.
- A parent can create/sign into a household and access only its permitted children; unauthorized requests fail on the backend.
- Seeded demo use and real account use remain separate.
- A completed purchase appears in spending exactly once, including after a retry.
- A proposed purchase can be assessed without changing spending totals.
- Assessment, chat, memory changes, intentions, alerts, and outcomes survive a restart.
- Coaching reflects the selected child's actual goals and history, without leaking another child's private context.
- Risk scores and statuses display consistently across the API and UI.
- Model timeout or malformed output yields a clear fallback and does not lose the purchase record.
- Database/API tests, frontend flow checks, and AI evaluation cases pass.
- Production frontend/API routing, migrations, secrets, health checks, and backup instructions are verified.

External transaction-provider integration, a packaged browser extension, and a trained LSTM remain separately scoped follow-up work unless explicitly included in the first release. Their backend integration points are covered above so they can be added later.
