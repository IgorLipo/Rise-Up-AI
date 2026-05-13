---
phase: quick-fix-forecast-engine-exclude-one-offs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/learning/cross-month-learner.ts
  - src/lib/detection/pattern-detector.ts
  - src/app/api/documents/aggregate/route.ts
  - src/components/dashboard/forecast-tab.tsx
  - src/app/(app)/dashboard/page.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "API response includes monthlyOneOffExpenseAvg and monthlyOneOffIncomeAvg computed across all statements"
    - "Forecast tab displays a Monthly One-Off Buffer card showing the average one-off expense per month"
    - "Pattern detector JSDoc clarifies that per-call one-off classification is provisional; cross-month learner is authoritative"
  artifacts:
    - path: "src/lib/learning/cross-month-learner.ts"
      provides: "LearningReport with monthlyOneOffExpenseAvg and monthlyOneOffIncomeAvg fields"
      contains: "monthlyOneOffExpenseAvg"
    - path: "src/lib/detection/pattern-detector.ts"
      provides: "Clarifying JSDoc on detectPatterns one-off classification scope"
      contains: "provisional"
    - path: "src/app/api/documents/aggregate/route.ts"
      provides: "Forecast response includes monthly one-off averages"
      contains: "monthlyOneOffExpenseAvg"
    - path: "src/components/dashboard/forecast-tab.tsx"
      provides: "Monthly one-off buffer UI card"
      min_lines: 15
  key_links:
    - from: "cross-month-learner.ts learnFromHistory()"
      to: "aggregate/route.ts computeAggregate() forecast response"
      via: "learningReport.monthlyOneOffExpenseAvg"
      pattern: "monthlyOneOffExpenseAvg"
    - from: "aggregate/route.ts API response"
      to: "forecast-tab.tsx Monthly One-Off Buffer card"
      via: "page.tsx prop drilling"
      pattern: "monthlyOneOffExpenseAvg"
---

<objective>
Add a monthly one-off expense/income average to the forecast display, and clarify the one-off classification documentation.

Purpose: Give users a realistic buffer estimate ("You typically have ~£X in one-off expenses each month") so the forecast surface is more truthful. The averages are display-only -- they do not inject fake recurring transactions into the daily forecast calculation.

Output: LearningReport extended with monthly averages, API response extended, and a new "Monthly one-off buffer" card in the Forecast tab.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/learning/cross-month-learner.ts
@src/lib/detection/pattern-detector.ts
@src/app/api/documents/aggregate/route.ts
@src/components/dashboard/forecast-tab.tsx
@src/app/(app)/dashboard/page.tsx

<interfaces>
<!-- Key types the executor needs. Extracted from codebase. -->

From src/lib/learning/cross-month-learner.ts (line 47):
```typescript
export interface LearningReport {
  vendors: Map<string, VendorLearning>;
  recurringCandidates: VendorLearning[];
  oneOffCandidates: string[];
  oneOffIncomeCandidates: string[];
  oneOffExpenseCandidates: string[];
  crossMonthInsights: CrossMonthInsight[];
  suspiciousCandidates: VendorLearning[];
  totalMonths: number;
  totalVendors: number;
  totalTransactions: number;
}
```

From src/lib/forecast/index.ts (line 25):
```typescript
export interface MonthEndForecast {
  currentBalance: number;
  predictedMonthEnd: number;
  remainingIncome: number;
  remainingExpenses: number;
  status: ForecastStatus;
  statusReason: string;
  confidence: number;
  dailyForecast: DailyForecast[];
  nextIncomeDate: string | null;
  dangerWindow: { from: string; to: string; lowestBalance: number } | null;
  biggestRisks: RiskItem[];
  generatedAt: string;
  catchUpEstimate: CatchUpEstimate | null;
  calculationAudit: CalculationAudit;
  forecastMode?: ForecastMode;
}
```

From src/app/(app)/dashboard/page.tsx (line 51):
```typescript
forecast: (MonthEndForecast & {
    forecastMode?: { isLowConfidence: boolean; reason: string | null };
}) | null;
```

