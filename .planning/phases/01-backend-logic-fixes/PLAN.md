# Phase 1 Plan: Backend Logic Fixes

> **For agentic workers:** Execute tasks in strict numerical order. Each task's dependency column lists prerequisite tasks. Verify each task before proceeding.

**Goal:** Fix the core data pipeline so the app answers "how will this month end?" correctly, starting from the latest statement's actual closing balance.

**Architecture:** 9-step dependency chain. Steps 1-2 are independent (do in parallel). Steps 3-9 have strict ordering. All financial math uses integer pence arithmetic. The API response separates `currentPosition` (bank-verified) from `accumulatedPerformance` (computed across all statements).

**Key Principle:** Never let a computed number masquerade as a bank-verified number. `closingBalance` from the parsed statement is authoritative. If unavailable, return `null` — never substitute.

**Deferred to Phase 1b:** FOR-04 Mode A (completed month detection) and Mode C (future month on request). These require aggregate route logic to compute `isMonthComplete` based on statement coverage and a future-month parameter in `generateForecast()`. Phase 1 delivers Mode B (current partial month forecast) which is the core use case. Mode A tracking (`isMonthComplete`) is hardcoded to `false` in Task 7 with a comment pointing to the deferred implementation location.

---

### Task 1: Financial Math Utilities (BAL-04 prep)
**Depends on:** Nothing
**Files:**
- Create: `src/lib/financial/math.ts`

<read_first>
Integer pence arithmetic is required for all financial calculations to prevent floating-point drift. All internal computation must be in pence (integers). Conversion happens only at display time.
</read_first>

<acceptance_criteria>
- `toPence(gbp: number): number` — converts GBP to integer pence (multiply by 100, round)
- `fromPence(pence: number): number` — converts pence back to GBP (divide by 100)
- `addPence(a: number, b: number): number` — pence-safe addition
- `subtractPence(a: number, b: number): number` — pence-safe subtraction
- `validateStatementBalance(opening: number, credits: number, debits: number, closing: number): { valid: boolean; difference: number; message: string }` — checks `closing ≈ opening + credits - debits` within 2p tolerance
- All functions use integer arithmetic only (no `0.1 + 0.2 === 0.30000000000000004`)
</acceptance_criteria>

<action>
Create `src/lib/financial/math.ts`:

```typescript
// Integer pence arithmetic for GBP financial calculations.
// All internal computation in pence (integers). Convert only at display time.

const PENCE_PER_POUND = 100;
const BALANCE_VALIDATION_TOLERANCE_PENCE = 2; // 2p tolerance

export function toPence(gbp: number): number {
  return Math.round(gbp * PENCE_PER_POUND);
}

export function fromPence(pence: number): number {
  return pence / PENCE_PER_POUND;
}

export function addPence(a: number, b: number): number {
  return toPence(a) + toPence(b);
}

export function subtractPence(a: number, b: number): number {
  return toPence(a) - toPence(b);
}

export interface BalanceValidation {
  valid: boolean;
  differencePence: number;
  message: string;
}

export function validateStatementBalance(
  opening: number,
  credits: number,
  debits: number,
  closing: number
): BalanceValidation {
  const openingP = toPence(opening);
  const creditsP = toPence(credits);
  const debitsP = toPence(debits);
  const closingP = toPence(closing);
  const expectedP = openingP + creditsP - debitsP;
  const diffP = Math.abs(closingP - expectedP);
  return {
    valid: diffP <= BALANCE_VALIDATION_TOLERANCE_PENCE,
    differencePence: diffP,
    message: diffP <= BALANCE_VALIDATION_TOLERANCE_PENCE
      ? "Balance validates"
      : `Balance mismatch: expected ${fromPence(expectedP)} but statement says ${fromPence(closingP)} (diff: ${diffP}p)`,
  };
}
```
</action>

<verify>
Run: `npx tsc --noEmit src/lib/financial/math.ts`
Expected: No errors.
</verify>

---

### Task 2: Fix Balance Extraction (BAL-01, BAL-02, BAL-04)
**Depends on:** Task 1
**Files:**
- Modify: `src/app/api/documents/aggregate/route.ts:265-304`

<read_first>
The root cause bug: line 298-299 uses `??` to silently fall from `closingBalance` to accumulated net flow when `closingBalance` is null/undefined. This is the #1 trust-destroying bug. The fix removes the fallback entirely — if `closingBalance` is unavailable, return `null` with metadata, never a computed substitute.

Also: the `currentBalance` at line 300-303 uses `catchUpBalance` which projects forward from `lastOccurrence` without checking the statement period boundary. This double-counts transactions already inside the statement period. Fix `catchUpBalance` in Task 4.
</read_first>

<acceptance_criteria>
- `currentBalance` ALWAYS equals the latest statement's `closing_balance` (no fallback)
- If `closingBalance` is missing, return `null` with `source: "unavailable"` — never substitute accumulated net flow
- `statementClosingBalance` is the raw value from the latest statement (authoritative)
- Balance validation runs on the latest statement using `validateStatementBalance()`
- `lastStatementDate` = latest statement's `period_to`, not a fallback chain
</acceptance_criteria>

<action>
Replace lines 259-304 in `src/app/api/documents/aggregate/route.ts` (the entire Balance + Forecast section):

```typescript
  // ── Balance ──
  // currentPosition = authoritative bank balance from latest statement only.
  // accumulated = computed net flow across all statements (shown separately).

  import { validateStatementBalance } from "@/lib/financial/math";

  // Find the document with the most recent statement period end date
  let latestDoc = docs[0];
  let latestStmt = latestDoc.statement_data as unknown as StatementData;
  let latestPeriodTo = latestStmt?.accountInfo?.statementPeriod?.to ?? "";
  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData;
    const periodTo = stmt?.accountInfo?.statementPeriod?.to ?? "";
    if (periodTo > latestPeriodTo) {
      latestPeriodTo = periodTo;
      latestDoc = doc;
      latestStmt = stmt;
    }
  }

  const latestClosingBalance = latestStmt?.accountInfo?.closingBalance;
  const latestPeriodFrom = latestStmt?.accountInfo?.statementPeriod?.from ?? "";

  // Build current position from bank-verified data only
  const currentPosition = {
    balance: latestClosingBalance ?? null as number | null,
    date: latestPeriodTo || null as string | null,
    source: latestClosingBalance != null ? "statement" as const : "unavailable" as const,
    isEstimated: false,
    isStale: false,
    statementPeriodEnd: latestPeriodTo || null as string | null,
  };

  // Balance validation on the latest statement
  let balanceValidation: { valid: boolean; differencePence: number; message: string } | null = null;
  if (latestClosingBalance != null && latestStmt?.accountInfo) {
    const opening = latestStmt.accountInfo.openingBalance ?? latestStmt.accountInfo.previousBalance ?? 0;
    const credits = latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "credit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? 0;
    const debits = latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "debit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? 0;
    balanceValidation = validateStatementBalance(opening, credits, debits, latestClosingBalance);
  }

  // For forecast start: use bank-verified balance, or null if unavailable
  const forecastStartingBalance = currentPosition.balance;
```

