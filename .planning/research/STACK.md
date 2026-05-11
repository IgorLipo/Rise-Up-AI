# Stack Research: Cashflow Forecasting Fix

**Project:** Cashflow Intelligence App
**Researched:** 2026-05-11
**Overall confidence:** HIGH
**Stack context:** Existing Next.js 16.2 App Router, TypeScript, Supabase, Recharts v3.8.1, date-fns v4.1.0, AI SDK (DeepSeek v4 Flash + Claude Sonnet 4.6), deployed on Vercel.

This is NOT a greenfield stack recommendation. The existing stack is locked. This document recommends patterns and algorithmic improvements within the existing codebase to fix the identified bugs.

---

## Financial Calculation Patterns

### 1. Integer Pence Arithmetic (No New Library)

**What it is:** Perform all financial arithmetic in integer pence (multiply GBP amounts by 100, operate on integers, divide by 100 only for display).

**Rationale:** JavaScript's `Number` is IEEE 754 floating-point. For GBP (2 decimal places), integer pence avoids all precision errors. No new dependency needed. The existing codebase already uses `Intl.NumberFormat("en-GB")` for display formatting in some places (`risk-detector.ts`, `status-calculator.ts`).

**Implementation pattern (zero-dependency):**

```typescript
// Conversion helpers — add to src/lib/financial/math.ts
export function toPence(pounds: number): number {
  return Math.round(pounds * 100);
}

export function fromPence(pence: number): number {
  return pence / 100;
}

// All balance math:
// Instead of: balance += tx.amount - expense.amount
// Use:       balancePence += toPence(tx.amount) - toPence(expense.amount)
// Then:      displayBalance = fromPence(balancePence)
```

**Where this matters most:**
- `catchUpBalance()` in `src/lib/forecast/index.ts` — iteratively adds/subtracts amounts across many loop iterations. Floating-point drift compounds here.
- `generateDailyForecast()` in `src/lib/forecast/daily-forecaster.ts` — same loop-based accumulation.
- `accumulatedNetFlow` computation in `src/app/api/documents/aggregate/route.ts` — sums across all transactions.

**Confidence:** HIGH. Integer pence is the standard pattern for GBP-denominated financial calculations. The `Number.MAX_SAFE_INTEGER` is ~9 quadrillion in pence (~90 trillion GBP), which is far beyond the scope of business cashflow.

### 2. Balance Validation Check

**Pattern:** Verify that `closing_balance == opening_balance + paid_in - withdrawn` for every parsed statement. This catches parsing errors before they corrupt downstream calculations.

**Implementation:** Add a validation pass after PDF parsing in the upload pipeline:

```typescript
function validateStatementBalance(stmt: StatementData): BalanceValidation {
  const totalIn = stmt.transactions
    .filter(t => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = stmt.transactions
    .filter(t => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);
  const calculatedClosing = (stmt.accountInfo?.openingBalance ?? 0) + totalIn - totalOut;
  const reportedClosing = stmt.accountInfo?.closingBalance ?? 0;
  const discrepancy = Math.abs(calculatedClosing - reportedClosing);

  return {
    isValid: discrepancy < 0.02, // 2p tolerance for rounding
    discrepancy,
    calculatedClosing,
    reportedClosing,
  };
}
```

**Confidence:** HIGH. Standard accounting validation. Catches the class of bug where parsing misses transactions or misreads amounts.

### 3. Separate "Position" from "Performance"

**Core fix for BAL-05:** Maintain two distinct concepts throughout the codebase:

| Concept | Source | Meaning |
|---------|--------|---------|
| `currentCashPosition` | Latest statement `closing_balance` | What the bank says you have RIGHT NOW |
| `accumulatedPerformance` | Sum of all `netFlow` across all statements | How the business performed over time |

**Never add these together, never confuse them, never derive one from the other.**

**Implementation:** In `src/app/api/documents/aggregate/route.ts`, the response already has both `currentBalance` and `accumulated.netFlow` but the `currentBalance` derivation is buggy (line 279-304). Fix by:

1. `currentBalance` ALWAYS = latest statement `closing_balance` (not catchUp projection when date filter active)
2. `accumulatedNetFlow` = sum of all statement net flows (keep existing calculation)
3. Add `balanceSource: "statement" | "projected" | "stale"` metadata so the UI can display appropriately

**Confidence:** HIGH. This is the root cause of the app's core bug. Explicit in PROJECT.md requirements.

---

## Recurring Pattern Detection

### 1. Day-of-Month Pattern Analysis (Enhance Existing Pattern Detector)

