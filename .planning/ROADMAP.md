# Roadmap: Cashflow Intelligence App Fix

## Overview

This roadmap fixes the cashflow forecasting app's core logic (Phase 1), restructures the dashboard (Phase 2), and makes the forecast trustworthy with correct transactions and one-off logic (Phase 3). The root cause started as a single bug -- `currentBalance` displays accumulated net flow instead of the latest statement closing balance -- which cascaded into incorrect forecasts, polluted recurring patterns, and misleading risk messages. Phase 1 corrected the data pipeline end-to-end. Phase 2 presented the corrected data through a clear, tabbed dashboard. Phase 3 makes everything trustworthy and user-friendly.

## Phases

- [x] **Phase 1: Backend Logic Fixes** - Correct balance extraction, forecast engine, categorization, suspicious detection, risk messages, and upload recalculation pipeline (FOR-04 Modes A/C deferred to Phase 1b)
- [ ] **Phase 2: Dashboard UI & Experience** - Restructure dashboard with tabs, daily forecast readability, month cards, review queue, insight cards, status display, and action recommendations
- [ ] **Phase 3: Forecast Trust & Transactions Fix** - Make Forecast page trustworthy with source-of-truth, validation, audit trail. Fix Transactions with search, drill-down, correct categorization, selectable text. Rebuild One-Off logic so repeats are never one-off.

## Phase Details

### Phase 1: Backend Logic Fixes
**Goal**: The app produces correct balance figures (bank-verified, not computed), accurate forecasts with confidence tiers and deduplication, proper vendor categorization, useful suspicious detection, specific risk messages, and a complete upload recalculation pipeline.
**Depends on**: Nothing (first phase)
**Requirements**: BAL-01, BAL-02, BAL-03, BAL-04, BAL-05, FOR-01, FOR-02, FOR-03, FOR-04, FOR-05, FOR-06, FOR-07, FOR-08, FOR-09, FOR-10, CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, SUS-01, SUS-02, SUS-03, UPL-01, UPL-02, RIS-01
**Success Criteria** (what must be TRUE):
  1. User sees correct bank balance (latest statement closing balance) as the hero "Current Bank Balance" metric, clearly separated from accumulated all-time net flow shown as a distinct secondary metric
  2. User receives an accurate month-end forecast starting from the correct closing balance, covering only remaining days in the current month, with deduplicated transactions and confidence-tiered line items (HIGH included in total, MEDIUM shown as possible, LOW excluded)
  3. User sees known vendors correctly categorized (council tax, car-expenses, subscriptions/software, property-management) and business income correctly classified as such, never flagged as personal expenses
  4. User sees specific, actionable risk messages naming vendors, amounts, dates, and resolution timing (e.g., "Balance expected to remain below threshold until Tranquil Accommodation payments arrive around 23-24 May")
  5. After uploading a statement, user sees a complete recalculation summary showing imported period, latest balance, new vendors learned, updated patterns, potential personal expenses, and updated forecast
**Plans**: 1 plan
- [x] 01-01-PLAN.md — Backend Logic Fixes (10 tasks)

#### Phase 1 Build Order

The 26 requirements have strict dependencies. Work must proceed in this order:

| Step | Requirements | Description | Depends On |
|------|-------------|-------------|------------|
| 1 | BAL-01, BAL-02, BAL-04 | Balance extraction from latest statement closing_balance + validation check | Nothing |
| 2 | CAT-01, CAT-02, CAT-03, CAT-04 | Vendor-to-category keyword mapping layer (deterministic, pre-AI) | Nothing |
| 3 | BAL-03, BAL-05 | API response restructuring: separate `currentPosition` from `accumulatedPerformance` | Step 1 |
| 4 | FOR-01, FOR-02 | `catchUpBalance` anchored to correct balance, statement-period-aware projection | Step 1 |
| 5 | CAT-05, FOR-09 | `learnFromHistory` separation logic + multi-factor confidence tiers | Step 4 |
| 6 | FOR-03, FOR-04, FOR-05, FOR-07, FOR-08, FOR-10 | Forecast generation: correct formula, deduplication, item tagging, output summary | Steps 4, 5 |
| 7 | SUS-01, SUS-02, SUS-03 | Suspicious detector: direction gate, amount gate, business whitelist | Step 2 |
| 8 | RIS-01 | Specific risk messages with vendor names, timing context, actionable suggestions | Steps 5, 6 |
| 9 | UPL-01, UPL-02 | Upload triggers full recalculation pipeline + post-upload summary | Steps 1-8 |
| 10 | FOR-06 | Recurring pattern prediction using actual historical transaction dates (day-of-month analysis) | Step 5 |

