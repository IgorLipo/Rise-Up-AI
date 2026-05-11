# Architecture Research: Cashflow Data Flow Fix

**Domain:** Business cashflow forecasting from bank statements
**Researched:** 2026-05-11
**Confidence:** HIGH (all findings verified against actual source code)

## Executive Summary

The application confuses two fundamentally different concepts: **current bank position** (what the bank says you have right now — a single number from the latest statement) and **accumulated performance** (net flow summed across all uploaded statements). These concepts serve entirely different purposes. Current position is the anchor for forecasting. Accumulated performance is a retrospective metric. When the code silently falls back from one to the other (via a `??` operator), the entire forecast shifts by tens of thousands of pounds.

The fix requires (1) an unambiguous data flow that treats these as separate top-level concepts at every layer, (2) a catch-up mechanism that never double-counts transactions already reflected in the statement closing balance, and (3) a balanced API response that makes the UI incapable of confusing them.

## Current Architecture Problems

### Problem 1: `currentBalance` Has No Stable Source

In `src/app/api/documents/aggregate/route.ts`, the `currentBalance` field is assembled from three competing sources depending on code path:

| Code Path | Source for `currentBalance` | Correct? |
|-----------|-----------------------------|----------|
| No date filter, `closingBalance` is non-null | `latestStmt.accountInfo.closingBalance` (caught up via `catchUpBalance`) | PARTIALLY — correct source, but catch-up may double-count |
| No date filter, `closingBalance` is null/undefined | `accumulated net flow` across all transactions (the `??` fallback on line 299) | NO — this is the root bug |
| Date filter active | `net flow of filtered transactions` (line 281-284) | NO — for a filtered window, showing net flow as "current balance" is misleading |

The `??` fallback on line 298-299 is dangerous because it silently downgrades from an authoritative bank number to a computed number without any signal to the consumer:

```typescript
// Line 298-299: The bug
statementClosingBalance = latestStmt?.accountInfo?.closingBalance
  ?? workingTransactions.reduce((sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount), 0);
```

If `closingBalance` is `undefined` or `null` in the parsed PDF data, the code silently substitutes accumulated net flow — a number that can differ from the true bank balance by tens of thousands of pounds after multiple statements.

### Problem 2: `currentBalance` and `accumulated.netFlow` Are Presented Side by Side Without Hierarchy

In the API response (lines 476-600), `currentBalance` is a top-level field while `accumulated.netFlow` lives inside the `accumulated` object. But nothing structurally prevents the UI from displaying `currentBalance` and `accumulated.netFlow` interchangeably. The dashboard component (`page.tsx` line 21) destructures `currentBalance` directly — if it's wrong, the dashboard lies.

### Problem 3: `catchUpBalance` Double-Counts Transactions Already in the Statement Period

`catchUpBalance()` (in `src/lib/forecast/index.ts`, lines 50-111) takes `lastKnownBalance` (the statement closing balance) and projects forward from `lastKnownDate` to today by applying recurring transactions. But it uses `payment.lastOccurrence` as the projection start — if the last occurrence was on April 15 and the statement ended April 30, the catch-up will project transactions for April 15 through May 11, duplicating those already reflected in the April 30 closing balance.

The function has no awareness of the statement period boundary. It naively projects from the last occurrence date without checking whether the statement closing balance already includes those days.

### Problem 4: No Balance Sanity Check

The statement's `closingBalance` is never validated against `openingBalance + totalCredits - totalDebits`. A malformed PDF parse could produce a wrong closing balance that silently corrupts the entire forecast.

### Problem 5: Forecast Runs on Wrong Input When Filter Active

When a date filter is active (lines 279-291), `currentBalance` is set to the net flow of filtered transactions. `statementClosingBalance` is then set equal to `currentBalance`. The forecast then runs on this computed number. But the true bank balance after the filtered window has no relationship to the net flow of selected transactions — the opening balance before the filter window is unknown in this context.

## Recommended Data Flow