Then update the response object (line ~475-601) to replace flat `currentBalance` fields with the new `currentPosition` object:

```typescript
    // Current position (bank-verified)
    currentPosition: {
      balance: currentPosition.balance,
      date: currentPosition.date,
      source: currentPosition.source,
      isEstimated: currentPosition.isEstimated,
      isStale: currentPosition.isStale,
      statementPeriodEnd: currentPosition.statementPeriodEnd,
    },

    // Balance validation
    balanceValidation: balanceValidation ? {
      valid: balanceValidation.valid,
      message: balanceValidation.message,
    } : null,

    // Accumulated performance (computed — separate from current position)
    accumulated: {
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      statementCount: docs.length,
      totalTransactions: workingTransactions.length,
      dateRange: workingTransactions.length > 0
        ? {
            from: workingTransactions.reduce((earliest, tx) => tx.date < earliest ? tx.date : earliest, workingTransactions[0].date),
            to: workingTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, workingTransactions[0].date),
          }
        : null,
    },

    // Forecast (only generated when we have a starting balance)
    forecast: forecastStartingBalance != null
      ? (() => {
          const f = generateForecast(displayPatterns, forecastStartingBalance);
          return {
            currentBalance: f.currentBalance,
            predictedMonthEnd: f.predictedMonthEnd,
            remainingIncome: f.remainingIncome,
            remainingExpenses: f.remainingExpenses,
            status: f.status,
            statusReason: f.statusReason,
            confidence: f.confidence,
            dailyForecast: f.dailyForecast,
            nextIncomeDate: f.nextIncomeDate,
            dangerWindow: f.dangerWindow,
            biggestRisks: f.biggestRisks,
            generatedAt: f.generatedAt,
          };
        })()
      : null,
```

Remove the old flat fields: `currentBalance`, `statementClosingBalance`, `balanceIsEstimated`, `balanceCatchUpDays`, `lastStatementDate`, `dateFilterActive`.
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Check that the response type now has `currentPosition` and `accumulated` as separate top-level keys
3. Check that `currentPosition.balance` is never computed from accumulated net flow
4. Check that the `??` fallback is removed from the balance extraction path
</verify>

---

### Task 3: Add Vendor Keyword Rules (CAT-01, CAT-02, CAT-03, CAT-04)
**Depends on:** Nothing (parallel with Tasks 1-2)
**Files:**
- Modify: `src/lib/detection/subcategory-classifier.ts`

<read_first>
The current keyword matcher in `SUBCATEGORY_KEYWORDS` has gaps. Leicester City Council matches `taxes` via `/city council|borough council/i` but the specific vendor name "Leicester City Council" should match more strongly. Fuel vendors (Shell, BP, Tesco Pay at Pump, etc.) are not in the `car-expenses` patterns. Subscription services (Apple, Amazon Prime, Spotify, PureGym, OpenAI, Monday.com, Gamma, PDFLeader, 01.AI) are not covered. Property management vendors (AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property) are not in `property-management`.

The fix adds explicit vendor patterns with `\b` word boundaries to ensure high-confidence matches. These run BEFORE the AI classifier — known vendors are classified deterministically.
</read_first>

<acceptance_criteria>
- Leicester City Council classified as `taxes` (already partially covered; strengthen the pattern)
- Shell, BP, Tesco Pay at Pump, ASDA Petrol, MFG, Sainsbury's Petrol → `car-expenses`
- Apple, Amazon Prime, Prime Video, Spotify, PureGym, OpenAI, Monday.com, Gamma, PDFLeader, 01.AI → `subscriptions` or `software`
- AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property → `property-management`
- "Tranquil Accommodation" → `rent`
</acceptance_criteria>

<action>
Update `SUBCATEGORY_KEYWORDS` in `src/lib/detection/subcategory-classifier.ts`:

1. In `car-expenses` patterns, ADD (before the closing `]`):
```typescript
    // Fuel/petrol stations
    /\bshell\b(?!\s*(energy|electric))/i,
    /\bbp\b(?!\s*(energy|electric))/i,
    /tesco\s*pay\s*(at|@)\s*pump/i,
    /asda\s*petrol/i,
    /\bmfg\b.*\b(petrol|fuel|forecourt)\b/i,
    /sainsbury.*petrol/i,
    /\bapplegreen\b/i,
    /\besso\b/i,
    /\bmurco\b/i,
    /\bpetrol\b/i,
    /\bfuel\b/i,
    /\bdiesel\b/i,
    /\bauto\s*repair\b/i,
    /\btyre\b/i,
    /\bmechanic\b/i,
    /\bcar\s*(repair|service|wash|valet)\b/i,
    /\bcongestion\s*charge\b/i,
    /\bdart\s*charge\b/i,
    /\bdvla\b/i,
    /\broad\s*tax\b/i,
    /\bvehicle\s*(tax|insurance|repair)\b/i,
    /\brac\b/i,
    /\baa\s*(car|breakdown|insurance)\b/i,
```

2. In `subscriptions` patterns, ADD:
```typescript
    /apple\.com\/bill/i,
    /\bapple\b.*\b(media|services|icloud|app store)\b/i,
    /amazon\s*prime/i,
    /prime\s*video/i,
    /\bspotify\b/i,
    /\bpuregym\b/i,
    /the\s*gym\s*group/i,
    /\bopenai\b/i,
    /\bchatgpt\b/i,
    /monday\.com/i,
    /pdfleader/i,
    /01\.ai/i,
    /\bgamma\b/i,
    /\bnetflix\b/i,
    /\bdisney\b\+?\b/i,
    /\byoutube\s*(premium|music)\b/i,
    /\bgoogle\s*one\b/i,
```

3. In `property-management` patterns, ADD:
```typescript
    /\bamha\s*leicester\b/i,
    /\bgreen\s*acres\b.*\bestate\b/i,
    /\bhaus\s*property\b/i,
    /\bmidlands\s*property\b/i,
    /\bsequoia\s*property\b/i,
    /\btranquil\s*accommoda\b/i,  // income — still classify as property for vendor typing
    /\baccommoda\b/i,
    /\bletting\b/i,
    /\bproperty\s*(management|maint|service|group|rental)\b/i,
    /\bestate\s*agent\b/i,
```

