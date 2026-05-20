// Hybrid forecaster.
//
// Splits the forecast into TWO components and reconciles against the
// purely-historical baseline:
//
//   1. Deterministic — sum of recurring patterns expected to hit this month.
//   2. Stochastic    — monthly average of one-off transactions from history.
//
// The hybrid total = (1) + (2). We then compare this to the trailing-history
// average net flow ("historical baseline"). If they agree within 20%, the
// hybrid is high-confidence. If they disagree, surface a warning — usually
// means recurring detection missed something.
import type { MonthlySummary } from "./types";
import type { EnrichedDetectedPatterns } from "@/lib/detection";

/**
 * Per-vendor history: each vendor's monthly totals across all history.
 * Used to compute "did this vendor fire in N of the last M months" recurrence
 * AND to compute their typical monthly spend (sum of amounts that month,
 * not single-occurrence typical amount — handles weekly tenants etc.).
 */
export interface VendorMonthlyHistory {
  canonicalName: string;
  direction: "income" | "expense" | "mixed";
  monthlyTotals: Record<string, number>; // YYYY-MM → total amount that month
}

export interface HybridComponent {
  income: number;
  expenses: number;
  net: number;
}

export interface ExampleTransaction {
  description: string;
  amount: number;
  date?: string;
  subcategory?: string;
}

export interface HybridForecast {
  /** Sum of recurring-pattern projections for the current month. */
  recurring: HybridComponent;
  /** Monthly average of one-off transactions over historical months. */
  oneOffAvg: HybridComponent;
  /** Recurring + one-off avg, pro-rated by days remaining. */
  totalProjected: HybridComponent;
  /** Actuals from the in-progress month (statement data so far). */
  actualSoFar: HybridComponent;
  /** Month-end balance prediction using the hybrid total. */
  predictedMonthEnd: number;
  /** Confidence 0-1 based on agreement with historical baseline. */
  confidence: number;
  /** Variance percent between hybrid total net and historical avg net. */
  variancePct: number;
  /** Whether the methods disagree by >20% — shown as a warning. */
  reconciliationWarning: boolean;
  /** Diagnostic info. */
  monthsUsed: number;
  daysRemaining: number;
  daysInMonth: number;
  asOfDate: string;
  monthEndDate: string;
  /** Top example transactions per category (up to 10 each). */
  examples?: {
    actualSoFarIncome: ExampleTransaction[];
    actualSoFarExpenses: ExampleTransaction[];
    recurringIncome: ExampleTransaction[];
    recurringExpenses: ExampleTransaction[];
    oneOffIncome: ExampleTransaction[];
    oneOffExpenses: ExampleTransaction[];
  };
}