### Principle: "Current Position" and "Accumulated Performance" Are Separate Top-Level Concepts

```
                    ┌─────────────────────────────────┐
                    │         Statement Data           │
                    │  (parsed PDF → StatementData)    │
                    │                                  │
                    │  accountInfo.closingBalance      │
                    │  accountInfo.openingBalance      │
                    │  accountInfo.statementPeriod     │
                    │  transactions[]                  │
                    └──────────┬──────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
    ┌────────────▼───────────┐  ┌────────────▼───────────┐
    │   Current Position     │  │  Accumulated Performance│
    │   (from LATEST         │  │  (from ALL statements)  │
    │    statement only)     │  │                         │
    │                        │  │  totalIncome            │
    │  balance               │  │  totalExpenses          │
    │  balanceDate           │  │  netFlow                │
    │  statementPeriodEnd    │  │  statementCount         │
    │  isStale (if >30 days) │  │  dateRange              │
    │  source ("statement")  │  │                         │
    └───────────┬────────────┘  └───────────┬─────────────┘
                │                            │
                │  ┌─────────────────────────┘
                │  │  (patterns flow from accumulated
                │  │   transactions, balance flows
                │  │   from current position)
                │  │
    ┌───────────▼──▼───────────┐
    │     Balance Catch-Up     │
    │  (catchUpBalance)        │
    │                          │
    │  Input: closingBalance   │
    │  Input: periodEnd date   │
    │  Input: patterns         │
    │  Input: today            │
    │                          │
    │  Only applies patterns   │
    │  whose next occurrence   │
    │  falls AFTER periodEnd   │
    │                          │
    │  Output: projectedBalance│
    └───────────┬──────────────┘
                │
    ┌───────────▼──────────────┐
    │     Forecast Engine      │
    │  (generateForecast)      │
    │                          │
    │  Input: projectedBalance │
    │  Input: patterns         │
    │  Input: today            │
    │                          │
    │  Forecasts from today    │
    │  to end of current month │
    │  (remaining days only)   │
    └───────────┬──────────────┘
                │
    ┌───────────▼──────────────┐
    │      API Response        │
    │                          │
    │  currentPosition: {      │
    │    balance, date, source │
    │  }                       │
    │  accumulatedPerformance  │
    │  forecast: { ... }       │
    │  patterns: { ... }       │
    │  monthly: [...]          │
    └───────────┬──────────────┘
                │
    ┌───────────▼──────────────┐
    │      Dashboard UI        │
    │                          │
    │  "Bank Balance: £380.93" │
    │  "All-Time Net: -£32.8K" │
    │  (visually distinct)     │
    └──────────────────────────┘
```

### The Data Flow Contract

1. **Statement Data layer** extracts `closingBalance` from the parsed PDF. This is authoritative. If missing, the API returns an error or marks the balance as unavailable — it never falls back to a computed number.

2. **Current Position layer** is a thin pass-through: it validates the balance, records its source and date, and exposes it. It does no math.

3. **Accumulated Performance layer** computes totals across all statements. It has no concept of "current balance."

4. **Balance Catch-Up layer** takes current position as input and projects forward ONLY transactions that occur after the statement period end date. It returns a `projectedBalance` that is explicitly marked as estimated.

5. **Forecast Engine layer** takes projected balance as input and forecasts the remaining days in the current month. It does not care where the balance came from.

6. **API Response layer** separates `currentPosition`, `accumulatedPerformance`, and `forecast` into distinct top-level keys. The UI cannot accidentally use one where it meant the other.

7. **Dashboard UI layer** renders `currentPosition.balance` as "Current Bank Balance" and `accumulatedPerformance.netFlow` as "All-Time Net Flow" with distinct visual treatment.

## Component Boundaries

### Boundary 1: Statement Data Extraction (Read-Only Source)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| PDF Parser (unpdf) | Extracts raw `StatementData` including `closingBalance`, `openingBalance`, `statementPeriod`, `transactions[]` | Document storage layer |
| Balance Validator (NEW) | Verifies `closingBalance === openingBalance + totalCredits - totalDebits` within tolerance | Statement Data layer |

