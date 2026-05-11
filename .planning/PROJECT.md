# Cashflow Intelligence App — Core Logic & Product Experience Fix

## What This Is

A business cashflow forecasting app that learns from uploaded bank statements. Business owners upload their NatWest PDF statements and the app tells them clearly how the current month is likely to end — predicted balance, expected remaining income/expenses, and risk level — based on recurring patterns detected across their historical statements. Currently deployed on Vercel at rise-up-ai.vercel.app with multi-tenant Supabase auth.

## Core Value

**"I upload my statements, and the app tells me clearly how the current month is likely to end, while learning month by month from the business history."** The forecast must start from the latest actual statement closing balance and answer: will the business survive until the next major income payment?

## Requirements

### Validated

- ✓ Multi-tenant auth (Supabase email/password + Google OAuth) — existing
- ✓ PDF statement parsing via unpdf (NatWest format) — existing
- ✓ Transaction storage and retrieval — existing
- ✓ Company/company_members RLS — existing
- ✓ Vendor intelligence learning — existing
- ✓ AI-powered transaction classification (DeepSeek/Claude) — existing
- ✓ Upload flow with duplicate detection — existing
- ✓ Mobile-responsive layout with bottom tab bar — existing

### Active

#### Phase 1: Backend Logic Fixes (Balance, Forecast, Categorization)

- [ ] **BAL-01**: `currentBalance` computed from latest statement `closing_balance`, NOT accumulated net flow
- [ ] **BAL-02**: `lastKnownBalance` = latest statement `closing_balance`, `lastKnownBalanceDate` = latest statement `period_to`
- [ ] **BAL-03**: `accumulatedNetFlow` shown separately, never presented as current bank balance
- [ ] **BAL-04**: Balance validation check — closing balance must equal previous balance + paid in - withdrawn
- [ ] **BAL-05**: Separate "current cash position" (latest statement only) from "accumulated performance" (all statements)
- [ ] **FOR-01**: `catchUpBalance()` starts from latest actual closing balance, not accumulated net flow
- [ ] **FOR-02**: `catchUpBalance()` does not apply recurring transactions that already happened during the latest statement period
- [ ] **FOR-03**: `generateForecast()` forecasts only from latest actual date to month-end
- [ ] **FOR-04**: Three forecast modes: completed month (actuals only), current partial month (forecast remaining), future month (on request)
- [ ] **FOR-05**: Forecast formula: `predictedMonthEnd = latestStatementClosingBalance + expectedRemainingIncome - expectedRemainingExpenses`
- [ ] **FOR-06**: Recurring pattern prediction uses actual historical transaction dates, not scaled daily averages
- [ ] **FOR-07**: Deduplication — check if recurring transaction already happened in current month before forecasting
- [ ] **FOR-08**: Each forecasted item marked as Completed, Expected, Late/missing, or Uncertain
- [ ] **FOR-09**: Confidence tiers: high (4+ months, stable), medium (show as possible), low (exclude from main forecast)
- [ ] **CAT-01**: Leicester City Council → not one-off (recurring council payment)
- [ ] **CAT-02**: Shell, BP, Tesco Pay at Pump, ASDA Petrol, MFG, Sainsbury's Petrol → car-expenses
- [ ] **CAT-03**: Apple, Amazon Prime, Prime Video, Spotify, PureGym, OpenAI, Monday.com, Gamma, PDFLeader, 01.AI → subscriptions/software
- [ ] **CAT-04**: AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property → property-management
- [ ] **CAT-05**: `learnFromHistory()` separates true recurring, frequent irregular, same vendor different property, same vendor different transaction type, income vs expense
- [ ] **SUS-01**: `suspicious-detector.ts` must not classify rent/property income as food/personal
- [ ] **SUS-02**: Suspicious detector considers amount, direction, vendor type, and transaction wording
- [ ] **SUS-03**: Tranquil Accommodation income → property/rent, not fast food or personal
- [ ] **UPL-01**: Upload triggers full recalculation pipeline (validate → learn → reclassify → update patterns → update forecast)
- [ ] **UPL-02**: After upload, show summary: imported period, latest balance, new vendors, updated patterns, potential personal expenses, forecast updated
- [ ] **RIS-01**: Risk messages are useful, not generic (e.g., "Balance expected to remain below threshold until Tranquil Accommodation payments arrive around 23-24 May")
- [ ] **FOR-10**: Forecast output shows business-useful summary at top: latest balance, expected remaining income/expenses, predicted month-end balance, lowest expected balance with date, status, confidence %