From src/components/dashboard/forecast-tab.tsx (line 8):
```typescript
interface ForecastTabProps {
  currentPosition: { balance: number | null; ... };
  forecast: MonthEndForecast | null;
  accumulated: { totalIncome: number; totalExpenses: number; ... };
  categories: Array<{ category: string; total: number; ... }>;
  patterns: { recurringIncome: Array<...>; recurringExpenses: Array<...> } | null;
  totalDocuments: number;
  totalTransactions: number;
  statementInfo: { ... } | null;
  balanceValidation: { valid: boolean; ... } | null;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add monthly one-off averages to LearningReport and clarify pattern-detector docs</name>
  <files>
    src/lib/learning/cross-month-learner.ts
    src/lib/detection/pattern-detector.ts
  </files>
  <action>
**cross-month-learner.ts changes:**

1. Add two new fields to the `LearningReport` interface (after `totalTransactions`, line 57):
   ```
   monthlyOneOffExpenseAvg: number;
   monthlyOneOffIncomeAvg: number;
   ```

2. In `learnFromHistory()`, after the one-off classification loop completes (after line 225, before the crossMonthInsights block), calculate the monthly averages:

   ```typescript
   // Calculate monthly one-off averages
   let totalOneOffExpense = 0;
   let totalOneOffIncome = 0;
   for (const name of oneOffExpenseCandidates) {
     const vendor = vendorMap.get(name);
     if (vendor) totalOneOffExpense += vendor.amounts.reduce((s, a) => s + a, 0);
   }
   for (const name of oneOffIncomeCandidates) {
     const vendor = vendorMap.get(name);
     if (vendor) totalOneOffIncome += vendor.amounts.reduce((s, a) => s + a, 0);
   }
   const monthlyOneOffExpenseAvg = byMonth.length > 0 ? totalOneOffExpense / byMonth.length : 0;
   const monthlyOneOffIncomeAvg = byMonth.length > 0 ? totalOneOffIncome / byMonth.length : 0;
   ```

   Use `vendor.amounts.reduce((s, a) => s + a, 0)` rather than `vendor.typicalAmount` to get the true total (safe even if one-off definition changes to allow multiple amounts per vendor).

3. Add `monthlyOneOffExpenseAvg` and `monthlyOneOffIncomeAvg` to the return statement at the bottom of `learnFromHistory()`.

**pattern-detector.ts change:**

4. Add a JSDoc comment above `export function detectPatterns()` explaining the one-off scope. Place it right above line 101:

   ```
   /**
    * Detects recurring patterns and one-off transactions from the provided transaction set.
    *
    * IMPORTANT: One-off classification here is PROVISIONAL — it is based only on the
    * transactions passed to this function. A merchant appearing once in this call's data
    * will be marked as one-off here. The cross-month learner (learnFromHistory) is the
    * AUTHORITATIVE source: it classifies a vendor as one-off only if appearanceCount < 2
    * across ALL statements ever uploaded. For forecast/display purposes, rely on the
    * cross-month learner's oneOffCandidates, not the pattern detector's oneOffExpenses/oneOffIncome.
    */
   ```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - `LearningReport` interface has `monthlyOneOffExpenseAvg` and `monthlyOneOffIncomeAvg` fields
    - `learnFromHistory()` computes and returns both averages (0 when no months of data)
    - `detectPatterns()` has JSDoc clarifying provisional one-off classification
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Expose monthly one-off averages in the aggregate API response</name>
  <files>src/app/api/documents/aggregate/route.ts</files>
  <action>
In `computeAggregate()`, the forecast response object is built at lines 687-705 (inside the `forecast != null ? { ... } : null` ternary).

Add two new fields to the forecast response object, after the existing `forecastMode` field (after line 703):

```typescript
monthlyOneOffExpenseAvg: learningReport.monthlyOneOffExpenseAvg,
monthlyOneOffIncomeAvg: learningReport.monthlyOneOffIncomeAvg,
oneOffHistoryMonths: learningReport.totalMonths,
```

These go inside the spread object that is assigned when `forecast != null`. They are display-only metadata alongside the forecast — they do not affect the daily forecast calculation.

Also update the `AggregateResponse` interface in `page.tsx` (line 51-53) to include these new fields:

```typescript
forecast: (MonthEndForecast & {
    forecastMode?: { isLowConfidence: boolean; reason: string | null };
    monthlyOneOffExpenseAvg?: number;
    monthlyOneOffIncomeAvg?: number;
    oneOffHistoryMonths?: number;
}) | null;
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - Aggregate API response includes `monthlyOneOffExpenseAvg`, `monthlyOneOffIncomeAvg`, and `oneOffHistoryMonths` in the forecast object
    - `AggregateResponse` type in page.tsx updated to include the new fields
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Add Monthly One-Off Buffer card to the Forecast tab</name>
  <files>
    src/components/dashboard/forecast-tab.tsx
    src/app/(app)/dashboard/page.tsx
  </files>
  <action>
