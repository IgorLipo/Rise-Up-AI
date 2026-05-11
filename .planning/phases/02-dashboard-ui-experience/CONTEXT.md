# Phase 2 Context: Dashboard UI & Experience

**Phase:** 02-dashboard-ui-experience
**Requirements:** UI-01 through UI-10 (10 total)
**Depends on:** Phase 1 (backend logic fixes — complete)

## Current State

The dashboard (`src/app/(app)/dashboard/page.tsx`) is a single scrollable page showing:
- AccumulatedStats (cash position cards)
- InsightHeroCard (forecast summary)
- DailyForecastChart (bar chart)
- CategoryBreakdown + MonthlySummaries (two-column grid)
- VendorLearning
- SuspiciousFlagged
- Quick links to /forecast and /transactions

Separate routes exist: /dashboard, /forecast, /history, /insights, /transactions, /upload

## Goal

Restructure into tabbed dashboard with: Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue. Each tab is a distinct view. Daily forecast becomes readable (top 3-5 items/day). Monthly breakdown shows individual month cards. Review queue is actionable. Insight cards are interactive. Status display is prominent with clear criteria.

## Existing Components

| Component | File | Purpose |
|-----------|------|---------|
| AccumulatedStats | `src/components/dashboard/accumulated-stats.tsx` | Cash position stat cards |
| InsightHeroCard | `src/components/dashboard/insight-hero-card.tsx` | Forecast summary banner |
| DailyForecastChart | `src/components/charts/daily-forecast-chart.tsx` | Bar chart of daily forecast |
| CategoryBreakdown | `src/components/dashboard/category-breakdown.tsx` | Category pie/bar breakdown |
| MonthlySummaries | `src/components/dashboard/monthly-summaries.tsx` | Monthly summary cards |
| VendorLearning | `src/components/dashboard/vendor-learning.tsx` | Vendor intelligence list |
| SuspiciousFlagged | `src/components/dashboard/suspicious-flagged.tsx` | Flagged transactions list |
| DateRangeSelector | `src/components/dashboard/date-range-selector.tsx` | Date range filter |
| EmptyDashboard | `src/components/dashboard/empty-dashboard.tsx` | Empty state |
| CashPositionRow | `src/components/dashboard/cash-position-row.tsx` | Cash position row |

## Requirements to Implement

- **UI-01**: Daily forecast readable and grouped — top 3-5 items per day with "+ X more" expandable section
- **UI-02**: Monthly breakdown shows individual month cards (not accumulated ranges)
- **UI-03**: Each month card: month name, statement period, opening/closing balance, income, expenses, net movement, transaction count, top sources/categories, unusual items, forecast accuracy
- **UI-04**: Dashboard tabs: Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue
- **UI-05**: Review queue with appropriate wording ("Needs review", "Possible personal expense", "Business context unclear")
- **UI-06**: Each flagged item: transaction, amount, reason, confidence, suggested action, mark as business/personal, exclude from forecast, apply rule to similar
- **UI-07**: Interactive insight cards — click to see related transactions, historical pattern, forecast logic, confidence score
- **UI-08**: Status display: Safe / Watch / Risk / Critical with clear criteria
- **UI-09**: Key drivers section: biggest expected income still to arrive, biggest expected expenses still to leave
- **UI-10**: Recommended actions section with specific, actionable suggestions

## Key Technical Decisions

1. **Tab state via URL search params** (`?tab=forecast`) for shareable/bookmarkable links
2. **Existing components repurposed** — AccumulatedStats, InsightHeroCard, DailyForecastChart all reused inside tabs
3. **Expandable daily forecast** — top 3-5 items shown, "+X more" toggle for rest
4. **Interactive insight cards** — click opens detail panel (drawer or expand) with related transactions, pattern history, confidence breakdown
5. **Status criteria** shown inline: Safe (balance covers all expected expenses + buffer), Watch (balance covers expenses but < 20% buffer), Risk (balance may drop below 0 on some days), Critical (balance already below 0 or projected to stay below)

## Files to Modify/Create

**Modify:**
- `src/app/(app)/dashboard/page.tsx` — Tab layout structure
- `src/components/dashboard/accumulated-stats.tsx` — Enhanced status display
- `src/components/charts/daily-forecast-chart.tsx` — Grouped daily view
- `src/components/dashboard/monthly-summaries.tsx` — Rich month cards
- `src/components/dashboard/suspicious-flagged.tsx` — Review queue with actions

**Create:**
- `src/components/dashboard/tab-navigation.tsx` — Tab bar component
- `src/components/dashboard/forecast-tab.tsx` — Current Forecast tab content
- `src/components/dashboard/history-tab.tsx` — Monthly History tab content
- `src/components/dashboard/intelligence-tab.tsx` — Accumulated Intelligence tab content
- `src/components/dashboard/transactions-tab.tsx` — Transactions tab content
- `src/components/dashboard/review-tab.tsx` — Review Queue tab content
- `src/components/dashboard/insight-detail-panel.tsx` — Expandable insight detail
- `src/components/dashboard/status-badge.tsx` — Status display with criteria
- `src/components/dashboard/key-drivers.tsx` — Key drivers section
- `src/components/dashboard/recommended-actions.tsx` — Recommended actions

## Constraints

- Must stay within existing Next.js/Tailwind/Recharts stack
- Dark theme (zinc-based palette) consistent with current design
- Mobile responsive
- Tab state must survive page refresh (URL search params)
- Review queue actions must persist user decisions
- Must consume the Phase 1 API response structure (currentPosition + accumulated)
