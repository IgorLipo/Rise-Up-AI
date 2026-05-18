// Historical-baseline forecaster.
//
// The recurring-pattern forecaster (daily-forecaster.ts) is precise per-day but
// systematically under-counts cashflow: it only includes vendors with stable,
// repeating patterns. Real businesses have substantial one-off / irregular
// activity that materially affects month-end balance.
//
// Backtest against 8 historical months (Sep 2025 → Apr 2026) shows the
// recurring-only method has a mean absolute error of £33k and a +£33k bias
// (always optimistic). A trailing 3-month average of actual net flow has
// MAE £7k and near-zero bias.
//
// This module provides a credibility-focused month-end forecast based on
// trailing N-month actuals from statement_history, pro-rated for the portion
// of the month that remains.
import type { MonthlySummary } from "./types";

export interface HistoricalForecast {
  predictedMonthEnd: number;
  expectedIncome: number;
  expectedExpenses: number;
  expectedNetFlow: number;
  daysRemaining: number;
  daysInMonth: number;
  monthsUsed: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  avgMonthlyNet: number;
  confidence: number;
  method: string;
  asOfDate: string;
  monthEndDate: string;
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
    (new Date(d2 + "T00:00:00Z").getTime() - new Date(d1 + "T00:00:00Z").getTime()) / 86400000
  );
}

/**
 * Compute a credibility-focused month-end forecast using trailing N-month
 * actuals from statement history.
 *
 * Algorithm:
 *   1. Take the last `monthsToAvg` complete months from history.
 *   2. Compute mean monthly income, expenses, net.
 *   3. Pro-rate by the share of the current month that remains
 *      (between `asOfDate` and month-end).
 *   4. Add to `currentBalance` (the latest known statement closing balance).
 *
 * `asOfDate` is the anchor for projection — usually the latest statement
 * period_end. The "remaining" portion is from asOfDate → monthEnd.
 *
 * Returns null if there is insufficient history (< 2 complete months).
 */
export function computeHistoricalForecast(
  monthlySummaries: MonthlySummary[],
  currentBalance: number,
  asOfDate: string,
  today: string = new Date().toISOString().split("T")[0],
  monthsToAvg: number = Number.POSITIVE_INFINITY
): HistoricalForecast | null {
  // Use only "complete" months — partial coverage skews averages.
  const complete = monthlySummaries.filter(
    (m) => m.completeness !== "partial"
  );
  if (complete.length < 2) return null;

  // Sort ascending (oldest first) so we take the most recent N from the end.
  const sorted = [...complete].sort((a, b) => a.month.localeCompare(b.month));
  const n = Number.isFinite(monthsToAvg)
    ? Math.min(monthsToAvg, sorted.length)
    : sorted.length;
  const window = sorted.slice(-n);

  const avgIncome = window.reduce((s, m) => s + m.totalIncome, 0) / window.length;
  const avgExpenses = window.reduce((s, m) => s + m.totalExpenses, 0) / window.length;
  const avgNet = avgIncome - avgExpenses;

  const monthEnd = getMonthEnd(today);
  const daysInMonth = getDaysInMonth(today);

  // Days from asOfDate to month-end (clamp to [0, daysInMonth]).
  // If asOfDate is before this month's start, treat as "full month remaining".
  let daysRemaining = daysBetween(asOfDate, monthEnd);
  if (daysRemaining < 0) daysRemaining = 0;
  if (daysRemaining > daysInMonth) daysRemaining = daysInMonth;

  const fraction = daysRemaining / daysInMonth;
  const expectedIncome = avgIncome * fraction;
  const expectedExpenses = avgExpenses * fraction;
  const expectedNetFlow = expectedIncome - expectedExpenses;
  const predictedMonthEnd = currentBalance + expectedNetFlow;

  // Confidence: higher with more months of history, lower if window is small or
  // the trailing months show high variance.
  const netValues = window.map((m) => m.totalIncome - m.totalExpenses);
  const mean = netValues.reduce((s, v) => s + v, 0) / netValues.length;
  const variance =
    netValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / netValues.length;
  const stdDev = Math.sqrt(variance);
  const meanAbs = Math.abs(avgIncome) + Math.abs(avgExpenses);
  const cv = meanAbs > 0 ? stdDev / meanAbs : 1;

  let confidence = 0.5;
  if (window.length >= 3) confidence += 0.2;
  if (window.length >= 6) confidence += 0.1;
  if (cv < 0.1) confidence += 0.2;
  else if (cv < 0.2) confidence += 0.1;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    predictedMonthEnd,
    expectedIncome,
    expectedExpenses,
    expectedNetFlow,
    daysRemaining,
    daysInMonth,
    monthsUsed: window.length,
    avgMonthlyIncome: avgIncome,
    avgMonthlyExpenses: avgExpenses,
    avgMonthlyNet: avgNet,
    confidence,
    method: `Average of ${window.length} complete months`,
    asOfDate,
    monthEndDate: monthEnd,
  };
}