**What it is:** For transactions classified as monthly, analyze whether they cluster around a specific day of the month (e.g., "around the 5th") rather than just having ~30-day average gaps.

**Why it's needed:** The current `pattern-detector.ts` uses average gap between occurrences to determine `nextExpected`. For a monthly transaction that happens on the 1st, then the 30th, then the 1st again, the average gap might be 15 days, producing a wildly wrong `nextExpected`. Day-of-month analysis fixes this.

**Implementation pattern (enhance `src/lib/detection/pattern-detector.ts`):**

```typescript
import { getDate } from "date-fns"; // already in project

interface DayOfMonthAnalysis {
  typicalDay: number | null;       // mode day-of-month, null if no pattern
  dayVariance: number;             // max deviation from typical day
  isEndOfMonth: boolean;           // true if occurrences cluster at days 28-31
}

function analyzeDayOfMonth(dates: string[]): DayOfMonthAnalysis {
  const days = dates.map(d => getDate(new Date(d)));

  // End-of-month detection: if all days are >= 28, treat as "end of month"
  if (days.every(d => d >= 28)) {
    return { typicalDay: 31, dayVariance: stddev(days), isEndOfMonth: true };
  }

  // Cluster days with max 4-day gap tolerance
  const sorted = [...days].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[last.length - 1] <= 4) {
      last.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  const bestCluster = clusters.sort((a, b) => b.length - a.length)[0];
  const typicalDay = Math.round(bestCluster.reduce((s, v) => s + v, 0) / bestCluster.length);
  const dayVariance = stddev(bestCluster);

  return { typicalDay, dayVariance, isEndOfMonth: false };
}
```

**How `nextExpected` changes:** Instead of `addDays(lastOccurrence, avgGap)`, compute `nextExpected` by advancing to the next month and setting the day to `typicalDay`:

```typescript
function projectMonthlyNextExpected(lastDate: string, typicalDay: number): string {
  const d = new Date(lastDate);
  // Advance to next month, set to typical day
  d.setMonth(d.getMonth() + 1);
  d.setDate(Math.min(typicalDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  // If projected date is before today, advance another month
  const today = new Date().toISOString().split("T")[0];
  if (d.toISOString().split("T")[0] <= today) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(typicalDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d.toISOString().split("T")[0];
}
```

**Confidence:** HIGH. Day-of-month clustering is the standard approach for monthly recurring transaction detection. The existing code's average-gap method is known to produce wrong projections when day-of-month varies within the 27-31 day window.

### 2. Same-Month Deduplication

**What it is:** Before forecasting a recurring transaction, check if it already occurred in the current calendar month. If yes, do not include it in the forecast for the remainder of the month.

**Why it's needed:** The current `generateDailyForecast()` blindly adds all `nextExpected` dates through month-end. If "Virgin Media" already hit the account on May 3rd, it should not be forecast again for May.

**Implementation pattern:**

```typescript
function hasAlreadyOccurredThisMonth(
  occurrences: { date: string; amount: number }[],
  referenceDate: string
): boolean {
  const refMonth = referenceDate.slice(0, 7); // "2026-05"
  return occurrences.some(o => o.date.slice(0, 7) === refMonth);
}
```

This check goes in `generateDailyForecast()` before adding each pattern to the day map. Only add if `!hasAlreadyOccurredThisMonth(pattern.occurrences, today)`.

**Confidence:** HIGH. Explicitly required by FOR-07. Prevents double-counting, which produces the "random large negative balances" described in the project brief.

### 3. Confidence Tiers for Recurring Classification

**What it is:** Three-tier confidence system for how certain we are that a transaction is truly recurring.

| Tier | Criteria | Forecast Treatment |
|------|----------|-------------------|
| **HIGH** | 4+ occurrences across 4+ distinct months, amount CV < 0.15, interval consistent, day-of-month variance <= 3 | Include in main forecast |
| **MEDIUM** | 2-3 occurrences across 2+ months, some amount/date variance | Show as "possible" / include in confidence-weighted forecast |
| **LOW** | 2 occurrences, 1 month, or high variance | Exclude from forecast; flag for review |

**Implementation pattern (enhance `scoreConfidence` in `src/lib/detection/pattern-detector.ts`):**

