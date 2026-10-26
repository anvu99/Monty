# Demo conversation seed data: proposal

Owner: @anvu99
Status: proposal for discussion; no seeding is performed by this PR.

## Problem
The current seed script populates demo families, purchases, assessments, memories, and decision logs, but does not populate ended conversations and their extracted decision events. Reproducible conversation examples would make coaching and extraction easier to develop and review.

## Proposed work
- Add opt-in deterministic synthetic fixtures for demo children, with stable conversation/message/event IDs and UTC timestamps.
- Include waiting or skipping a purchase, a savings commitment, a reported completed purchase, and a conversation containing no financial decisions. Distinguish commitments from completed outcomes.
- Create valid EndedConversation records and completed DecisionEvent fixtures that satisfy the current transcript hash, facts, evidence, and child/conversation relationships.
- Mark seeded extraction jobs completed so loading demo data does not enqueue model requests or spend API quota.
- Make reseeding idempotent and restrict cleanup to the fixture IDs. Do not delete real families or transcripts; avoid relying on the existing seed script's broad demo-family cleanup.
- Document the explicit development-only invocation and reset behavior.
- Treat the Kid chat's sessionStorage history separately: database seed records do not automatically appear in the active chat. A saved-conversation browser or demo replay UI is a separate feature unless explicitly included later.

## Acceptance criteria
- Seeding an empty development database creates valid synthetic conversations and decisions for multiple demo children.
- A second run produces no duplicates and changes no unrelated records.
- Every evidence reference points to the correct message in the same conversation, and examples do not leak between children.
- Seed operations make no external/model calls and create no pending extraction jobs.
- Reading seeded status/context succeeds, and setup instructions clearly state what is visible in the current UI.

## Discussion for anvu99
Confirm the demo scenarios needed and whether backend conversation fixtures alone are sufficient, or whether a separately scoped saved-conversation/replay UI is needed. This proposal does not run or implement a seeder.