4. In `taxes` patterns, ADD:
```typescript
    /leicester\s*city\s*council/i,
    /\bcouncil\s*tax\b/i,
    /\bbusiness\s*rates\b/i,
    /\bnon-domestic\s*rates\b/i,
```

5. In `rent` patterns, ADD:
```typescript
    /\btranquil\s*accom\b/i,
    /\brent\s*(income|payment|receipt|collection)\b/i,
```

ADD a new category `property-income` for income from properties:
```typescript
    "property-income": [/rent.*income|property.*income|accommodation.*income|housing.*benefit/i],
```

Add `property-income` to the `Subcategory` type at line 1-7.
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify that `/Leicester City Council/i.test("LEICESTER CITY COUNCIL")` is true
3. Verify that `classifySubcategory("SHELL PETROL STATION").subcategory` returns `"car-expenses"`
4. Verify that `classifySubcategory("APPLE.COM/BILL").subcategory` returns `"subscriptions"`
5. Verify that `classifySubcategory("AMHA LEICESTER").subcategory` returns `"property-management"`
</verify>

---

### Task 4: API Response Restructuring (BAL-03, BAL-05)
**Depends on:** Task 2
**Files:**
- Modify: `src/app/api/documents/aggregate/route.ts` (response object)
- Modify: `src/types/index.ts` (add type definitions)

<read_first>
Task 2 separated `currentPosition` from `accumulatedPerformance` in the API. This task ensures the TypeScript types enforce the separation at compile time and the frontend components destructure from the correct keys. The API response must use the new `currentPosition` object everywhere the old flat fields were used.

The dashboard currently reads `currentBalance`, `statementClosingBalance`, `balanceIsEstimated`, `lastStatementDate` directly from the response. These must be updated to read from `currentPosition`.
</read_first>

<acceptance_criteria>
- `src/types/index.ts` has `CurrentPosition`, `AccumulatedPerformance`, `BalanceValidationResult` types
- API response has `currentPosition` (object) and `accumulated` (object) as separate top-level keys
- Old flat fields (`currentBalance`, `statementClosingBalance`, `balanceIsEstimated`, `balanceCatchUpDays`, `lastStatementDate`, `dateFilterActive`) are removed from response
- Dashboard component `page.tsx` destructures `currentPosition` and `accumulated` correctly
- `accumulated.netFlow` is labeled distinctly from `currentPosition.balance` in the UI
</acceptance_criteria>

<action>
1. Add to `src/types/index.ts`:

```typescript
export interface CurrentPosition {
  balance: number | null;
  date: string | null;
  source: "statement" | "catchUp" | "unavailable";
  isEstimated: boolean;
  isStale: boolean;
  statementPeriodEnd: string | null;
}

export interface AccumulatedPerformance {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  statementCount: number;
  totalTransactions: number;
  dateRange: { from: string; to: string } | null;
}

export interface BalanceValidationResult {
  valid: boolean;
  message: string;
}
```

2. Update the dashboard page to use new response shape. In `src/app/(app)/dashboard/page.tsx`, replace any destructuring of `currentBalance`, `statementClosingBalance` etc. with `currentPosition` and `accumulated`:

```typescript
// Old (remove):
// const { currentBalance, accumulated, forecast, ... } = data;

// New:
const { currentPosition, accumulated, forecast, ... } = data;
```

Display `currentPosition.balance` as the hero metric (e.g., "Current Bank Balance").
Display `accumulated.netFlow` as a secondary metric (e.g., "All-Time Net Flow").
If `currentPosition.source === "unavailable"`, show "Balance unavailable — upload a statement".
If `currentPosition.isStale`, show a stale-data warning.
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Check dashboard loads and shows the correct hero balance from `currentPosition`
3. Check that `accumulated.netFlow` is not presented as "Current Balance" anywhere
4. Check that the API response shape matches the new type definitions
</verify>

---

### Task 5: Fix catchUpBalance Deduplication (FOR-01, FOR-02)
**Depends on:** Task 2
**Files:**
- Modify: `src/lib/forecast/index.ts:50-111`

<read_first>
The current `catchUpBalance()` projects forward from `lastOccurrence` using average gap without checking the statement period boundary. This double-counts transactions: the statement's closing balance already includes transactions up to `period_to`, but the catch-up loop projects from `lastOccurrence` which may be before `period_to`, re-applying transactions already baked into the closing balance.

Fix: add a `statementPeriodEnd` parameter. When projecting, only count occurrences where `nextExpected > statementPeriodEnd`. The starting balance must be the authoritative `closingBalance` (never a computed fallback).

Also replace average-gap projection with day-of-month anchored projection for monthly patterns. If a payment normally occurs on the 15th, project to the next 15th, not "last date + 30 days."
</read_first>

<acceptance_criteria>
- `catchUpBalance()` signature includes `statementPeriodEnd: string` parameter
- Only projects transactions where `nextExpected > statementPeriodEnd`
- Uses `closingBalance` as the starting point (never accumulated net flow)
- For monthly patterns, uses day-of-month anchoring (not average gap)
- `hasAlreadyOccurredThisMonth()` helper prevents double-counting within the same calendar month
</acceptance_criteria>

<action>
Replace `catchUpBalance()` in `src/lib/forecast/index.ts`:

```typescript
const MAX_CATCHUP_DAYS = 30;

function getDayOfMonth(date: string): number {
  return new Date(date).getDate();
}

function computeAverageDayOfMonth(occurrences: { date: string; amount: number }[]): number {
  const days = occurrences.map(o => getDayOfMonth(o.date));
  return Math.round(days.reduce((s, d) => s + d, 0) / days.length);
}

function computeAverageGap(occurrences: { date: string; amount: number }[]): number {
  if (occurrences.length < 2) return 30;
  const gaps = [];
  for (let i = 1; i < occurrences.length; i++) {
    gaps.push(daysBetween(occurrences[i - 1].date, occurrences[i].date));
  }
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

function hasAlreadyOccurredThisMonth(
  occurrences: { date: string; amount: number }[],
  today: string
): boolean {
  const currentMonth = today.slice(0, 7);
  return occurrences.some(o => o.date.slice(0, 7) === currentMonth);
}

export function catchUpBalance(
  patterns: EnrichedDetectedPatterns,
  lastKnownBalance: number,       // MUST be authoritative closingBalance from latest statement
  lastKnownDate: string,          // MUST be latest statement period_to
  statementPeriodEnd: string,     // the period_to date — don't project transactions before this
  today?: string
): CatchUpResult {
  const todayStr = today ?? new Date().toISOString().split("T")[0];

  if (lastKnownDate >= todayStr) {
    return {
      estimatedBalance: lastKnownBalance,
      lastKnownBalance,
      lastKnownDate,
      daysProjected: 0,
      isEstimated: false,
    };
  }

  const daysSince = daysBetween(lastKnownDate, todayStr);

  // If last statement is too old to project reliably, don't estimate
  if (daysSince > MAX_CATCHUP_DAYS) {
    return {
      estimatedBalance: lastKnownBalance,
      lastKnownBalance,
      lastKnownDate,
      daysProjected: daysSince,
      isEstimated: false, // treat as "stale" rather than estimated
    };
  }

  const horizon = addDays(lastKnownDate, MAX_CATCHUP_DAYS);
  let balance = lastKnownBalance;

  for (const payment of patterns.recurringExpenses) {
    if (payment.occurrences.length < 2) continue;
    if (hasAlreadyOccurredThisMonth(payment.occurrences, todayStr)) continue;

    const avgDayOfMonth = computeAverageDayOfMonth(payment.occurrences);
    let nextDate: string;

    if (payment.interval === "monthly" || payment.interval === "28-day") {
      // Day-of-month anchored projection for monthly patterns
      const todayDate = new Date(todayStr);
      const nextMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), avgDayOfMonth);
      if (nextMonth <= todayDate) {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }
      nextDate = formatDate(nextMonth);
    } else {
      // Average-gap projection for non-monthly patterns
      const gap = computeAverageGap(payment.occurrences);
      nextDate = addDays(payment.lastOccurrence, gap);
    }

    // Only project if nextExpected > statementPeriodEnd (avoid double-count)
    while (nextDate <= horizon && nextDate <= todayStr) {
      if (nextDate > statementPeriodEnd) {
        balance -= payment.typicalAmount;
      }
      // Advance based on interval type
      if (payment.interval === "monthly" || payment.interval === "28-day") {
        const nd = new Date(nextDate);
        nd.setMonth(nd.getMonth() + 1);
        nextDate = formatDate(nd);
      } else {
        const gap = computeAverageGap(payment.occurrences);
        nextDate = addDays(nextDate, gap);
      }
    }
  }

  for (const income of patterns.recurringIncome) {
    if (income.occurrences.length < 2) continue;
    if (hasAlreadyOccurredThisMonth(income.occurrences, todayStr)) continue;

    const avgDayOfMonth = computeAverageDayOfMonth(income.occurrences);
    let nextDate: string;

    if (income.interval === "monthly" || income.interval === "28-day") {
      const todayDate = new Date(todayStr);
      const nextMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), avgDayOfMonth);
      if (nextMonth <= todayDate) {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }
      nextDate = formatDate(nextMonth);
    } else {
      const gap = computeAverageGap(income.occurrences);
      nextDate = addDays(income.lastOccurrence, gap);
    }

    while (nextDate <= horizon && nextDate <= todayStr) {
      if (nextDate > statementPeriodEnd) {
        balance += income.typicalAmount;
      }
      if (income.interval === "monthly" || income.interval === "28-day") {
        const nd = new Date(nextDate);
        nd.setMonth(nd.getMonth() + 1);
        nextDate = formatDate(nd);
      } else {
        const gap = computeAverageGap(income.occurrences);
        nextDate = addDays(nextDate, gap);
      }
    }
  }

  return {
    estimatedBalance: balance,
    lastKnownBalance,
    lastKnownDate,
    daysProjected: daysSince,
    isEstimated: true,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
```
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify that `catchUpBalance` with `statementPeriodEnd = "2026-05-01"` does not project transactions dated before May 1
3. Verify that `hasAlreadyOccurredThisMonth` returns true for a payment that already occurred in May 2026
4. Verify that day-of-month anchoring projects to the correct day in the current month
</verify>

---

### Task 6: Multi-Factor Confidence Scoring (FOR-06, FOR-09, CAT-05)
**Depends on:** Task 5
**Files:**
- Modify: `src/lib/detection/pattern-detector.ts`
- Modify: `src/lib/learning/cross-month-learner.ts`

<read_first>
The current confidence scoring in `pattern-detector.ts:52-60` uses only 3 factors (occurrences, amount CV, interval consistency). The recurring classification in `cross-month-learner.ts:136-166` uses a simple 2-occurrence threshold.

The fix replaces both with a multi-factor confidence model:
- Occurrence count (30% weight) — more is better
- Month spread (25% weight) — seen across more unique months = more reliable
- Amount stability (20% weight) — lower CV = more predictable
- Interval consistency (15% weight) — tighter gaps = more regular
- Day-of-month variance (10% weight) — clustered around same day = more predictable

Confidence tiers:
- HIGH (≥0.70): 4+ months, stable amount, consistent day → include in main forecast
- MEDIUM (0.40–0.69): 2-3 months or moderate variance → show as "possible"
- LOW (<0.40): 1 month or high variance → exclude from forecast
</read_first>

<acceptance_criteria>
- `scoreConfidence()` uses all 5 weighted factors
- `ConfidenceTier` type: `"high" | "medium" | "low"`
- `getConfidenceTier(score: number): ConfidenceTier` — maps numeric score to tier
- `learnFromHistory()` separates: true recurring (HIGH), frequent irregular (MEDIUM), same vendor different property, income vs expense
- Forecast only includes HIGH confidence patterns; MEDIUM shown as "possible"; LOW excluded
- Amount variance CV > 0.3 caps confidence at MEDIUM regardless of other factors
</acceptance_criteria>

<action>
1. Replace `scoreConfidence()` in `src/lib/detection/pattern-detector.ts`:

```typescript
export type ConfidenceTier = "high" | "medium" | "low";

function computeDayOfMonthVariance(occurrences: { date: string; amount: number }[]): number {
  if (occurrences.length < 2) return 999;
  const days = occurrences.map(o => new Date(o.date).getDate());
  const mean = days.reduce((s, d) => s + d, 0) / days.length;
  const variance = days.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / days.length;
  return Math.sqrt(variance); // standard deviation in days
}

function countUniqueMonths(occurrences: { date: string; amount: number }[]): number {
  return new Set(occurrences.map(o => o.date.slice(0, 7))).size;
}

function scoreConfidence(
  occurrences: number,
  amountCV: number,
  intervalConsistency: number,
  uniqueMonths: number,
  dayOfMonthStdDev: number
): number {
  // 5-factor weighted confidence
  const occurrenceScore = Math.min(1, (occurrences - 1) / 3); // 0→1 at 4 occurrences
  const monthSpreadScore = Math.min(1, (uniqueMonths - 1) / 3); // 0→1 at 4 months
  const amountStabilityScore = amountCV < 0.05 ? 1 : amountCV < 0.15 ? 0.7 : amountCV < 0.3 ? 0.4 : 0.1;
  const intervalScore = Math.max(0, Math.min(1, intervalConsistency));
  const dayVarianceScore = dayOfMonthStdDev <= 2 ? 1 : dayOfMonthStdDev <= 5 ? 0.7 : dayOfMonthStdDev <= 10 ? 0.4 : 0.1;

  // Weighted sum
  const weights = { occurrence: 0.30, monthSpread: 0.25, amountStability: 0.20, interval: 0.15, dayVariance: 0.10 };
  let score = occurrenceScore * weights.occurrence
    + monthSpreadScore * weights.monthSpread
    + amountStabilityScore * weights.amountStability
    + intervalScore * weights.interval
    + dayVarianceScore * weights.dayVariance;

  // Cap at MEDIUM if amount variance is too high
  if (amountCV > 0.3) score = Math.min(score, 0.65);

  return Math.max(0, Math.min(1, score));
}

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 0.70) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}
```

2. Update `detectPatterns()` to pass new parameters to `scoreConfidence()`. After computing `cv` and `consistency` at lines 104-106, add:

```typescript
    const uniqueMonths = countUniqueMonths(sorted.map(t => ({ date: t.date, amount: t.amount })));
    const dayStdDev = computeDayOfMonthVariance(sorted.map(t => ({ date: t.date, amount: t.amount })));
    const confidence = scoreConfidence(sorted.length, cv, consistency, uniqueMonths, dayStdDev);
    const tier = getConfidenceTier(confidence);
```

3. Add `confidenceTier` to the `RecurringPayment` interface:

```typescript
  confidenceTier: ConfidenceTier;
```

4. Update `learnFromHistory()` in `src/lib/learning/cross-month-learner.ts` to use multi-factor classification. After line 136 (the recurrence classification block), add tier-based separation:

```typescript
    // Separate by confidence tier and transaction type
    if (vendor.isRecurring) {
      recurringCandidates.push(vendor);
    } else if (vendor.months.length >= 2 && vendor.appearanceCount >= 3) {
      // Frequent but irregular — still recurring for learning purposes
      vendor.isRecurring = true;
      recurringCandidates.push(vendor);
    }
```
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify that a vendor appearing in 1 month with 2 occurrences gets LOW confidence
3. Verify that a vendor appearing in 4+ months with stable amounts gets HIGH confidence
4. Verify that amount variance CV > 0.3 caps at MEDIUM
</verify>

---

### Task 7: Fix Forecast Generation (FOR-03, FOR-04, FOR-05, FOR-07, FOR-08, FOR-10)
**Depends on:** Tasks 5, 6
**Files:**
- Modify: `src/lib/forecast/index.ts:113-166`
- Modify: `src/lib/forecast/daily-forecaster.ts`

<read_first>
The current `generateForecast()` does not filter by confidence tier, does not deduplicate transactions already in the current month, and does not mark items as Completed/Expected/Late/Uncertain. It uses all recurring patterns regardless of confidence.

Fix: forecast only from today to month-end. Only include HIGH confidence items. Check if a recurring transaction already occurred this month (mark Completed). If not yet and expected date is ahead (mark Expected). If expected date passed and didn't happen (mark Late). Low confidence items excluded.

Three forecast modes:
A. Completed month (latest period_to is in past, month is fully covered) → show actuals only
B. Current partial month → forecast remaining
C. Future month → only on explicit request
</read_first>

<acceptance_criteria>
- `generateForecast()` forecasts only from today to month-end
- Only HIGH confidence tier patterns included in main forecast
- Each item tagged: Completed, Expected, Late, or Uncertain
- Deduplication: check if transaction already in current month before including
- Three forecast modes implemented (completed month shows actuals only)
- Forecast formula: `latestClosingBalance + expectedRemainingIncome - expectedRemainingExpenses`
- Output summary includes: latest balance, expected remaining income/expenses, predicted month-end, lowest expected balance with date, status, confidence %
- MEDIUM confidence items shown as "possible" in a separate list
- LOW confidence items excluded from forecast entirely
</acceptance_criteria>

<action>
1. Add forecast item status type and update `ExpectedTransaction` in `src/lib/forecast/daily-forecaster.ts`:

```typescript
export type ForecastItemStatus = "completed" | "expected" | "late" | "uncertain";

export interface ExpectedTransaction {
  merchant: string;
  expectedAmount: number;
  category: string;
  subcategory: string;
  recurring: boolean;
  confidence: number;
  confidenceTier: ConfidenceTier;
  status: ForecastItemStatus;
  recurrence: RecurringPayment | null;
}
```

2. Add `possibleUpcoming` and `excludedLowConfidence` to `DailyForecast`:

```typescript
export interface DailyForecast {
  date: string;
  openingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  closingBalance: number;
  transactions: ExpectedTransaction[];
  possibleUpcoming: ExpectedTransaction[];  // MEDIUM confidence
  riskFlag: boolean;
  riskMessage?: string;
}
```

3. Replace `generateDailyForecast()` in `src/lib/forecast/daily-forecaster.ts` to:
- Only include HIGH confidence items in `transactions` (main forecast)
- Put MEDIUM confidence items in `possibleUpcoming`
- Skip LOW confidence items entirely
- Check `hasAlreadyOccurredThisMonth()` before adding
- Tag items as `completed` if already in current month, `expected` if coming up, `late` if past expected date

4. Replace `generateForecast()` in `src/lib/forecast/index.ts`:

```typescript
export function generateForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today?: string
): MonthEndForecast {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  const monthEnd = getMonthEnd(todayStr);

  // If month is already complete (period_to is past month_end), return actuals only
  const isMonthComplete = false; // computed in aggregate route based on statement coverage

  const daily = generateDailyForecast(patterns, currentBalance, todayStr);

  // Filter to HIGH confidence only for main forecast
  const highConfidenceIncome = patterns.recurringIncome
    .filter(i => (i as any).confidenceTier === "high" && i.nextExpected <= monthEnd);
  const highConfidenceExpenses = patterns.recurringExpenses
    .filter(e => (e as any).confidenceTier === "high" && e.nextExpected <= monthEnd);

  const remainingIncome = highConfidenceIncome.reduce((s, i) => s + i.typicalAmount, 0);
  const remainingExpenses = highConfidenceExpenses.reduce((s, e) => s + e.typicalAmount, 0);

  const nextIncomeDates = highConfidenceIncome.map(i => i.nextExpected).sort();
  const nextIncomeDate = nextIncomeDates.length > 0 ? nextIncomeDates[0] : null;

  const totalMonthlyExpenses = highConfidenceExpenses.reduce((s, e) => s + e.typicalAmount, 0);

  const { status, reason: statusReason } = calculateStatus(daily, totalMonthlyExpenses, nextIncomeDate);
  const risks = detectRisks(daily);

  // Danger window
  const threshold = totalMonthlyExpenses * 0.2;
  const lowDays = daily.filter(d => d.closingBalance < threshold);
  const dangerWindow = lowDays.length > 0
    ? { from: lowDays[0].date, to: lowDays[lowDays.length - 1].date, lowestBalance: Math.min(...lowDays.map(d => d.closingBalance)) }
    : null;

  // Confidence: average of HIGH confidence pattern confidences
  const confidences = [...highConfidenceIncome, ...highConfidenceExpenses].map(p => p.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0;

  // Find the lowest expected balance and its date
  let lowestBalance = currentBalance;
  let lowestBalanceDate = todayStr;
  for (const day of daily) {
    if (day.closingBalance < lowestBalance) {
      lowestBalance = day.closingBalance;
      lowestBalanceDate = day.date;
    }
  }

  return {
    currentBalance,
    predictedMonthEnd: daily[daily.length - 1]?.closingBalance ?? currentBalance,
    remainingIncome,
    remainingExpenses,
    status,
    statusReason,
    confidence: avgConfidence,
    dailyForecast: daily,
    nextIncomeDate,
    dangerWindow,
    biggestRisks: risks,
    generatedAt: new Date().toISOString(),
  };
}

function getMonthEnd(today: string): string {
  const d = new Date(today);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().split("T")[0];
}
```

5. Group daily forecast transactions — top 3-5 per day with "+X more" expandable. This is consumed by the UI but the grouping data should be included in the API response. Add to `DailyForecast`:

```typescript
  transactionCount: number;  // total count for this day (for "+X more" display)
```
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify that only HIGH confidence patterns are in `remainingIncome`/`remainingExpenses`
3. Verify that MEDIUM confidence patterns appear in `possibleUpcoming`
4. Verify that a transaction already in the current month is tagged `completed`
5. Verify `predictedMonthEnd ≈ currentBalance + remainingIncome - remainingExpenses`
</verify>

---

### Task 8: Fix Suspicious Detector (SUS-01, SUS-02, SUS-03)
**Depends on:** Task 3
**Files:**
- Modify: `src/lib/detection/suspicious-detector.ts`

<read_first>
The current detector runs personal keyword patterns against ALL transactions including income/credits. This produces false positives like "Tranquil Accommodation" (rent income) being flagged as "fast food" because the pattern `/accommoda/i` in `rent` keywords doesn't gate before personal patterns run.

Fix: add a direction gate (credits never match expense-based personal patterns), an amount gate (large transactions >£200 skip small-purchase patterns), and a vendor type pre-check (run categorization first, skip personal detection for known business categories).

The detector must run AFTER categorization so known business transactions skip personal checks. The `detectAllSuspicious` function in the aggregate route should receive categorized transactions.
</read_first>

<acceptance_criteria>
- Credits (income) never match expense-based personal patterns
- Transactions above £200 skip small-purchase patterns (fast food, coffee, etc.)
- Known business vendors skip personal detection entirely
- "Tranquil Accommodation" income is NOT flagged as fast food or personal
- Rent/property income is never flagged as food/personal
- Detector considers: amount, direction, vendor type, and transaction wording
</acceptance_criteria>

<action>
Replace `detectSuspicious()` in `src/lib/detection/suspicious-detector.ts`:

```typescript
export function detectSuspicious(
  transaction: Transaction,
  allTransactions: Transaction[] = [],
  knownBusinessVendors?: Set<string>  // vendors known to be business-related
): SuspiciousTransaction | null {
  const desc = transaction.description;
  const core = coreMerchant(normalizeMerchant(desc)).toLowerCase();

  // GATE 1: Credits (income) are never personal expenses
  if (transaction.type === "credit") return null;

  // GATE 2: Known business vendors skip detection
  if (knownBusinessVendors?.has(core)) return null;

  // GATE 3: Large transactions skip small-purchase patterns
  const isSmallAmount = transaction.amount < 200;

  // Check personal patterns — only for debits, only if not known business
  for (const { pattern, reason } of PERSONAL_PATTERNS) {
    // Skip small-purchase patterns for large transactions
    const isSmallPurchasePattern = /fast food|coffee|meal|snack/i.test(reason);
    if (isSmallPurchasePattern && !isSmallAmount) continue;

    if (pattern.test(desc) || pattern.test(core)) {
      return {
        transaction,
        merchant: core,
        reason,
        riskLevel: /gambling|onlyfans/i.test(reason) ? "high" : "medium",
        suggestedCategory: "personal-review",
        shouldExcludeFromBusiness: true,
      };
    }
  }

  // ... rest of detection (weekend leisure, director payment, cash, duplicate subscriptions)
  // ... keep existing code for these checks
```

Update `detectAllSuspicious()` to accept known business vendors:

```typescript
export function detectAllSuspicious(
  transactions: Transaction[],
  knownBusinessVendors?: Set<string>
): SuspiciousTransaction[] {
  return transactions
    .map((tx) => detectSuspicious(tx, transactions, knownBusinessVendors))
    .filter((s): s is SuspiciousTransaction => s !== null);
}
```

In the aggregate route, build `knownBusinessVendors` from the learning report's recurring candidates with business categories (rent, property-management, taxes, supplier-payments, etc.):

```typescript
// In aggregate/route.ts, before calling detectAllSuspicious:
const knownBusinessVendors = new Set<string>();
for (const vendor of learningReport.recurringCandidates) {
  const bizCategories = ["rent", "property-management", "property-income", "taxes", "supplier-payments", "utilities", "software", "professional-services"];
  if (bizCategories.includes(vendor.subcategory)) {
    knownBusinessVendors.add(vendor.canonicalName.toLowerCase());
  }
}
// Pass to detectAllSuspicious:
const allSuspicious = detectAllSuspicious(allTransactions, knownBusinessVendors);
```
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify that a credit transaction with "ACCOMMODATION" in description returns `null`
3. Verify that a £500 debit with "coffee" in description skips the fast food check (amount gate)
4. Verify that "Tranquil Accommodation" income (type: credit) is NOT flagged
</verify>

