---
status: complete
completed_at: "2026-05-14"
---

## Summary

Fixed the forecast engine to properly handle One-Off transactions:

1. **One-Offs excluded from daily forecast** — Confirmed the daily forecaster only iterates `recurringExpenses`/`recurringIncome`, never touches one-off fields.

2. **Monthly average one-off buffer** — Added `monthlyOneOffExpenseAvg` and `monthlyOneOffIncomeAvg` to `LearningReport`, computed across all statements by the cross-month learner (authoritative source). Displayed as a blue "Monthly one-off buffer" info card in the ForecastTab (display-only, not injected into forecast math).

3. **Strict one-off definition** — Cross-month learner (`learnFromHistory`) already uses `appearanceCount < 2` across ALL statements. Added JSDoc to `detectPatterns` clarifying its per-call classification is provisional.

### Files changed
- `src/lib/learning/cross-month-learner.ts` — Added `monthlyOneOffExpenseAvg`/`monthlyOneOffIncomeAvg` to `LearningReport` + calculation logic
- `src/lib/detection/pattern-detector.ts` — Added clarifying JSDoc
- `src/app/api/documents/aggregate/route.ts` — Exposed new fields in forecast response
- `src/app/(app)/dashboard/page.tsx` — Updated `AggregateResponse` type, wired props
- `src/components/dashboard/forecast-tab.tsx` — Added "Monthly one-off buffer" card

### Verification
- TypeScript compiles clean (`npx tsc --noEmit`)
- Commit: `53d10f6`