**Contract:** `StatementData.accountInfo.closingBalance` is the authoritative balance number. If missing or invalid, the API must either (a) surface the parse error or (b) mark the balance as `null` with `source: "unavailable"`.

### Boundary 2: Current Position (Derived from Latest Statement)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `extractCurrentPosition()` (NEW) | Takes latest statement, returns `CurrentPosition` with balance, date, source, staleness flag | Balance Validator, API Response |
| `CurrentPosition` type (NEW) | `{ balance: number; date: string; statementPeriodEnd: string; source: "statement" \| "unavailable"; isStale: boolean }` | All downstream consumers |

**Contract:** `CurrentPosition` is always derived from the latest statement's `closingBalance`. It never falls back to computed values. If the latest statement has no closing balance, `balance` is `null` and `source` is `"unavailable"`.

### Boundary 3: Accumulated Performance (Derived from All Statements)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `computeAccumulatedPerformance()` (EXISTING, refactored) | Aggregates totals across all statements: totalIncome, totalExpenses, netFlow, dateRange | API Response, Monthly Summaries |
| `AccumulatedPerformance` type (NEW) | `{ totalIncome: number; totalExpenses: number; netFlow: number; statementCount: number; firstTransactionDate: string; lastTransactionDate: string }` | UI, Cross-Month Learning |

**Contract:** `AccumulatedPerformance` never feeds into `CurrentPosition` or forecast balance calculations. It is a retrospective metric only.

### Boundary 4: Balance Catch-Up (Projection from Statement to Today)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `catchUpBalance()` (REFACTORED) | Projects from `statementPeriodEnd` to today using only patterns whose occurrences fall after `statementPeriodEnd` | Current Position, Pattern Detection, Forecast Engine |

**Contract change:** The current signature is:
```typescript
catchUpBalance(patterns, lastKnownBalance, lastKnownDate, today?)
```

The refactored signature must add the statement period end date so it can filter out already-applied transactions:
```typescript
catchUpBalance(patterns, lastKnownBalance, lastKnownDate, statementPeriodEnd, today?)
```

The function must only project occurrences where `nextExpected > statementPeriodEnd` and `nextExpected <= today`. Transactions that occurred within the statement period are already reflected in `closingBalance` and must not be applied again.

### Boundary 5: Forecast Engine (Projection from Today to Month-End)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `generateForecast()` (REFACTORED) | Takes projected balance, forecast remaining days in current month | Balance Catch-Up, Daily Forecaster, Status Calculator, Risk Detector |
| `generateDailyForecast()` (MINOR REFACTOR) | Generates day-by-day projection from today to month-end | Forecast Engine |
| `calculateStatus()` (UNCHANGED) | Determines safe/watch/risk/critical | Forecast Engine |
| `detectRisks()` (UNCHANGED) | Detects specific risk scenarios | Forecast Engine |

**Contract:** `generateForecast` receives `currentBalance` as its starting point. It does not care whether the balance is from a statement or a catch-up projection. It only needs a number and today's date. The function is already correct in this regard; the fix is upstream.

### Boundary 6: API Response (Serialization Layer)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `GET /api/documents/aggregate` (REFACTORED) | Orchestrates all boundaries, returns structured response | All boundaries, Dashboard UI, Forecast Page |

**Contract:** The response must separate these into top-level keys:

```typescript
{
  currentPosition: {           // NEW: replaces top-level currentBalance
    balance: number | null,
    date: string,
    source: "statement" | "catchUp" | "unavailable",
    isEstimated: boolean,
    isStale: boolean,
    statementPeriodEnd: string
  },
  accumulatedPerformance: {   // EXISTING: refactored
    totalIncome: number,
    totalExpenses: number,
    netFlow: number,
    statementCount: number,
    dateRange: { from: string, to: string } | null
  },
  forecast: { ... },          // EXISTING: starts from currentPosition.balance
  monthly: [...],             // EXISTING
  categories: [...],          // EXISTING
  patterns: { ... },          // EXISTING
  // ... other fields
}
```