function getMonthEnd(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().split("T")[0];
}
function getDaysInMonth(today: string): number {
  const d = new Date(today + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
function daysBetween(d1: string, d2: string): number {
  return Math.round(
    (new Date(d2 + "T00:00:00Z").getTime() -
      new Date(d1 + "T00:00:00Z").getTime()) /
      86400000
  );
}

/**
 * Build a hybrid forecast.
 *
 * @param patterns           detected recurring patterns
 * @param monthlySummaries   complete past months (used for one-off avg + historical avg cross-check)
 * @param currentBalance     statement closing balance (starting point)
 * @param asOfDate           statement period_end
 * @param actualThisMonth    real transactions in current month so far
 * @param monthlyOneOffAvg   { income, expenses } — typical one-off totals per month from learner
 * @param today              today's date
 */
export function computeHybridForecast(
  patterns: EnrichedDetectedPatterns,
  monthlySummaries: MonthlySummary[],
  currentBalance: number,
  asOfDate: string,
  actualThisMonth: Array<{ amount: number; type: "credit" | "debit" }>,
  monthlyOneOffAvg: { income: number; expenses: number; historyMonths: number },
  today: string = new Date().toISOString().split("T")[0],
  vendorHistory?: VendorMonthlyHistory[]
): HybridForecast {
  const monthEnd = getMonthEnd(today);
  const monthStart = today.slice(0, 7) + "-01";
  const daysInMonth = getDaysInMonth(today);
  const daysRemaining = Math.max(0, daysBetween(asOfDate < monthStart ? monthStart : asOfDate, monthEnd));
  const fractionRemaining = Math.min(1, daysRemaining / daysInMonth);

  // 1. Recurring component.
  //
  // Old approach: filter patterns to HIGH/MEDIUM confidence tier, sum each
  // pattern's "typical" single-occurrence amount. This systematically
  // under-counted because:
  //   - Property tenants with variable amounts (£560–£3,500) get LOW tier
  //   - Weekly recurring (4×/month) was counted once
  //   - Backtest on Feb/Mar/Apr 2026: captured 34% of true recurring income
  //     and 27% of true recurring expenses → +£23k positive bias.
  //
  // New approach: for each vendor that fired in ≥2 of the last 3 complete
  // months, use that vendor's average MONTHLY total (not single-occurrence)
  // as the projection. This naturally handles multi-payment vendors and
  // doesn't depend on amount-variance confidence checks.
  let recIncome = 0;
  let recExpenses = 0;
  let recurringIncomeVendors = 0;
  let recurringExpenseVendors = 0;
  if (vendorHistory && vendorHistory.length > 0) {
    // Determine the last 3 complete-month keys from monthlySummaries.
    const completeMonths = monthlySummaries
      .filter((m) => m.completeness !== "partial")
      .map((m) => m.month)
      .sort();
    const recentMonths = completeMonths.slice(-3);
    if (recentMonths.length > 0) {
      for (const v of vendorHistory) {
        // Months in the recent window where this vendor had non-zero activity.
        const firedMonths = recentMonths.filter(
          (m) => Math.abs(v.monthlyTotals[m] ?? 0) > 0.005
        );
        if (firedMonths.length < 2) continue; // not recurring enough
        // Vendor's average monthly total over the recent window
        // (treat months with no activity as 0 so the avg pulls down naturally).
        const avg =
          recentMonths.reduce((s, m) => s + (v.monthlyTotals[m] ?? 0), 0) /
          recentMonths.length;
        if (v.direction === "income") {
          recIncome += Math.abs(avg);
          recurringIncomeVendors++;
        } else if (v.direction === "expense") {
          recExpenses += Math.abs(avg);
          recurringExpenseVendors++;
        } else {
          // Mixed direction: split the avg by sign of monthly totals.
          // Rare — most vendors are pure income or pure expense.
          let posTotal = 0;
          let negTotal = 0;
          for (const m of recentMonths) {
            const t = v.monthlyTotals[m] ?? 0;
            if (t > 0) posTotal += t;
            else negTotal += Math.abs(t);
          }
          recIncome += posTotal / recentMonths.length;
          recExpenses += negTotal / recentMonths.length;
        }
      }
    }
    // Pro-rate by fraction of month remaining (recurring vendors
    // statistically fire across the whole month).
    recIncome *= fractionRemaining;
    recExpenses *= fractionRemaining;
  } else {
    // Fallback: old pattern-tier approach (kept for safety only).
    for (const p of patterns.recurringIncome) {
      if (p.confidenceTier === "low") continue;
      if (p.nextExpected >= today && p.nextExpected <= monthEnd) recIncome += p.typicalAmount;
    }
    for (const p of patterns.recurringExpenses) {
      if (p.confidenceTier === "low") continue;
      if (p.nextExpected >= today && p.nextExpected <= monthEnd) recExpenses += p.typicalAmount;
    }
  }

  // 2. One-off avg component.
  // Now that the recurring component captures vendors firing in 2+ of last 3
  // months, the "one-off avg" must only count vendors that DIDN'T fire in 2+
  // months (otherwise we'd double-count). The caller passes monthlyOneOffAvg
  // already filtered this way.
  const ooIncome = monthlyOneOffAvg.income * fractionRemaining;
  const ooExpenses = monthlyOneOffAvg.expenses * fractionRemaining;

  // 3. Actuals so far this month — straight sum.
  let actualIncome = 0;
  let actualExpenses = 0;
  for (const tx of actualThisMonth) {
    if (tx.type === "credit") actualIncome += tx.amount;
    else actualExpenses += tx.amount;
  }

  const totalIncome = actualIncome + recIncome + ooIncome;
  const totalExpenses = actualExpenses + recExpenses + ooExpenses;
  const totalNet = totalIncome - totalExpenses;
  const predictedMonthEnd = currentBalance + (recIncome + ooIncome) - (recExpenses + ooExpenses);

  // 4. Historical-baseline cross-check — full-month avg net.
  const complete = monthlySummaries.filter((m) => m.completeness !== "partial");
  let baselineNet = 0;
  if (complete.length >= 2) {
    baselineNet =
      complete.reduce((s, m) => s + (m.totalIncome - m.totalExpenses), 0) /
      complete.length;
  }
  const baselineMagnitude = Math.abs(baselineNet) || 1;
  const variancePct =
    Math.abs(totalNet - baselineNet) / baselineMagnitude;
  const reconciliationWarning = variancePct > 0.2 && complete.length >= 3;

  // Confidence: scaled by months of history and inverse variance.
  let confidence = 0.5;
  if (complete.length >= 3) confidence += 0.2;
  if (complete.length >= 6) confidence += 0.1;
  if (variancePct < 0.1) confidence += 0.2;
  else if (variancePct < 0.2) confidence += 0.1;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    recurring: { income: recIncome, expenses: recExpenses, net: recIncome - recExpenses },
    oneOffAvg: { income: ooIncome, expenses: ooExpenses, net: ooIncome - ooExpenses },
    totalProjected: { income: totalIncome, expenses: totalExpenses, net: totalNet },
    actualSoFar: {
      income: actualIncome,
      expenses: actualExpenses,
      net: actualIncome - actualExpenses,
    },
    predictedMonthEnd,
    confidence,
    variancePct,
    reconciliationWarning,
    monthsUsed: complete.length,
    daysRemaining,
    daysInMonth,
    asOfDate,
    monthEndDate: monthEnd,
  };
}
