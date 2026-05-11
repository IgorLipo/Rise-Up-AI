---
status: resolved
trigger: "Dashboard shows fabricated £446K balance when real balance is -£14.5K. Date range filter doesn't affect displayed data. Monthly view lacks clear per-month status."
created: 2026-05-11
updated: 2026-05-11
---

## Current Focus

**hypothesis:** Two bugs: (1) catchUpBalance projects recurring patterns 314 days forward from old statement, fabricating balance. (2) Date range filter passes `from`/`to` params to API but dashboard components don't reflect filtered data properly.

**next_action:** Fix applied — see Resolution.

## Resolution

**root_cause:** The aggregate API route filtered transactions for `accumulated`, `monthly`, and `categories` but passed unfiltered `patterns`, `suspicious`, `vendors`, `crossMonthInsights`, and `newVendors` in the response. The forecast pipeline (`catchUpBalance` + `generateForecast`) also ran on unfiltered patterns, so the most prominent dashboard cards (Current Balance, Month-end Forecast, Status) never changed when a date filter was applied.

**fix:**
1. `src/app/api/documents/aggregate/route.ts` — When `dateFilterActive`, skip `catchUpBalance` and compute balance as net flow of filtered transactions. Filter `patterns`, `suspicious`, `vendors`, `crossMonthInsights`, and `newVendors` to only include items with activity in the date range. Added `monthStatus()` function and `status` field to monthly summaries.
2. `src/app/(app)/dashboard/page.tsx` — Added `dateFilterActive` and `status` to `AggregateResponse` interface. Passed `dateFilterActive` through to `AccumulatedStats`.
3. `src/components/dashboard/accumulated-stats.tsx` — Added `dateFilterActive` prop; displays "Filtered period net" subtitle when active.
4. `src/components/dashboard/monthly-summaries.tsx` — Added per-month status indicator (colored dot + label: safe/watch/risk/critical) based on income/expense ratio.

## Symptoms

**Expected:** Dashboard shows actual statement balance (-£14,514.96) clearly labeled as "Last statement closing balance (Jul 2025)" when data is stale. Date range selector filters all dashboard data.
**Actual:** Dashboard shows £446,209.10 "Current balance — Estimated (314d projection)" fabricated by projecting old recurring patterns forward. Date range changes don't affect displayed data.
**Errors:** None visible. catchUpBalance capped at 30 days (fix already applied).
**Timeline:** Broke since catchUpBalance was introduced. Date range likely never worked properly.
**Repro:** Upload old statement → dashboard shows wildly wrong estimated balance. Select custom date range → charts don't update.

## Evidence

## Eliminated