---

### Task 9: Fix Risk Messages (RIS-01)
**Depends on:** Tasks 6, 7
**Files:**
- Modify: `src/lib/forecast/risk-detector.ts`

<read_first>
Current risk messages are generic ("Balance drops below 20% of expected monthly expenses"). They don't name specific vendors, dates, or amounts. A business owner needs to know: which payments cause the drop, when the next income arrives, and precisely how long the danger window lasts.

Fix: make risk messages specific and actionable. Include vendor names, amounts, dates, and context about when the situation resolves.
</read_first>

<acceptance_criteria>
- Risk messages name specific vendors and amounts
- Risk messages reference when the next income is expected
- Risk messages include severity context (depth below threshold, duration, proximity to next income)
- Example output: "Balance expected to remain below £500 threshold until Tranquil Accommodation payments arrive around 23-24 May"
- No generic "Balance drops below X%" messages remain
</acceptance_criteria>

<action>
Replace `detectRisks()` and `formatCurrencyStatic()` in `src/lib/forecast/risk-detector.ts`:

```typescript
export function detectRisks(
  dailyForecast: DailyForecast[],
  nextIncomeDate?: string | null,
  nextIncomeVendor?: string
): RiskItem[] {
  const risks: RiskItem[] = [];
  const threshold = 500;

  // Low balance windows — with specific context
  let lowWindowStart: string | null = null;
  let lowestInWindow = Infinity;
  let lowWindowDays: DailyForecast[] = [];
  for (const day of dailyForecast) {
    if (day.closingBalance < threshold) {
      if (!lowWindowStart) lowWindowStart = day.date;
      lowestInWindow = Math.min(lowestInWindow, day.closingBalance);
      lowWindowDays.push(day);
    } else if (lowWindowStart) {
      const endDate = day.date;
      const duration = lowWindowDays.length;

      // Find the biggest expense day in the window
      const biggestExpenseDay = lowWindowDays.reduce((max, d) =>
        d.expectedExpenses > max.expectedExpenses ? d : max, lowWindowDays[0]);

      // Build specific description
      let desc = `Balance drops as low as ${formatCurrencyStatic(lowestInWindow)} between ${lowWindowStart} and ${endDate}`;

      if (biggestExpenseDay.transactions.length > 0) {
        const topPayments = biggestExpenseDay.transactions
          .slice(0, 3)
          .map(t => `${t.merchant} (${formatCurrencyStatic(t.expectedAmount)})`)
          .join(", ");
        desc += `. Largest payment day: ${biggestExpenseDay.date} — ${topPayments}`;
      }

      if (nextIncomeDate && nextIncomeDate > lowWindowStart) {
        const recoveryContext = nextIncomeVendor
          ? `${nextIncomeVendor} payments`
          : "next income";
        desc += `. Balance expected to remain below threshold until ${recoveryContext} arrive around ${nextIncomeDate}`;
      }

      let actionable = "";
      if (duration >= 5) {
        actionable = `Low balance window lasts ${duration} days. Consider rescheduling non-critical payments or arranging short-term funding.`;
      } else {
        actionable = `Short low-balance window (${duration} days). Monitor closely but may not require action.`;
      }

      risks.push({
        type: "low-balance-window",
        title: `Low balance: ${lowWindowStart} — ${endDate} (${duration} days)`,
        description: desc,
        severity: lowestInWindow < 0 ? "high" : lowestInWindow < 200 ? "medium" : "low",
        relatedDates: [lowWindowStart, endDate],
        actionable,
      });
      lowWindowStart = null;
      lowestInWindow = Infinity;
      lowWindowDays = [];
    }
  }

  // Handle window that extends to end of forecast
  if (lowWindowStart && lowWindowDays.length > 0) {
    const endDate = lowWindowDays[lowWindowDays.length - 1].date;
    const duration = lowWindowDays.length;
    let desc = `Balance drops as low as ${formatCurrencyStatic(lowestInWindow)} from ${lowWindowStart} through month-end`;
    if (nextIncomeDate && nextIncomeDate > lowWindowStart) {
      desc += `. Next income expected around ${nextIncomeDate}`;
    }
    risks.push({
      type: "low-balance-window",
      title: `Low balance through month-end (${duration} days)`,
      description: desc,
      severity: lowestInWindow < 0 ? "high" : "medium",
      relatedDates: [lowWindowStart, endDate],
      actionable: "Review upcoming payments and ensure sufficient funds before month-end.",
    });
  }

  // Large payment days — with vendor names
  for (const day of dailyForecast) {
    if (day.expectedExpenses > 1000) {
      const topItems = day.transactions
        .slice(0, 5)
        .map(t => `${t.merchant}: ${formatCurrencyStatic(t.expectedAmount)}`)
        .join(", ");
      risks.push({
        type: "large-payment",
        title: `Large payment day: ${day.date}`,
        description: `${formatCurrencyStatic(day.expectedExpenses)} in payments — ${topItems}`,
        severity: day.closingBalance < 0 ? "high" : "medium",
        relatedDates: [day.date],
        actionable: `Ensure at least ${formatCurrencyStatic(day.expectedExpenses + threshold)} in balance before ${day.date}`,
      });
    }
  }

  // Payment clusters
  for (const day of dailyForecast) {
    if (day.transactions.length >= 3 && day.expectedExpenses > 500) {
      const items = day.transactions.map(t => t.merchant).join(", ");
      risks.push({
        type: "payment-cluster",
        title: `Payment cluster: ${day.date}`,
        description: `${day.transactions.length} payments (${items}) totaling ${formatCurrencyStatic(day.expectedExpenses)}`,
        severity: day.closingBalance < 0 ? "medium" : "low",
        relatedDates: [day.date],
        actionable: "Consider spreading these payments across different days to smooth cashflow",
      });
    }
  }

  return risks;
}
```

Update the `generateForecast()` call to pass income context:

```typescript
const risks = detectRisks(
  daily,
  nextIncomeDate,
  patterns.recurringIncome.find(i => i.nextExpected === nextIncomeDate)?.merchant
);
```
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify risk messages include vendor names and amounts
3. Verify risk messages reference next income date when applicable
4. Verify no generic "Balance drops below 20%" messages remain in the output
</verify>

---

