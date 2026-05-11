---
phase: "01-backend-logic-fixes"
plan: "01-backend-logic-fixes"
subsystem: "backend-core"
tags: [balance, forecast, categorization, suspicious-detection, risk-messages, upload-pipeline]
requires: []
provides: [currentPosition, accumulated, multi-factor-confidence, tier-filtered-forecast, vendor-gated-suspicious, upload-recalculation]
affects: [aggregate-api, dashboard, upload-page, forecast-engine, detection-engine, cross-month-learner]
tech-stack:
  added:
    - src/lib/financial/math.ts (integer pence arithmetic)
    - src/lib/pipeline/upload-pipeline.ts (deterministic recalculation pipeline)
  patterns:
    - Integer pence arithmetic for GBP financial calculations
    - currentPosition (bank-verified) vs accumulated (computed) separation
    - Three-tier confidence scoring: HIGH (>=0.70), MEDIUM (0.40-0.69), LOW (<0.40)
    - Deterministic vendor keyword rules run before AI classification
    - Direction/amount/vendor gates in suspicious detection
    - Statement period boundary check in catch-up balance projection
key-files:
  created:
    - src/lib/financial/math.ts
    - src/lib/pipeline/upload-pipeline.ts
  modified:
    - src/app/api/documents/aggregate/route.ts
    - src/app/(app)/dashboard/page.tsx
    - src/app/(app)/upload/page.tsx
    - src/lib/detection/subcategory-classifier.ts
    - src/lib/detection/pattern-detector.ts
    - src/lib/detection/suspicious-detector.ts
    - src/lib/learning/cross-month-learner.ts
    - src/lib/forecast/index.ts
    - src/lib/forecast/daily-forecaster.ts
    - src/lib/forecast/risk-detector.ts
    - src/components/dashboard/accumulated-stats.tsx
    - src/types/index.ts
decisions:
  - Integer pence arithmetic for all financial calculations to prevent floating-point drift
  - currentPosition.balance equals latest statement closingBalance only -- never falls back to accumulated net flow
  - accumulated.netFlow labeled as "All-Time Net Flow" to distinguish from bank-verified balance
  - 5-factor weighted confidence model with amount variance cap at MEDIUM
  - Day-of-month anchored projection for monthly recurring patterns
  - Known business vendors skip personal expense detection entirely
metrics:
  duration: "28 minutes"
  completed_date: "2026-05-11T17:48:46Z"
  task_count: 10
  file_count: 13
---

# Phase 01 Plan 01: Backend Logic Fixes Summary

**One-liner:** Fixed the core data pipeline so `currentPosition.balance` is always bank-verified (no `??` fallback), forecast uses tiered confidence filtering, and suspicious detection gates prevent false positives on business income.

## Completed Tasks

| #   | Task                                   | Commit   | Key Files                                         |
| --- | -------------------------------------- | -------- | ------------------------------------------------- |
| 1   | Financial Math Utilities               | bb75cb1  | src/lib/financial/math.ts (created)               |
| 2   | Fix Balance Extraction                 | 5b12a7b  | src/app/api/documents/aggregate/route.ts          |
| 3   | Add Vendor Keyword Rules               | 0514207  | src/lib/detection/subcategory-classifier.ts       |
| 4   | API Response Restructuring             | 9cf2e7c  | src/types/index.ts, dashboard, AccumulatedStats   |
| 5   | Fix catchUpBalance Deduplication       | 37d142c  | src/lib/forecast/index.ts                         |
| 6   | Multi-Factor Confidence Scoring        | 7968ad1  | pattern-detector.ts, cross-month-learner.ts        |
| 7   | Fix Forecast Generation                | 4afd9a2  | src/lib/forecast/index.ts, daily-forecaster.ts     |
| 8   | Fix Suspicious Detector                | 422a61d  | suspicious-detector.ts, aggregate/route.ts         |
| 9   | Fix Risk Messages                      | bce587d  | risk-detector.ts, forecast/index.ts               |
| 10  | Upload Pipeline Recalculation          | 82cae7e  | src/lib/pipeline/upload-pipeline.ts (created)     |

## Verification Results

- **`npx tsc --noEmit`:** PASSED (zero errors)
- **Test suite:** No existing test files (project has no tests yet)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added property-income to types/index.ts Subcategory type**
- **Found during:** Task 3
- **Issue:** New `property-income` subcategory was added to subcategory-classifier.ts but was missing from the `Subcategory` type in types/index.ts
- **Fix:** Added `"property-income"` to the union type in both files
- **Files modified:** src/types/index.ts

**2. [Rule 3 - Blocking Issue] Fixed forecast variable dependency after balance restructuring**
- **Found during:** Task 2
- **Issue:** `generateForecast(displayPatterns, currentBalance)` referenced the removed `currentBalance` variable
- **Fix:** Replaced with `forecastStartingBalance` and made forecast generation conditional
- **Files modified:** src/app/api/documents/aggregate/route.ts

**3. [Rule 1 - Bug] Removed stale `catchUpBalance` import from aggregate route**
- **Found during:** Task 2
- **Issue:** `catchUpBalance` was still imported but no longer called from the aggregate route after the balance restructuring
- **Fix:** Removed unused import
- **Files modified:** src/app/api/documents/aggregate/route.ts

### Planned Deferred Items

- **FOR-04 Mode A (completed month detection):** `isMonthComplete` hardcoded to `false` with a comment pointing to deferred implementation location in forecast/index.ts. Phase 1b will compute this based on statement coverage.
- **FOR-04 Mode C (future month forecast):** Deferred to Phase 1b — requires a future-month parameter in `generateForecast()`.
- **UI-01 through UI-04:** Phase 2 tasks (dashboard tabs, monthly breakdown cards, daily forecast grouping) — outside scope of backend logic fixes.

## Known Stubs

- `isMonthComplete` in `src/lib/forecast/index.ts:generateForecast` — hardcoded to `false`. Phase 1b will compute this in the aggregate route based on whether the latest statement's period_to covers the full calendar month. The comment at the implementation location reads: "Deferred to Phase 1b: isMonthComplete computed in aggregate route based on statement coverage."

## Self-Check: PASSED

All 10 commit hashes verified in git log:
- bb75cb1, 0514207, 5b12a7b, 9cf2e7c, 37d142c, 7968ad1, 4afd9a2, 422a61d, bce587d, 82cae7e

All 13 files verified to exist and contain expected changes.

`npx tsc --noEmit` exits with code 0 — no type errors.
