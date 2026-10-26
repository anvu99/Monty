# Parent purchase impulse scores: proposal

Owner: @anvu99
Status: proposal for discussion; no runtime implementation in this PR.

## Problem
Parents can see recorded purchases, but cannot reliably see an impulse score for each one. Monty already has an ImpulseScore model and proposed-purchase assessments. Neither provides a durable transaction-to-assessment relationship. The assess-purchase endpoint currently returns a result without persisting it.

## Proposed work
- Evaluate reusing and extending the existing assessment model rather than creating a duplicate scoring model.
- Persist assessments with their status, score, factors, explanation, timestamp, and model/prompt version where available.
- Link a confirmed transaction to the assessment that evaluated that purchase using an explicit durable identifier. Do not infer links from child, merchant, amount, or nearby timestamps.
- Preserve the distinction between proposed purchases and confirmed transactions. Link only when completion is recorded; do not create transactions merely to save an assessment.
- Expose optional linked assessment details in parent purchase Updates and child transaction history. Show an unscored state when no valid assessment exists, and never substitute the child's latest score or zero.
- Keep dashboard reads free of model calls. Define how reassessments and insufficient-data results are presented before implementation.

## Acceptance criteria
- A correctly linked purchase displays its score and assessment time.
- Unlinked purchases and insufficient-data assessments display a clear unscored state.
- Records from another child or family cannot supply a purchase's score.
- Score semantics and range match the current assessment contract; the UI identifies the value as an assessment rather than a confirmed behavioral outcome.
- Persistence and linkage have migration, API, UI, and regression-test coverage.

## Discussion for anvu99
Confirm whether stored per-purchase scores should appear in both parent Updates and transaction history, and choose the purchase-confirmation path that will create the explicit link. This proposal does not implement scoring or transaction ingestion.