```typescript
function scoreConfidenceMultiFactor(
  occurrenceCount: number,
  uniqueMonths: number,
  amountCV: number,
  intervalConsistency: number,
  dayOfMonthVariance: number
): { overall: number; tier: "high" | "medium" | "low" } {
  // Independent factor scores (0-1)
  const countScore = Math.min(1, occurrenceCount / 6);          // 6+ = full credit
  const monthScore = Math.min(1, uniqueMonths / 4);              // 4+ months = full credit
  const amountScore = amountCV < 0.05 ? 1 : amountCV < 0.15 ? 0.7 : amountCV < 0.3 ? 0.4 : 0;
  const intervalScore = Math.max(0, intervalConsistency);         // already 0-1
  const dayScore = dayOfMonthVariance <= 1 ? 1 : dayOfMonthVariance <= 3 ? 0.7 : dayOfMonthVariance <= 7 ? 0.4 : 0;

  // Weighted composite (weights tuned for cashflow use case)
  const overall =
    countScore * 0.30 +       // occurrence count is strongest signal
    monthScore * 0.25 +       // temporal spread confirms pattern
    amountScore * 0.20 +      // stable amounts = reliable prediction
    intervalScore * 0.15 +
    dayScore * 0.10;

  const tier = overall >= 0.65 ? "high" : overall >= 0.40 ? "medium" : "low";
  return { overall, tier };
}
```

**Confidence:** HIGH. Multi-factor scoring with configurable weights is the established pattern (confirmed by decision-os project research). The existing single-score approach in `pattern-detector.ts` is too coarse to prevent low-confidence items from polluting the forecast.

---

## Forecast Engine Patterns

### 1. Forecast Always Starts from Actual Statement Balance

**Core fix for FOR-01:** The forecast's starting point must be the latest statement's `closing_balance`, never accumulated net flow.

**Implementation:** In `src/app/api/documents/aggregate/route.ts`, the forecast is called as `generateForecast(displayPatterns, currentBalance)`. The fix is ensuring `currentBalance` is always `statementClosingBalance` (line 298). When no date filter is active, the existing logic already does this correctly (line 298-301). When a date filter IS active, the current code (line 279-291) incorrectly sets `currentBalance` to accumulated net flow. Fix by keeping `currentBalance = statementClosingBalance` in both branches.

**Confidence:** HIGH. This is the root cause bug.

### 2. Catch-Up Window Logic (Fix Existing, Don't Replace)

**What stays:** `catchUpBalance()` in `src/lib/forecast/index.ts` has the right structure — start from last known balance, project forward applying recurring transactions. The `MAX_CATCHUP_DAYS = 30` limit is correct (lines 48, 71-79).

**What changes:**
1. The catch-up loop (lines 84-101) must use day-of-month anchored projections instead of `addDays(lastOccurrence, gap)`. See section "Day-of-Month Pattern Analysis" above.
2. The loop must check `hasAlreadyOccurredThisMonth()` for each recurring payment before applying it during catch-up.
3. The catch-up should use integer pence arithmetic throughout to avoid floating-point drift across iterations.

**Confidence:** HIGH. The structure is correct; the projection math is wrong.

### 3. Completed vs Expected vs Late Classification

**What it is:** Each transaction in the forecast should be tagged with one of four statuses:

| Status | Meaning | Example |
|--------|---------|---------|
| **Completed** | Actually observed in current month's transactions | Rent paid May 1 |
| **Expected** | Recurring pattern says it should happen, not yet seen | Virgin Media expected May 15 |
| **Late/Missing** | Expected date has passed, not yet seen | Council tax expected May 5, now May 11 |
| **Uncertain** | Medium-confidence pattern, may or may not happen | Occasional supplier payment |

**Implementation:** Add a `status` field to `ExpectedTransaction` in `src/lib/forecast/daily-forecaster.ts`:

```typescript
export interface ExpectedTransaction {
  // ... existing fields
  status: "completed" | "expected" | "late" | "uncertain";
  matchedTransactionId?: string; // links to actual transaction if completed
}
```

In `generateDailyForecast()`, when building the day map:
- Check if the recurring payment has an actual transaction in the current month's data. If yes, tag as `completed` for the day it actually occurred.
- If `nextExpected` is before today and no match exists, tag as `late`.
- If confidence tier is MEDIUM, tag as `uncertain`.
- Otherwise, tag as `expected`.

**Confidence:** HIGH. Required by FOR-08. Provides actionable information to the user rather than just a number.

---

## Categorization

### 1. Keyword Enhancement (Fix the Existing Classifier, Don't Replace It)

**What it is:** Add specific vendor keywords to the existing `SUBCATEGORY_KEYWORDS` map in `src/lib/detection/subcategory-classifier.ts`. No architectural change needed — the classifier is correctly structured as a priority-ordered keyword matcher.

**Specific additions required by CAT-01 through CAT-04:**

