import type { EnrichedDetectedPatterns } from "@/lib/detection";
import { generateDailyForecast, type DailyForecast, type ExpectedTransaction } from "./daily-forecaster";
import { calculateStatus, type ForecastStatus } from "./status-calculator";
import { detectRisks, type RiskItem } from "./risk-detector";

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
}

function daysBetween(d1: string, d2: string): number {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function computeAverageGap(occurrences: { date: string; amount: number }[]): number {
  if (occurrences.length < 2) return 30;
  const gaps = [];
  for (let i = 1; i < occurrences.length; i++) {
    gaps.push(daysBetween(occurrences[i - 1].date, occurrences[i].date));
  }
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

export interface CatchUpResult {
  estimatedBalance: number;
  lastKnownBalance: number;
  lastKnownDate: string;
  daysProjected: number;
  isEstimated: boolean;
}

const MAX_CATCHUP_DAYS = 30;

export function catchUpBalance(
  patterns: EnrichedDetectedPatterns,
  lastKnownBalance: number,
  lastKnownDate: string,
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

  // If last statement is too old to project reliably, use last known balance as-is
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
    const gap = computeAverageGap(payment.occurrences);
    let nextDate = addDays(payment.lastOccurrence, gap);
    while (nextDate <= horizon && nextDate <= todayStr) {
      balance -= payment.typicalAmount;
      nextDate = addDays(nextDate, gap);
    }
  }

  for (const income of patterns.recurringIncome) {
    if (income.occurrences.length < 2) continue;
    const gap = computeAverageGap(income.occurrences);
    let nextDate = addDays(income.lastOccurrence, gap);
    while (nextDate <= horizon && nextDate <= todayStr) {
      balance += income.typicalAmount;
      nextDate = addDays(nextDate, gap);
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

export function generateForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today?: string
): MonthEndForecast {
  const daily = generateDailyForecast(patterns, currentBalance, today);

  const remainingIncome = patterns.recurringIncome
    .filter((i) => i.nextExpected <= daily[daily.length - 1]?.date)
    .reduce((s, i) => s + i.typicalAmount, 0);

  const remainingExpenses = patterns.recurringExpenses
    .filter((e) => e.nextExpected <= daily[daily.length - 1]?.date)
    .reduce((s, e) => s + e.typicalAmount, 0);

  const nextIncomeDates = patterns.recurringIncome
    .map((i) => i.nextExpected)
    .sort();
  const nextIncomeDate = nextIncomeDates.length > 0 ? nextIncomeDates[0] : null;

  const totalMonthlyExpenses = patterns.recurringExpenses.reduce((s, e) => s + e.typicalAmount, 0);

  const { status, reason: statusReason } = calculateStatus(daily, totalMonthlyExpenses, nextIncomeDate);

  const risks = detectRisks(daily);

  // Danger window: longest consecutive below-threshold period
  const threshold = totalMonthlyExpenses * 0.2;
  const lowDays = daily.filter((d) => d.closingBalance < threshold);
  const dangerWindow = lowDays.length > 0
    ? { from: lowDays[0].date, to: lowDays[lowDays.length - 1].date, lowestBalance: Math.min(...lowDays.map((d) => d.closingBalance)) }
    : null;

  // Confidence: average of recurring payment confidences
  const confidences = [...patterns.recurringExpenses, ...patterns.recurringIncome].map((p) => p.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0.3;

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

export type { DailyForecast, ExpectedTransaction, ForecastStatus, RiskItem };