The key change: `currentBalance` as a flat top-level number disappears. It is replaced by a `currentPosition` object that carries metadata about its source. `accumulatedPerformance` gains its own top-level key (currently nested under `accumulated`).

### Boundary 7: Dashboard UI (Presentation Layer)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `DashboardPage` (REFACTORED) | Consumes `currentPosition` and `accumulatedPerformance` separately | `/api/documents/aggregate` |
| `CurrentPositionCard` (NEW or REFACTORED) | Displays current bank balance with source metadata | Dashboard |
| `AccumulatedStats` (REFACTORED) | Displays all-time accumulated metrics | Dashboard |

**Contract:** The dashboard must visually distinguish "what the bank says" (current position) from "what you've done over time" (accumulated performance). The two numbers must never appear in the same card or be presented as interchangeable.

## API Response Structure (Recommended)

```typescript
// Before (current): flat, ambiguous
{
  currentBalance: -32822.66,           // Ambiguous: is this bank balance or accumulated?
  statementClosingBalance: 380.93,     // Buried; only used to compute the above
  lastStatementDate: "2026-04-30",
  accumulated: { netFlow: -32822.66 }, // Duplicates the buggy currentBalance
  forecast: { currentBalance: -32822.66 } // Propagates the bug
}

// After (recommended): separated, unambiguous
{
  currentPosition: {
    balance: 380.93,
    date: "2026-04-30",
    source: "statement",           // "statement" | "catchUp" | "unavailable"
    isEstimated: false,
    isStale: false,                // true if >30 days since statement end
    statementPeriodEnd: "2026-04-30",
    catchUpBalance: 410.50,        // only present if source="catchUp"
    catchUpDays: 11                // only present if source="catchUp"
  },
  accumulatedPerformance: {
    totalIncome: 45000.00,
    totalExpenses: 77822.66,
    netFlow: -32822.66,
    statementCount: 3,
    dateRange: { from: "2025-09-01", to: "2026-04-30" }
  },
  forecast: {
    startingBalance: 380.93,       // Always == currentPosition.balance
    predictedMonthEnd: 250.00,
    remainingIncome: 1200.00,
    remainingExpenses: 1330.93,
    status: "watch",
    statusReason: "...",
    dailyForecast: [...],
    // ...
  }
}
```

The critical property: `forecast.startingBalance` is always strictly equal to `currentPosition.balance`. If they differ, the data flow is broken. This invariant can be asserted in the route handler.

## Fix Order

The fixes must be applied in dependency order. Later fixes depend on earlier ones being correct.

### Fix 1: Balance Extraction (BAL-01, BAL-02, BAL-04) -- NO DEPENDENCIES

**What:** Extract `closingBalance` from the latest statement unconditionally. Add a balance validator that checks `closingBalance === openingBalance + totalCredits - totalDebits` (within a tolerance of 1p for rounding). Remove the `??` fallback to accumulated net flow. If `closingBalance` is missing, return `null` with `source: "unavailable"`.

**Files:** `src/app/api/documents/aggregate/route.ts` (lines 266-304)
**Why first:** Everything downstream depends on a correct balance. Until this is fixed, forecast and UI fixes are cosmetic.

### Fix 2: API Response Restructuring (BAL-03, BAL-05) -- DEPENDS ON FIX 1

**What:** Replace the flat `currentBalance` / `statementClosingBalance` / `balanceIsEstimated` fields with a nested `currentPosition` object. Move `accumulated` to `accumulatedPerformance`. Ensure `forecast.startingBalance === currentPosition.balance`.

**Files:** `src/app/api/documents/aggregate/route.ts` (lines 475-600), `src/types/index.ts` (add `CurrentPosition` and `AccumulatedPerformance` types)
**Why second:** The new response shape must exist before the UI can consume it.