### Phase 2: Dashboard UI & Experience
**Goal**: The dashboard is organized into clear tabs with readable daily forecasts, individual month cards, an actionable review queue, interactive insight cards, a prominent status display, and specific action recommendations.
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. User can view a clean daily forecast with top 3-5 items per day and "+ X more" expandable sections for each day
  2. User can navigate between dashboard tabs (Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue) to find information by context
  3. User can review flagged transactions with clear reasons, confidence scores, and one-click actions (mark as business/personal, exclude from forecast, apply rule to similar)
  4. User sees individual month cards showing month name, statement period, opening/closing balance, income/expenses, net movement, transaction count, top sources, unusual items, and forecast accuracy
  5. User sees a prominent risk status display (Safe/Watch/Risk/Critical) with clear criteria, key drivers showing biggest expected income/expenses, and specific recommended actions
**Plans**: 3 plans (3 waves)
- [x] 02-01-PLAN.md — Tab framework + status display (TabNavigation, page restructure, StatusBadge with criteria, KeyDrivers)
- [x] 02-02-PLAN.md — Forecast + History + Intelligence tabs (grouped daily forecast, rich month cards, interactive insight detail panel)
- [ ] 02-03-PLAN.md — Review Queue + Transactions + Assembly (actionable review items, RecommendedActions, final page.tsx wiring)
**UI hint**: yes

### Phase 3: Forecast Trust & Transactions Fix
**Goal**: Make the Forecast page trustworthy, explainable, and validated against the latest uploaded statement. Fix Transactions to be understandable, copyable, correctly categorized, and properly searchable/drillable. Rebuild One-Off logic so repeated transactions are never left as one-off.
**Depends on**: Phase 1, Phase 2
**Requirements**: P3-01, P3-02, P3-03, P3-04, P3-05, P3-06, P3-07, P3-08, P3-09, P3-10, P3-11, P3-12, P3-13, P3-14, P3-15, P3-16, P3-17, P3-18, P3-19, P3-20, P3-21, P3-22, P3-23
**Success Criteria** (what must be TRUE):
  1. User sees statement source-of-truth block with balance validation formula (green checkmark or red warning) directly in the forecast tab
  2. User sees forecast calculation audit trail showing exactly how the predicted month-end number was calculated, with HIGH and MEDIUM confidence tier breakdowns
  3. User sees correct status badges: Risk for temporary negative (recovers by month-end), Critical only when ending the month negative
  4. User sees opening AND closing balances for each daily forecast day, with catch-up estimate visibility and low-confidence forecast notices
  5. Transaction text is selectable and copyable everywhere, each transaction has one primary category (mutually exclusive), and known misclassifications (Costa Coffee, Apple, Amazon) are fixed
  6. Transactions tab has search input, clickable category drill-down, View all toggle, and readable row format with Date, Merchant, Category badge, color-coded Amount
  7. Vendors appearing 2+ times across any time period are never marked as one-off — one-off means exactly one appearance in entire transaction history
  8. Unknown vendors are researched via DeepSeek v4 Flash and cached in vendor_intel; first-seen vendors flagged distinctly from one-offs; income-side one-off detection works same as expense-side
  9. Clicking a vendor in Recurring or One-Off lists shows occurrence drill-down with dates, amounts, trend; backfill script populates vendor_intel for existing data
**Plans**: 3 plans (2 waves)
- [x] 03-01-PLAN.md — Part 1: Forecast Trust & Validation (8 criteria: statement source-of-truth, balance validation, audit trail, status fix, daily opening/closing, catch-up estimate, forecast mode rules, hero delta)
- [x] 03-02-PLAN.md — Part 2: Transactions Fix (6 criteria: text selection, primary category, classification fixes, category list rebuild, search & drill-down, row readability)
- [ ] 03-03-PLAN.md — Part 3: One-Off Logic Rebuild (9 criteria: repeat detection, one-off definition, vendor research, first-seen flag, vendor look-ahead, occurrence drill-down, vendor_intel population, backfill script, income-side detection)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Logic Fixes | 1/1 | 10/10 tasks complete | 2026-05-11 |
| 2. Dashboard UI & Experience | 2/3 | 6/9 tasks complete | 2026-05-11 |
| 3. Forecast Trust & Transactions Fix | 0/3 | Not started | - |