**forecast-tab.tsx changes:**

1. Add three new optional props to `ForecastTabProps` interface:
   ```typescript
   monthlyOneOffExpenseAvg?: number;
   monthlyOneOffIncomeAvg?: number;
   oneOffHistoryMonths?: number;
   ```

2. Destructure them in the component function signature alongside the existing props.

3. Add a "Monthly one-off buffer" card between the "How this was calculated" audit card (ends ~line 159) and the "Catch-Up Estimate" card (starts ~line 162). The card should only render when `monthlyOneOffExpenseAvg` is defined and greater than 0 AND `oneOffHistoryMonths` is defined and greater than 0.

   Card design (match existing card style — `bg-white border border-zinc-200 rounded-xl p-4`):

   ```tsx
   {monthlyOneOffExpenseAvg !== undefined && monthlyOneOffExpenseAvg > 0 && oneOffHistoryMonths !== undefined && oneOffHistoryMonths > 0 && (
     <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
       <div className="text-xs text-blue-500 uppercase tracking-wider font-medium mb-2">
         Monthly one-off buffer
       </div>
       <div className="text-sm text-blue-800 mb-2">
         Based on {oneOffHistoryMonths} month{oneOffHistoryMonths !== 1 ? "s" : ""} of history, you typically have{" "}
         <span className="font-semibold">{formatCurrency(monthlyOneOffExpenseAvg)}</span> in one-off
         expenses each month that aren&apos;t included in the daily forecast.
       </div>
       {monthlyOneOffIncomeAvg !== undefined && monthlyOneOffIncomeAvg > 0 && (
         <div className="text-xs text-blue-600">
           One-off income averages {formatCurrency(monthlyOneOffIncomeAvg)}/month.
         </div>
       )}
       <div className="text-xs text-blue-400 mt-2 italic">
         These are real expenses from your history that don&apos;t repeat — keep them in mind
         when planning your cashflow.
       </div>
     </div>
   )}
   ```

**page.tsx changes (already partially done in Task 2):**

4. In the `<ForecastTab>` JSX (line 377 and the fallback at line 427), pass the new props:
   ```tsx
   <ForecastTab
     ...
     monthlyOneOffExpenseAvg={data.forecast?.monthlyOneOffExpenseAvg}
     monthlyOneOffIncomeAvg={data.forecast?.monthlyOneOffIncomeAvg}
     oneOffHistoryMonths={data.forecast?.oneOffHistoryMonths}
   />
   ```
   Apply this to BOTH `<ForecastTab>` render sites (the active tab conditional at ~line 377 AND the fallback at ~line 427).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - ForecastTab renders a blue "Monthly one-off buffer" card when averages are available
    - Card shows expense average prominently, income average as secondary detail
    - Card copy references the number of months of history
    - Card only renders when there is meaningful data (averages > 0 and months > 0)
    - Both ForecastTab render sites in page.tsx pass the new props
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `grep -n "monthlyOneOffExpenseAvg" src/lib/learning/cross-month-learner.ts` returns the interface field, calculation, and return statement
3. `grep -n "monthlyOneOffExpenseAvg" src/app/api/documents/aggregate/route.ts` returns the forecast response field
4. `grep -n "monthlyOneOffExpenseAvg" src/components/dashboard/forecast-tab.tsx` returns the prop destructure and card rendering
</verification>

<success_criteria>
- LearningReport includes monthlyOneOffExpenseAvg and monthlyOneOffIncomeAvg computed as: sum of all one-off amounts / number of unique calendar months
- Aggregate API response includes these averages and oneOffHistoryMonths in the forecast section
- Forecast tab displays a Monthly One-Off Buffer card when data is available
- Daily forecast calculation is unchanged (averages are display-only, not injected into recurring patterns)
- Pattern detector JSDoc clarifies the provisional nature of per-call one-off classification
</success_criteria>

<output>
After completion, create `.planning/quick/260513-mwe-fix-forecast-engine-exclude-one-offs-fro/260513-mwe-SUMMARY.md`
</output>