### Fix 3: catchUpBalance De-Duplication (FOR-01, FOR-02) -- DEPENDS ON FIX 1

**What:** Add `statementPeriodEnd` parameter to `catchUpBalance()`. Only project occurrences where `nextExpected > statementPeriodEnd`. The current logic projects from `lastOccurrence` without checking whether the gap between `lastOccurrence` and `statementEnd` already includes transactions baked into the closing balance.

**Files:** `src/lib/forecast/index.ts` (lines 50-111)
**Why third:** Fix 1 gives the correct balance. Fix 3 ensures the catch-up doesn't corrupt it before it reaches the forecast.

### Fix 4: generateForecast Refinement (FOR-03, FOR-05, FOR-07) -- DEPENDS ON FIX 3

**What:** Ensure `generateForecast` starts from `projectedBalance` (output of corrected `catchUpBalance`). Ensure it forecasts only from today to month-end (not from statement date). Add deduplication: check if a recurring transaction's `nextExpected` date has already passed in the current month before adding it to the forecast.

**Files:** `src/lib/forecast/index.ts` (lines 113-166), `src/lib/forecast/daily-forecaster.ts`
**Why fourth:** The forecast is only meaningful when it starts from the correct balance.

### Fix 5: Dashboard UI Update (DASHBOARD CONSUMPTION) -- DEPENDS ON FIX 2

**What:** Update `page.tsx` to destructure `currentPosition` and `accumulatedPerformance` separately. Display `currentPosition.balance` as the hero metric ("Current Bank Balance") and `accumulatedPerformance.netFlow` as a secondary metric ("All-Time Net Flow"). Show source metadata (e.g., "As of 30 Apr 2026" with a badge indicating if the balance is estimated or stale).

**Files:** `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/accumulated-stats.tsx`
**Why last:** The UI is the presentation layer. It can only be correct when the data flowing into it is correct.

### Fix 6: Date Filter Behavior (DATE FILTER) -- DEPENDS ON FIX 1

**What:** When a date filter is active, `currentPosition` should still reflect the latest statement closing balance (the bank balance is what it is regardless of filter). The filter should only affect `accumulatedPerformance` (which is scoped to the filtered window) and `monthly` (filtered to matching months). The forecast should be disabled or explicitly marked as "not meaningful with active filter" since the starting balance doesn't match the filtered window.

**Files:** `src/app/api/documents/aggregate/route.ts` (lines 279-305, 316-364)
**Why last:** This is the most nuanced change and depends on all the structural fixes being in place.

## Scalability Considerations

| Concern | Current (100s of transactions) | After 12+ statements (thousands) |
|---------|-------------------------------|----------------------------------|
| Balance extraction | O(1) — reads single statement | O(1) — unchanged |
| Accumulated computation | O(n) — aggregate all transactions | O(n) — acceptable; could memoize per-statement totals |
| Pattern detection | O(n) — group by merchant, sort each group | O(n log n) — each group sorted by date; acceptable for thousands |
| catchUpBalance | O(p) where p = pattern count | O(p) — <100 patterns; trivial |
| generateForecast | O(d * p) where d = days remaining | O(d * p) — ~30 * <100 = <3000 operations; trivial |
| API response size | ~50KB with all fields | Would grow with transaction count if all transactions included; already paginated via categories and patterns |

The architecture does not have a scalability bottleneck for the expected data volume (business owners with 3-24 monthly statements, each with 50-500 transactions).

## Patterns to Follow

### Pattern 1: Single Source of Truth for Balance

**What:** The latest statement's `closingBalance` is the only number treated as "the bank balance." All other balance-like numbers are explicitly derived and labeled.