### Task 10: Upload Pipeline Recalculation (UPL-01, UPL-02)
**Depends on:** Tasks 1-9
**Files:**
- Modify: `src/app/(app)/upload/page.tsx`
- Create: `src/lib/pipeline/upload-pipeline.ts`

<read_first>
The upload flow must trigger a full recalculation after each new statement: parse → validate → add to ledger → rebuild vendor intelligence → reclassify → update patterns → update forecast → flag anomalies.

After upload, show a summary: imported period, latest balance, new vendors discovered, patterns updated, potential personal expenses flagged, forecast updated.
</read_first>

<acceptance_criteria>
- Upload triggers full recalculation pipeline
- Pipeline runs: validate → learn → reclassify → update patterns → update forecast
- After upload, summary shown: imported period, latest balance, new vendors, updated patterns, personal expenses, forecast updated
- Pipeline is deterministic and idempotent (same input produces same output)
</acceptance_criteria>

<action>
Create `src/lib/pipeline/upload-pipeline.ts`:

```typescript
import { learnFromHistory, buildVendorIntelEntries } from "@/lib/learning/cross-month-learner";
import { detectAllAsync } from "@/lib/detection";
import { detectAllSuspicious } from "@/lib/detection/suspicious-detector";
import { upsertVendorIntelBatch } from "@/lib/vendor-intel";
import { validateStatementBalance } from "@/lib/financial/math";
import type { Transaction, StatementData } from "@/types";

export interface UploadSummary {
  importedPeriod: { from: string; to: string } | null;
  latestBalance: number | null;
  transactionCount: number;
  newVendors: string[];
  updatedPatterns: number;
  potentialPersonalExpenses: number;
  forecastUpdated: boolean;
}

export async function runUploadPipeline(
  statementData: StatementData,
  allTransactions: Transaction[],
  companyId: string
): Promise<UploadSummary> {
  const transactions = statementData.transactions;
  const accountInfo = statementData.accountInfo;

  // 1. Validate balances
  let balanceValid = false;
  if (accountInfo?.closingBalance != null) {
    const opening = accountInfo.openingBalance ?? accountInfo.previousBalance ?? 0;
    const credits = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const debits = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const validation = validateStatementBalance(opening, credits, debits, accountInfo.closingBalance);
    balanceValid = validation.valid;
  }

  // 2. Learn from all transactions (including new ones)
  const combinedTransactions = [...allTransactions, ...transactions];
  const learningReport = learnFromHistory(combinedTransactions);

  // 3. Build vendor intel
  const vendorIntelEntries = buildVendorIntelEntries(learningReport, companyId);
  if (vendorIntelEntries.length > 0) {
    await upsertVendorIntelBatch(vendorIntelEntries);
  }

  // 4. Detect patterns
  const knownVendors = new Map();
  for (const vendor of learningReport.vendors.values()) {
    knownVendors.set(vendor.canonicalName, {
      subcategory: vendor.subcategory,
      confidence: vendor.isRecurring ? 0.8 : 0.5,
      reasoning: `Learned from ${vendor.appearanceCount} appearances`,
    });
  }
  const { patterns, newVendors } = await detectAllAsync(combinedTransactions, knownVendors as any);

  // 5. Detect suspicious (with known business vendors gate)
  const knownBusinessVendors = new Set<string>();
  for (const vendor of learningReport.recurringCandidates) {
    const bizCategories = ["rent", "property-management", "taxes", "supplier-payments", "utilities", "software"];
    if (bizCategories.includes(vendor.subcategory)) {
      knownBusinessVendors.add(vendor.canonicalName.toLowerCase());
    }
  }
  const suspicious = detectAllSuspicious(combinedTransactions, knownBusinessVendors);

  return {
    importedPeriod: accountInfo?.statementPeriod
      ? { from: accountInfo.statementPeriod.from, to: accountInfo.statementPeriod.to }
      : null,
    latestBalance: accountInfo?.closingBalance ?? null,
    transactionCount: transactions.length,
    newVendors: newVendors.map(v => v.merchantNormalized),
    updatedPatterns: patterns.recurringExpenses.length + patterns.recurringIncome.length,
    potentialPersonalExpenses: suspicious.length,
    forecastUpdated: true,
  };
}
```

Update the upload page to call the pipeline and display summary after upload completes.
</action>

<verify>
1. Run `npx tsc --noEmit` — expected no errors
2. Verify upload triggers pipeline execution
3. Verify summary is displayed after upload completes
4. Verify the pipeline is idempotent (running twice produces same results)
</verify>

---
## Dependency Order

```
Task 1 ──→ Task 2 ──→ Task 4 (API types) ──→ Task 7 (forecast)
                │                                    │
                └──→ Task 5 (catchUp) ──→ Task 6 (confidence) ──→ Task 9 (risks)
                
Task 3 (keywords) ──→ Task 8 (suspicious)

Task 10 (pipeline) ←── depends on Tasks 1-9 (runs last)
```

Tasks 1+3 can run in parallel. Tasks 2+3 can run in parallel. Task 4 follows Task 2. Task 5 follows Task 2. Tasks 6+7 follow Task 5. Task 8 follows Task 3. Task 9 follows Tasks 6+7. Task 10 follows all.

## Verification Checklist

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `currentPosition.balance` equals latest statement `closing_balance` (£380.93, not -£32,822.66)
- [ ] `accumulated.netFlow` is labeled as "All-Time Net Flow", never as "Current Balance"
- [ ] Balance validation runs on latest statement
- [ ] Leicester City Council classified as `taxes`
- [ ] Shell/BP/Tesco Pay at Pump classified as `car-expenses`
- [ ] Apple/Spotify/OpenAI classified as `subscriptions` or `software`
- [ ] AMHA Leicester/Green Acres classified as `property-management`
- [ ] `catchUpBalance()` does not project transactions before `statementPeriodEnd`
- [ ] Day-of-month anchoring used for monthly patterns
- [ ] Multi-factor confidence scoring produces HIGH/MEDIUM/LOW tiers
- [ ] Only HIGH confidence items in main forecast
- [ ] MEDIUM confidence items shown as "possible upcoming"
- [ ] Forecast starts from latest `closingBalance` and ends at month-end
- [ ] Deduplication prevents forecasting already-completed transactions
- [ ] Each forecasted item tagged: Completed, Expected, Late, Uncertain
- [ ] Risk messages include vendor names, amounts, and income context
- [ ] Tranquil Accommodation income NOT flagged as personal/fast food
- [ ] Credits (income) skip expense-based personal patterns
- [ ] Upload triggers full recalculation pipeline
- [ ] Upload summary shows imported period, latest balance, new vendors, updated patterns