#### Phase 2: Dashboard UI & Experience

- [ ] **UI-01**: Daily forecast readable and grouped — top 3-5 items per day with "+ X more" expandable section
- [ ] **UI-02**: Monthly breakdown shows individual month cards (not accumulated ranges)
- [ ] **UI-03**: Each month card: month name, statement period, opening/closing balance, income, expenses, net movement, transaction count, top sources/categories, unusual items, forecast accuracy
- [ ] **UI-04**: Dashboard tabs: Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue
- [ ] **UI-05**: Review queue with appropriate wording ("Needs review", "Possible personal expense", "Business context unclear")
- [ ] **UI-06**: Each flagged item: transaction, amount, reason, confidence, suggested action, mark as business/personal, exclude from forecast, apply rule to similar
- [ ] **UI-07**: Interactive insight cards — click to see related transactions, historical pattern, forecast logic, confidence score
- [ ] **UI-08**: Status display: Safe / Watch / Risk / Critical with clear criteria
- [ ] **UI-09**: Key drivers section: biggest expected income still to arrive, biggest expected expenses still to leave
- [ ] **UI-10**: Recommended actions section with specific, actionable suggestions

### Out of Scope

- Visual redesign of the entire app (color palette, typography, spacing overhaul) — focus is on logic and layout structure
- New chart library or chart types beyond existing Recharts usage
- Multi-currency support
- Non-NatWest bank statement formats
- Mobile app (native)
- Public API

## Context

### Current State

The app is deployed and functional at a technical level, but produces incorrect output:

- **Critical bug**: `currentBalance` shows accumulated net flow (-£32,822.66) instead of latest statement closing balance (£380.93). This is the root cause of most user-facing problems.
- **Forecast is unusable**: Built on wrong balance, includes low-confidence items, doesn't deduplicate, produces random large negative balances.
- **Categorization is poor**: Leicester City Council (hundreds of transactions) treated as one-off. Fuel vendors scattered across supplies/one-off. Subscription services not recognized. Property vendors not classified.
- **Suspicious detector has false positives**: Rent income flagged as "fast food" due to weak keyword matching.
- **Dashboard is confusing**: Mixes accumulated data with current position. No separation between what the bank says and what the app calculated.

### Technical Environment

- Next.js 16.2 App Router, TypeScript, Tailwind CSS v4
- Supabase (auth, database, RLS)
- Recharts v3.8.1 for charts
- unpdf for PDF parsing
- AI SDK with DeepSeek v4 Flash (primary) and Claude Sonnet 4.6 (fallback)
- date-fns v4.1.0
- Deployed on Vercel (rise-up-ai.vercel.app)

### Key Files to Modify

- `src/app/api/documents/aggregate/route.ts` — Main data endpoint (600+ lines)
- `src/lib/forecast/index.ts` — `catchUpBalance()`, `generateForecast()`
- `src/lib/forecast/daily-forecaster.ts` — `generateDailyForecast()`
- `src/lib/forecast/risk-detector.ts` — `detectRisks()`
- `src/lib/learning/cross-month-learner.ts` — `learnFromHistory()`
- `src/lib/detection/suspicious-detector.ts` — Suspicious transaction detection
- `src/lib/detection/subcategory-classifier.ts` — AI subcategory classification
- `src/app/(app)/dashboard/page.tsx` — Dashboard UI
- `src/app/(app)/forecast/page.tsx` — Forecast page
- `src/app/(app)/upload/page.tsx` — Upload flow

## Constraints

- **Tech stack**: Must stay within existing Next.js/Supabase/Recharts stack
- **Backward compatibility**: Existing database schema must be supported; migrations if needed
- **Data integrity**: Fix must not corrupt existing statement data
- **AI**: Keep DeepSeek v4 Flash as primary, Claude Sonnet as fallback

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Split into 2 phases (backend → UI) | Backend logic fixes are prerequisite for meaningful UI changes | — Pending |
| currentBalance = latest statement closing_balance | User's explicit requirement; accumulated net flow is a separate concept | — Pending |
| Three confidence tiers for forecast | Prevents low-confidence items from polluting the forecast | — Pending |
| Forecast only current month by default | User's core use case; future months on request | — Pending |
| Categorization fixes via keyword/pattern rules + AI | Specific vendors need deterministic classification; AI for ambiguous cases | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-11 after initialization*
