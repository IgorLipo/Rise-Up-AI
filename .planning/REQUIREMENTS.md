# Requirements: Cashflow Intelligence App Fix

**Defined:** 2026-05-11
**Core Value:** Upload bank statements, and the app tells business owners clearly how the current month is likely to end, while learning month by month from business history.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Balance

- [x] **BAL-01**: `currentBalance` computed from latest statement `closing_balance`, NOT accumulated net flow
- [x] **BAL-02**: `lastKnownBalance` = latest statement `closing_balance`, `lastKnownBalanceDate` = latest statement `period_to`
- [x] **BAL-03**: `accumulatedNetFlow` shown separately, never presented as current bank balance
- [x] **BAL-04**: Balance validation check -- closing balance must equal previous balance + paid in - withdrawn
- [x] **BAL-05**: Separate "current cash position" (latest statement only) from "accumulated performance" (all statements)

### Forecast

- [x] **FOR-01**: `catchUpBalance()` starts from latest actual closing balance, not accumulated net flow
- [x] **FOR-02**: `catchUpBalance()` does not apply recurring transactions that already happened during the latest statement period
- [x] **FOR-03**: `generateForecast()` forecasts only from latest actual date to month-end
- [x] **FOR-04**: Three forecast modes: completed month (actuals only), current partial month (forecast remaining), future month (on request) — Modes A & C deferred to Phase 1b
- [x] **FOR-05**: Forecast formula: `predictedMonthEnd = latestStatementClosingBalance + expectedRemainingIncome - expectedRemainingExpenses`
- [x] **FOR-06**: Recurring pattern prediction uses actual historical transaction dates, not scaled daily averages
- [x] **FOR-07**: Deduplication -- check if recurring transaction already happened in current month before forecasting
- [x] **FOR-08**: Each forecasted item marked as Completed, Expected, Late/missing, or Uncertain
- [x] **FOR-09**: Confidence tiers: high (4+ months, stable), medium (show as possible), low (exclude from main forecast)
- [x] **FOR-10**: Forecast output shows business-useful summary at top: latest balance, expected remaining income/expenses, predicted month-end balance, lowest expected balance with date, status, confidence %

### Categorization

- [x] **CAT-01**: Leicester City Council -> not one-off (recurring council payment)
- [x] **CAT-02**: Shell, BP, Tesco Pay at Pump, ASDA Petrol, MFG, Sainsbury's Petrol -> car-expenses
- [x] **CAT-03**: Apple, Amazon Prime, Prime Video, Spotify, PureGym, OpenAI, Monday.com, Gamma, PDFLeader, 01.AI -> subscriptions/software
- [x] **CAT-04**: AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property -> property-management
- [x] **CAT-05**: `learnFromHistory()` separates true recurring, frequent irregular, same vendor different property, same vendor different transaction type, income vs expense

### Suspicious Detection

- [x] **SUS-01**: `suspicious-detector.ts` must not classify rent/property income as food/personal
- [x] **SUS-02**: Suspicious detector considers amount, direction, vendor type, and transaction wording
- [x] **SUS-03**: Tranquil Accommodation income -> property/rent, not fast food or personal

### Upload Pipeline

- [x] **UPL-01**: Upload triggers full recalculation pipeline (validate -> learn -> reclassify -> update patterns -> update forecast)
- [x] **UPL-02**: After upload, show summary: imported period, latest balance, new vendors, updated patterns, potential personal expenses, forecast updated

### Risk Messages

- [x] **RIS-01**: Risk messages are useful, not generic (e.g., "Balance expected to remain below threshold until Tranquil Accommodation payments arrive around 23-24 May")

### Dashboard UI

- [ ] **UI-01**: Daily forecast readable and grouped -- top 3-5 items per day with "+ X more" expandable section
- [ ] **UI-02**: Monthly breakdown shows individual month cards (not accumulated ranges)
- [ ] **UI-03**: Each month card: month name, statement period, opening/closing balance, income, expenses, net movement, transaction count, top sources/categories, unusual items, forecast accuracy
- [ ] **UI-04**: Dashboard tabs: Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue
- [ ] **UI-05**: Review queue with appropriate wording ("Needs review", "Possible personal expense", "Business context unclear")
- [ ] **UI-06**: Each flagged item: transaction, amount, reason, confidence, suggested action, mark as business/personal, exclude from forecast, apply rule to similar
- [ ] **UI-07**: Interactive insight cards -- click to see related transactions, historical pattern, forecast logic, confidence score
- [ ] **UI-08**: Status display: Safe / Watch / Risk / Critical with clear criteria
- [ ] **UI-09**: Key drivers section: biggest expected income still to arrive, biggest expected expenses still to leave
- [ ] **UI-10**: Recommended actions section with specific, actionable suggestions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual redesign of entire app (color palette, typography, spacing overhaul) | Focus is on logic and layout structure |
| New chart library or chart types beyond existing Recharts usage | Existing Recharts v3.8.1 is sufficient |
| Multi-currency support | GBP-only for v1 |
| Non-NatWest bank statement formats | NatWest is the only supported format |
| Native mobile app | Web-first |
| Public API | Not in scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BAL-01 | Phase 1 | Complete |
| BAL-02 | Phase 1 | Complete |
| BAL-03 | Phase 1 | Complete |
| BAL-04 | Phase 1 | Complete |
| BAL-05 | Phase 1 | Complete |
| FOR-01 | Phase 1 | Complete |
| FOR-02 | Phase 1 | Complete |
| FOR-03 | Phase 1 | Complete |
| FOR-04 | Phase 1 | Partial (Modes A/C deferred to 1b) |
| FOR-05 | Phase 1 | Complete |
| FOR-06 | Phase 1 | Complete |
| FOR-07 | Phase 1 | Complete |
| FOR-08 | Phase 1 | Complete |
| FOR-09 | Phase 1 | Complete |
| FOR-10 | Phase 1 | Complete |
| CAT-01 | Phase 1 | Complete |
| CAT-02 | Phase 1 | Complete |
| CAT-03 | Phase 1 | Complete |
| CAT-04 | Phase 1 | Complete |
| CAT-05 | Phase 1 | Complete |
| SUS-01 | Phase 1 | Complete |
| SUS-02 | Phase 1 | Complete |
| SUS-03 | Phase 1 | Complete |
| UPL-01 | Phase 1 | Complete |
| UPL-02 | Phase 1 | Complete |
| RIS-01 | Phase 1 | Complete |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| UI-06 | Phase 2 | Pending |
| UI-07 | Phase 2 | Pending |
| UI-08 | Phase 2 | Pending |
| UI-09 | Phase 2 | Pending |
| UI-10 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 after Phase 1 Plan 1 execution*