```typescript
// In SUBCATEGORY_KEYWORDS:

taxes: [
  // ... existing ...
  /council tax|city council|borough council/i,   // already present
  /leicester city council|leicester council/i,    // NEW — matches specific council
],

"car-expenses": [
  // ... existing ...
  /\bshell\b|\bbp\b|tesco pay at pump|asda petrol|asda fuel|sainsbury.?s petrol|sainsbury.?s fuel|mfg\b|esso\b|texaco\b|jet\b|gulf\b|morrisons petrol|morrisons fuel/i,  // NEW — fuel vendors
],

subscriptions: [
  // ... existing ...
  /apple\.com\/bill|itunes\.com|amazon prime|prime video|spotify|puregym|the gym group|openai|chatgpt|monday\.com|gamma|pdfleader|01\.ai|canva|dropbox|notion|linear|figma/i,  // ENHANCED — subscription services
],

"property-management": [
  // ... existing ...
  /amha leicester|green acres estate|haus property|midlands property|sequoia property|osiris property|online estate agent|nasim holdings/i,  // ENHANCED — specific property vendors
],
```

**Confidence:** HIGH. The existing classifier structure is sound. The bugs are purely missing keywords. No new library or pattern needed.

### 2. Vendor Intelligence Hierarchy

**Pattern:** When determining a transaction's category, check sources in priority order:

1. **User annotations** (`annotations` table, `source = "user"`) — always authoritative, confidence 1.0
2. **Vendor intel learning** (`vendor_intel` table, multi-month cross-referenced) — confidence from recurrence history
3. **AI classification** (DeepSeek/Claude) — for ambiguous or new vendors
4. **Keyword fallback** (`subcategory-classifier.ts`) — instant, deterministic

**The existing `src/app/api/documents/aggregate/route.ts` already implements this hierarchy (lines 229-241 for annotations, 213-225 for vendor intel, 244 for AI).** This pattern is correct and should be preserved. The only gap is that the keyword fallback in step 4 is missing the specific vendors listed above.

**Confidence:** HIGH. The existing architecture is correct. Only the data (keywords) is wrong.

---

## Suspicious Detection Fix

### 1. Whitelist Before Blacklist

**What it is:** Before checking if a transaction matches personal/suspicious patterns, check if the vendor is known to be a legitimate business expense (property management, rent, council tax, supplier payments).

**Why it's needed:** The current `suspicious-detector.ts` checks `PERSONAL_PATTERNS` first (line 117). If any regex matches, it flags the transaction as suspicious without considering that the same vendor might be a legitimate business category. "Tranquil Accommodation" income getting flagged as fast food is the specific example from SUS-03.

**Implementation pattern:**

```typescript
// Add BEFORE the PERSONAL_PATTERNS check in detectSuspicious()

const BUSINESS_WHITELIST = [
  /property|estate|letting|accommodation|rent|housing|management/i,
  /council|tax|hmrc|vat|hm revenue/i,
  /insurance|liability|indemnity/i,
  /utilities|energy|electric|gas|water|broadband/i,
  /invoice|supplier|wholesale|distributor/i,
  /salary|wage|payroll|staff/i,
  /loan|repayment|bounce back|cbils|funding circle/i,
];

function isKnownBusinessExpense(description: string, subcategory: string): boolean {
  // Check explicit business categories first
  const businessCategories = ["property-management", "rent", "taxes", "utilities", "insurance", "supplier-payments", "salary", "loans"];
  if (businessCategories.includes(subcategory)) return true;

  // Then check whitelist patterns
  return BUSINESS_WHITELIST.some(p => p.test(description));
}

// In detectSuspicious(), before PERSONAL_PATTERNS check:
// 1. Check if we have a subcategory classification for this vendor
// 2. If yes and it's a business category, skip all personal checks
if (isKnownBusinessExpense(desc, /* pass subcategory from learning */)) {
  return null;
}
```

**Confidence:** HIGH. This is the standard "allowlist before denylist" security pattern. The existing code has the allowlist in `subcategory-classifier.ts` but the `suspicious-detector.ts` doesn't consult it before running its patterns.

### 2. Context-Aware Detection (Direction, Amount, Vendor Type)

**What it is:** Consider the full context of a transaction — is it income or expense? Large or small? What vendor category? — before flagging it.

**Implementation:** Extend `detectSuspicious()` to accept metadata beyond just the transaction description:

```typescript
interface SuspiciousCheckContext {
  transaction: Transaction;
  subcategory?: string;
  isRecurring: boolean;
  monthsSeen: number;
  typicalAmount: number;
}

export function detectSuspicious(ctx: SuspiciousCheckContext): SuspiciousTransaction | null {
  // Income transactions from known business sources are never suspicious
  if (ctx.transaction.type === "credit" && ctx.subcategory) {
    const businessIncomeCategories = ["salary", "rent", "property-management", "supplier-payments"];
    if (businessIncomeCategories.includes(ctx.subcategory)) return null;
  }

  // Large recurring transactions with stable amounts are unlikely to be personal
  if (ctx.isRecurring && ctx.monthsSeen >= 3 && ctx.transaction.amount > 200) {
    return null; // business recurring expense, not personal
  }

  // ... then run PERSONAL_PATTERNS checks
}
```

**Confidence:** HIGH. Required by SUS-02. The current detector only looks at description text, missing the additional signals that would prevent false positives.

---

## What NOT To Do

### 1. Do NOT Add a New Financial Library

`currency.js`, `decimal.js`, `money-ts`, and similar libraries are well-designed but unnecessary for this codebase. GBP has exactly 2 decimal places, making integer pence trivial and zero-dependency. Introducing a library adds a dependency, learning curve, and conversion burden for no benefit in this specific case.

### 2. Do NOT Replace the Pattern Detector

The existing `pattern-detector.ts` has the right structure (group by merchant, compute intervals, classify recurrence). It needs enhancement (day-of-month analysis, multi-factor confidence), not replacement. A rewrite would risk introducing new bugs in a core pipeline.

### 3. Do NOT Use RRule or Scheduling Libraries

Libraries like `rrule` (iCalendar RFC) are for *generating* occurrences from known rules. They are not for *detecting* patterns from raw transaction data. The "detect first, then project" approach in the existing code is correct.

### 4. Do NOT Derive Balance from Accumulated Net Flow

This is the cardinal sin of the current codebase. The bank statement's `closing_balance` is the source of truth. Accumulated net flow is a derived performance metric. They are different concepts and must stay separate in all code paths, API responses, and UI displays.

### 5. Do NOT Mix Date-Filtered and Unfiltered Data

The current aggregate route uses `allTransactions` for learning/suspicious detection but `workingTransactions` (filtered) for balance computation. This is fragile. When a date filter is active and balance is incorrectly computed as accumulated net flow, nothing downstream catches it. Fix: always compute `currentBalance` from the same source (latest statement closing), regardless of date filter.

### 6. Do NOT Use Floating-Point in Accumulation Loops

The `catchUpBalance()` and `generateDailyForecast()` functions iterate and accumulate across many days. Each `+=` or `-=` with floating-point numbers introduces a small error. Over 30+ iterations, this can produce visible discrepancies. Use integer pence in these loops specifically.

### 7. Do NOT Show LOW-Confidence Items in the Main Forecast

Low-confidence (less than 3 occurrences, high variance, irregular intervals) recurring patterns should be excluded from the forecast by default. They can be shown in a separate "possible patterns" section or review queue. Currently all patterns regardless of confidence are included, which produces the "random large negative balances" reported by users.

---

## Summary of Changes per File

| File | Change | Why |
|------|--------|-----|
| `src/lib/forecast/index.ts` | Fix `catchUpBalance` to use day-of-month projection; use integer pence; add same-month dedup check | FOR-01, FOR-02, BAL-01 |
| `src/lib/forecast/daily-forecaster.ts` | Add `hasAlreadyOccurredThisMonth` check; add status tags (Completed/Expected/Late); filter by confidence tier | FOR-07, FOR-08, FOR-03 |
| `src/lib/detection/pattern-detector.ts` | Add `analyzeDayOfMonth()`; add `projectMonthlyNextExpected()`; replace single-score with multi-factor confidence | FOR-06, FOR-09 |
| `src/lib/detection/suspicious-detector.ts` | Add business whitelist; add context-aware checks (direction, amount, recurrence); check subcategory before flagging | SUS-01, SUS-02, SUS-03 |
| `src/lib/detection/subcategory-classifier.ts` | Add missing vendor keywords (fuel, subscriptions, property, council) | CAT-01 through CAT-04 |
| `src/app/api/documents/aggregate/route.ts` | Fix `currentBalance` to always use `statementClosingBalance`; add `balanceSource` metadata; separate position from performance | BAL-01 through BAL-05 |
| `src/lib/financial/math.ts` | NEW — `toPence()` / `fromPence()` helpers, `validateStatementBalance()` | Decimal precision |

---

## Sources

- Existing codebase analysis at `/Users/igorlipovetsky/bank-statements-reader/src/`
- date-fns v4.1.0 API (already in project dependencies)
- Multi-factor confidence scoring patterns from `decision-os` project (TypeScript decision engine)
- Integer pence pattern: standard JavaScript financial calculation approach confirmed across multiple sources (currency.js, subunit-money, financial-number library internals)