**Implementation:**
```typescript
function extractCurrentPosition(docs: DocumentRecord[]): CurrentPosition {
  const latest = findLatestByStatementPeriod(docs);
  const stmt = latest.statement_data as StatementData;

  if (!stmt?.accountInfo?.closingBalance) {
    return { balance: null, date: "", source: "unavailable", isEstimated: false, isStale: false, statementPeriodEnd: "" };
  }

  const validated = validateBalance(stmt); // checks closing = opening + credits - debits

  return {
    balance: stmt.accountInfo.closingBalance,
    date: stmt.accountInfo.statementPeriod?.to ?? "",
    source: validated ? "statement" : "statement", // still statement, but log warning if validation fails
    isEstimated: false,
    isStale: isStale(stmt.accountInfo.statementPeriod?.to),
    statementPeriodEnd: stmt.accountInfo.statementPeriod?.to ?? ""
  };
}
```

### Pattern 2: Type-Level Separation of Concepts

**What:** `CurrentPosition` and `AccumulatedPerformance` are separate TypeScript types with no overlapping fields. The compiler prevents accidental interchange.

**Implementation:**
```typescript
// These must NOT share fields that could be confused
interface CurrentPosition {
  balance: number | null;
  date: string;
  source: "statement" | "catchUp" | "unavailable";
  isEstimated: boolean;
  isStale: boolean;
  statementPeriodEnd: string;
  catchUpBalance?: number;
  catchUpDays?: number;
}

interface AccumulatedPerformance {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  statementCount: number;
  dateRange: { from: string; to: string } | null;
}
```

### Pattern 3: Invariant Assertion at the API Boundary

**What:** Before returning the response, assert that `forecast.startingBalance === currentPosition.balance`. If these diverge, something upstream is broken.

**Implementation:**
```typescript
if (forecast.currentBalance !== currentPosition.balance) {
  console.error(
    `INVARIANT BROKEN: forecast.currentBalance (${forecast.currentBalance}) != currentPosition.balance (${currentPosition.balance})`
  );
  // Return 500 or reconcile
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Silent Fallback from Authoritative to Computed

**What:** Using `??` to fall back from `closingBalance` (bank-authoritative) to `accumulated net flow` (app-computed).

**Why bad:** The two numbers represent fundamentally different things. The bank's closing balance at statement end is the ground truth. Accumulated net flow is a derived metric that loses the opening balance context. They can differ by tens of thousands of pounds.

**Instead:** If `closingBalance` is unavailable, return `null` with `source: "unavailable"` and let the UI handle the missing data state.

### Anti-Pattern 2: catchUpBalance Without Statement Period Awareness

**What:** `catchUpBalance` projects from `lastOccurrence` date without checking whether the statement period already covered those days.

**Why bad:** If a recurring payment's last occurrence was on April 15 and the statement ended April 30, projecting forward from April 15 applies transactions from April 15-30 that are already reflected in the closing balance. This causes double-counting.

**Instead:** Only project occurrences where `nextExpected > statementPeriodEnd`. The statement closing balance already includes everything up to the period end date.

### Anti-Pattern 3: Flat API Response with Ambiguous Field Names

**What:** `currentBalance` as a top-level number with no metadata about its source.

**Why bad:** Consumers (UI, forecast, other API routes) cannot know whether the number is a bank balance, a catch-up projection, or an accumulated computation. They treat it as authoritative regardless.

**Instead:** Nest balance inside a `currentPosition` object with explicit `source` and `isEstimated` fields.

## Sources

- Source code analysis: `src/app/api/documents/aggregate/route.ts` (lines 266-304, balance computation)
- Source code analysis: `src/lib/forecast/index.ts` (lines 50-111, catchUpBalance; lines 113-166, generateForecast)
- Source code analysis: `src/lib/forecast/daily-forecaster.ts` (daily forecast generation)
- Source code analysis: `src/types/index.ts` (type definitions showing no CurrentPosition separation)
- Project requirements: `.planning/PROJECT.md` (BAL-01 through BAL-05, FOR-01 through FOR-05)
- Dashboard consumption: `src/app/(app)/dashboard/page.tsx` (line 21, destructures currentBalance directly)
