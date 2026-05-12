---
phase: 03-phase-3-forecast-trust-transactions-fix-make-the-forecast-pa
plan: 03
subsystem: One-Off Classification, Vendor Intelligence, Intelligence Tab
tags: [one-off, vendor-research, deepseek, first-seen, drill-down, income-tracking]
depends_on: [03-01, 03-02]
requires: [P3-15, P3-16, P3-17, P3-18, P3-19, P3-20, P3-21, P3-22, P3-23]
provides:
  - "Correct one-off classification (occurrenceCount >= 2 never one-off)"
  - "Income-side one-off detection tracked separately from expense-side"
  - "DeepSeek v4 Flash vendor research with 90-day cache"
  - "First-seen vendor flags distinct from one-off"
  - "Complete vendor_intel population on every upload"
  - "Backfill script for existing statement_history data"
  - "Vendor click drill-down with occurrence history and trend analysis"
affects:
  - "aggregate API vendors response shape"
  - "VendorIntelEntry interface"
  - "VendorLearning interface (direction, incomeAmounts, expenseAmounts)"
  - "LearningReport interface (oneOffIncomeCandidates, oneOffExpenseCandidates)"
tech-stack:
  added:
    - "OpenAI SDK (DeepSeek v4 Flash via custom baseURL)"
    - "Supabase service role key (backfill script)"
  patterns:
    - "Deterministic one-off gate: appearanceCount < 2"
    - "90-day vendor research cache (researched_at timestamp)"
    - "Fire-and-forget vendor intel population (non-blocking in aggregate API)"
    - "Shared ensureCompleteVendorIntel function (reused in aggregate + upload pipeline)"
key-files:
  created:
    - "supabase/migrations/003_one_off_logic.sql"
    - "scripts/backfill-vendor-intel.ts"
  modified:
    - "src/lib/detection/pattern-detector.ts"
    - "src/lib/learning/cross-month-learner.ts"
    - "src/lib/vendor-intel.ts"
    - "src/lib/pipeline/upload-pipeline.ts"
    - "src/app/api/documents/aggregate/route.ts"
    - "src/components/dashboard/intelligence-tab.tsx"
    - "src/components/dashboard/vendor-learning.tsx"
    - "src/app/(app)/dashboard/page.tsx"
decisions:
  - "Irregular 2+ occurrence vendors create low-confidence (0.1) RecurringPayment entries rather than being marked as one-off"
  - "One-off = exactly 1 appearance in entire transaction history (appearanceCount < 2 gate)"
  - "Vendor research results cached for 90 days via researchedAt timestamp"
  - "ensureCompleteVendorIntel shared function used by both aggregate route and upload pipeline"
  - "vendor_intel research runs in background (fire-and-forget) in aggregate API to not block response"
  - "Income and expense one-off candidates tracked separately in LearningReport"
metrics:
  duration: "19 minutes"
  tasks: 3
  files: 9
  completed_date: "2026-05-12"
---

# Phase 3 Plan 3: Fix One-Off Logic, Vendor Research, and Drill-Down Summary

**One-liner:** Rebuilt one-off classification so only single-appearance vendors are marked one-off, added DeepSeek v4 Flash vendor research with 90-day cache, and built clickable vendor drill-down in the Intelligence tab.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-03-07 Info Disclosure | src/lib/vendor-intel.ts | Only merchant names sent to DeepSeek API; no PII or transaction amounts included |
| threat_flag: T-03-08 Elevation of Privilege | scripts/backfill-vendor-intel.ts | Requires SUPABASE_SERVICE_ROLE_KEY; documented as never-commit; script is opt-in manual execution |
| threat_flag: T-03-09 Tampering | src/lib/detection/pattern-detector.ts | One-off classification is deterministic (occurrenceCount >= 2 -> not oneOff); no user input influences this rule |
| threat_flag: T-03-10 Denial of Service | src/lib/vendor-intel.ts | 90-day research cache via researchedAt; research only triggers for truly unknown vendors |

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Fix one-off logic | `1e6fd48` | pattern-detector: irregular+2 occurrences -> low-confidence recurring; cross-month-learner: direction/income/expense tracking, oneOffIncome/ExpenseCandidates; aggregate: oneOffIncome/oneOffExpenses in response |
| 2 | Vendor research & first-seen | `162f1d1` | vendor-intel: researchedAt/researchData/isFirstSeen/direction fields, researchVendorWithAI, researchAndCacheVendor, ensureCompleteVendorIntel; migration 003; backfill script; upload pipeline integration |
| 3 | Vendor drill-down UI | `ec8e284` | aggregate: occurrences/monthlyFrequency/amountTrend in response, oneOff as object array; intelligence-tab: selectedVendor state, drill-down panel; vendor-learning: onVendorClick, oneOff tab |

## Verification

- [x] `npx tsc --noEmit` passes with zero errors
- [x] pattern-detector.ts: Irregular 2+ occurrence vendors create RecurringPayment (confidence 0.1) instead of one-off
- [x] cross-month-learner.ts: VendorLearning includes direction, incomeAmounts, expenseAmounts
- [x] cross-month-learner.ts: LearningReport includes oneOffIncomeCandidates and oneOffExpenseCandidates
- [x] aggregate/route.ts: vendors response includes oneOffIncome, oneOffExpenses, occurrences, monthlyFrequency, amountTrend
- [x] aggregate/route.ts: oneOff response is object array (not string[])
- [x] vendor-intel.ts: exports researchVendorWithAI, researchAndCacheVendor, ensureCompleteVendorIntel
- [x] vendor-intel.ts: VendorIntelEntry includes researchedAt, researchData, isFirstSeen, direction
- [x] upload-pipeline.ts: calls ensureCompleteVendorIntel
- [x] Migration 003_one_off_logic.sql: adds researched_at, research_data, is_first_seen, direction columns
- [x] scripts/backfill-vendor-intel.ts: executable via npx tsx, accepts --company-id flag
- [x] intelligence-tab.tsx: selectedVendor state, drill-down panel with stats grid and occurrence table
- [x] vendor-learning.tsx: onVendorClick prop, oneOff tab panel

## Self-Check: PASSED

- [x] `supabase/migrations/003_one_off_logic.sql` exists
- [x] `scripts/backfill-vendor-intel.ts` exists
- [x] Commit `1e6fd48` exists (Task 1)
- [x] Commit `162f1d1` exists (Task 2)
- [x] Commit `ec8e284` exists (Task 3)
- [x] `npx tsc --noEmit` exits 0
