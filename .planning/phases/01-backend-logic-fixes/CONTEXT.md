# Phase 1 Context: Backend Logic Fixes

**Phase:** 01-backend-logic-fixes
**Requirements:** BAL-01 through BAL-05, FOR-01 through FOR-10, CAT-01 through CAT-05, SUS-01 through SUS-03, UPL-01/02, RIS-01 (26 total)

## Current State

The app is deployed and functional at a technical level but produces incorrect output:
- `currentBalance` shows accumulated net flow (-32,822.66) instead of latest statement closing balance (380.93)
- Forecast is built on wrong balance, includes low-confidence items, doesn't deduplicate
- Categorization treats known recurring vendors as one-offs
- Suspicious detector has false positives on rent income
- Dashboard mixes accumulated data with current position

## Root Cause

A `??` operator in `/api/documents/aggregate/route.ts` silently falls from `closingBalance` to accumulated net flow. `catchUpBalance()` double-counts by projecting from `lastOccurrence` without checking statement period boundary.

## Fix Order (Dependency Chain)

| Step | Requirements | Depends On | Files |
|------|-------------|------------|-------|
| 1 | BAL-01, BAL-02, BAL-04 | None | `src/app/api/documents/aggregate/route.ts`, `src/lib/financial/math.ts` (new) |
| 2 | CAT-01, CAT-02, CAT-03, CAT-04 | None | `src/lib/detection/subcategory-classifier.ts` |
| 3 | BAL-03, BAL-05 | Step 1 | `src/app/api/documents/aggregate/route.ts`, `src/types/index.ts` |
| 4 | FOR-01, FOR-02 | Step 1 | `src/lib/forecast/index.ts` |
| 5 | FOR-06, FOR-09, CAT-05 | Step 4 | `src/lib/detection/pattern-detector.ts`, `src/lib/learning/cross-month-learner.ts` |
| 6 | FOR-03, FOR-04, FOR-05, FOR-07, FOR-08, FOR-10 | Steps 4, 5 | `src/lib/forecast/index.ts`, `src/lib/forecast/daily-forecaster.ts` |
| 7 | SUS-01, SUS-02, SUS-03 | Step 2 | `src/lib/detection/suspicious-detector.ts` |
| 8 | RIS-01 | Steps 5, 6 | `src/lib/forecast/risk-detector.ts` |
| 9 | UPL-01, UPL-02 | Steps 1-8 | `src/lib/pipeline/upload-pipeline.ts` (new), `src/app/(app)/upload/` |

## Key Technical Decisions

1. **Integer pence arithmetic** for all financial calculations (multiply by 100, operate on integers, divide by 100 for display)
2. **Day-of-month pattern analysis** replaces average-gap projection for recurring detection
3. **Multi-factor confidence scoring**: occurrence count (30%), month spread (25%), amount stability (20%), interval consistency (15%), day variance (10%)
4. **Three confidence tiers**: HIGH (4+ months, stable) → main forecast; MEDIUM (2-3 months) → "possible"; LOW → excluded
5. **API response restructure**: `currentPosition` object separate from `accumulatedPerformance` object
6. **Deterministic vendor rules** run BEFORE AI classification; AI is fallback; consistent AI results promoted to rules

## Constraints

- Must stay within existing Next.js/Supabase/Recharts stack
- Existing database schema must be supported
- Must not corrupt existing statement data
- DeepSeek v4 Flash primary, Claude Sonnet fallback for AI classification
