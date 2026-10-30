# Completed demo purchase assessments

Each new demo purchase creates an immutable financial/memory/conversation snapshot and a pending database job in the same transaction. The worker saves a logistic regression baseline, then asks Gemini for a contextual classification. Only `potentially_impulsive` generates a persistent parent notification. ML scores remain separately labeled and never become training labels.

## Enable locally

1. Install `backend/requirements.txt` in your Python environment. The checked-in artifacts require scikit-learn **1.9.1**; older versions cannot reliably load them.
2. From `backend`, run `python -m alembic upgrade head` against your intended development database.
3. Set `DEMO_PURCHASES_ENABLED=true`, `PURCHASE_ASSESSMENT_WORKER_ENABLED=true`, and a valid `GEMINI_API_KEY`. Restart the API.
4. Check `/health`: `purchase_detector_ready` must be true. Invalid artifacts disable the purchase worker and are reported in startup logs. After correcting artifacts/dependencies, restart the API.
5. Use preset, custom, or random demo purchases. Parent Home displays the final explanation and baseline separately, with five-second foreground polling. No savings balances or real money are changed.

## Context and retries

The three most recent saved conversations before purchase creation are selected by saved timestamp and ID, regardless of extraction status. Core and keyword-ranked semantic memories include provenance; inferred patterns retain their uncertainty. Browser-only unfinished chats are not included. Future records are excluded from financial history. Inputs and the configured Gemini model ID are frozen for retries.

Full conversations are used when they fit. Otherwise, chronological chunks are summarized with validated exact child-message quotes. Completed summary chunks are cached. The API reports `conversation_context` with `full` or `summary` representation; no selected conversation is silently removed. `PURCHASE_SUMMARY_CONTEXT_TOKENS` defaults to 3500. A context that still exceeds the configured budget fails explicitly rather than dropping evidence.

Baseline, context, and Gemini failures are tracked separately. Transient provider failures retry up to three times with delays (quota responses wait at least 60 seconds); invalid output and configuration failures require explicit retry. `POST /api/demo/purchases/{id}/retry-assessment` requeues a failed job while preserving inputs and successful stages. GET status endpoints are read-only. Abandoned processing leases become eligible after five minutes.

The notification API is family-scoped: `GET /api/family/{id}/notifications?limit=50&offset=0` and `PATCH /api/family/{id}/notifications/{notification_id}/read`. Read state is durable and shared within the demo family. Raw transcripts are not returned in notifications. These APIs retain the application's existing demo family-selection access model.

## Verification

Backend regression tests exercise real artifact loading, immutable retries, summaries, exact quote checks, threshold-independent notifications, quota delays, stale leases, family isolation, and SQLite migration round trips and a full fresh-database Alembic upgrade. The initial migration now supplies a SQLite JSON fallback while preserving PostgreSQL JSONB. PostgreSQL DDL is checked without a server; a live PostgreSQL migration/concurrency run remains necessary before production deployment. Gemini responses are mocked in automated tests, so these checks validate orchestration and evidence accounting rather than classification quality on real conversations.

This release does not backfill old purchases, retrain the detector, connect banking providers, or change the child's proposed-purchase API. Completed-purchase processing uses the existing Gemini SDK directly.
