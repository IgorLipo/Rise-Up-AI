import type { EnrichedDetectedPatterns } from "@/lib/detection";
import type { RecurringPayment } from "@/lib/detection/pattern-detector";
import { generateDailyForecast, type DailyForecast, type ExpectedTransaction } from "./daily-forecaster";
import { calculateStatus, type ForecastStatus } from "./status-calculator";
import { detectRisks, type RiskItem } from "./risk-detector";

export interface CatchUpEstimate {
  daysSinceStatement: number;
  likelySpent: number;
  likelyReceived: number;
  estimatedBalance: number;
  confidence: number;
}

export interface CalculationAudit {
  latestStatementBalance: number;
  highConfidenceIncome: number;
  highConfidenceExpenses: number;
  mediumConfidenceIncome: number;
  mediumConfidenceExpenses: number;
  predictedRangeLow: number;
  predictedRangeHigh: number;
}

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

export function daysBetween(d1: string, d2: string): number {
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

function getDayOfMonth(date: string): number {
  return new Date(date).getDate();
}

function computeAverageDayOfMonth(occurrences: { date: string; amount: number }[]): number {
  const days = occurrences.map(o => getDayOfMonth(o.date));
  return Math.round(days.reduce((s, d) => s + d, 0) / days.length);
}

function hasAlreadyOccurredThisMonth(
  occurrences: { date: string; amount: number }[],
  today: string
): boolean {
  const currentMonth = today.slice(0, 7);
  return occurrences.some(o => o.date.slice(0, 7) === currentMonth);
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

export interface ForecastMode {
  isLowConfidence: boolean;
  reason: string | null;
}

function computeAverageGapForPayment(payment: RecurringPayment): number {
  if (payment.occurrences.length < 2) return 30;
  const gaps: number[] = [];
  for (let i = 1; i < payment.occurrences.length; i++) {
    gaps.push(daysBetween(payment.occurrences[i - 1].date, payment.occurrences[i].date));
  }
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

export function generateCatchUpEstimate(
  patterns: EnrichedDetectedPatterns,
  latestClosingBalance: number,
  statementPeriodEnd: string,
  today?: string
): CatchUpEstimate | null {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  if (!statementPeriodEnd || statementPeriodEnd >= todayStr) return null;
  const daysSince = daysBetween(statementPeriodEnd, todayStr);
  if (daysSince <= 0) return null;
  if (daysSince > 30) return null; // too stale

  let likelySpent = 0;
  let likelyReceived = 0;
  const horizon = todayStr;

  for (const payment of patterns.recurringExpenses) {
    if (payment.occurrences.length < 2) continue;
    if (payment.confidenceTier !== "high") continue;
    const nextDate = payment.nextExpected;
    if (nextDate > statementPeriodEnd && nextDate <= horizon) {
      likelySpent += payment.typicalAmount;
    }
  }

  for (const income of patterns.recurringIncome) {
    if (income.occurrences.length < 2) continue;
    if (income.confidenceTier !== "high") continue;
    const nextDate = income.nextExpected;
    if (nextDate > statementPeriodEnd && nextDate <= horizon) {
      likelyReceived += income.typicalAmount;
    }
  }

  const estimatedBalance = latestClosingBalance + likelyReceived - likelySpent;
  const confidence = Math.max(0, 1.0 - (daysSince / 30) * 0.5);

  return {
    daysSinceStatement: daysSince,
    likelySpent,
    likelyReceived,
    estimatedBalance,
    confidence,
  };
}

export function getForecastMode(statementPeriodEnd: string | null, today?: string): ForecastMode {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  if (!statementPeriodEnd) return { isLowConfidence: false, reason: null };
  const todayDay = new Date(todayStr).getDate();
  const lastStatementDay = new Date(statementPeriodEnd).getDate();
  if (todayDay > 25 && lastStatementDay <= 5) {
    return {
      isLowConfidence: true,
      reason: "Latest statement is from early in the month and we're past the 25th. Consider uploading a newer statement for higher-confidence forecasts.",
    };
  }
  return { isLowConfidence: false, reason: null };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function generateForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today?: string
): MonthEndForecast {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  const monthEnd = getMonthEnd(todayStr);

  // isMonthComplete: deferred to Phase 1b — computed in aggregate route based on statement coverage

  const daily = generateDailyForecast(patterns, currentBalance, todayStr);

  // Filter to HIGH confidence only for main forecast
  const highConfidenceIncome = patterns.recurringIncome
    .filter((i) => i.confidenceTier === "high" && i.nextExpected <= monthEnd);
  const highConfidenceExpenses = patterns.recurringExpenses
    .filter((e) => e.confidenceTier === "high" && e.nextExpected <= monthEnd);

  const remainingIncome = highConfidenceIncome.reduce((s, i) => s + i.typicalAmount, 0);
  const remainingExpenses = highConfidenceExpenses.reduce((s, e) => s + e.typicalAmount, 0);

  const nextIncomeDates = highConfidenceIncome
    .map((i) => i.nextExpected)
    .sort();
  const nextIncomeDate = nextIncomeDates.length > 0 ? nextIncomeDates[0] : null;

  const totalMonthlyExpenses = highConfidenceExpenses.reduce((s, e) => s + e.typicalAmount, 0);

  const { status, reason: statusReason } = calculateStatus(daily, totalMonthlyExpenses, nextIncomeDate);

  const risks = detectRisks(
    daily,
    nextIncomeDate,
    patterns.recurringIncome.find((i) => i.nextExpected === nextIncomeDate)?.merchant
  );

  // Danger window
  const threshold = totalMonthlyExpenses * 0.2;
  const lowDays = daily.filter((d) => d.closingBalance < threshold);
  const dangerWindow = lowDays.length > 0
    ? { from: lowDays[0].date, to: lowDays[lowDays.length - 1].date, lowestBalance: Math.min(...lowDays.map((d) => d.closingBalance)) }
    : null;

  // Confidence: average of HIGH confidence pattern confidences
  const confidences = [...highConfidenceIncome, ...highConfidenceExpenses].map((p) => p.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((s: number, c: number) => s + c, 0) / confidences.length
    : 0;

  // MEDIUM confidence tier for calculation audit
  const mediumConfidenceIncome = patterns.recurringIncome
    .filter((i) => i.confidenceTier === "medium" && i.nextExpected <= monthEnd);
  const mediumConfidenceExpenses = patterns.recurringExpenses
    .filter((e) => e.confidenceTier === "medium" && e.nextExpected <= monthEnd);
  const mediumIncomeTotal = mediumConfidenceIncome.reduce((s, i) => s + i.typicalAmount, 0);
  const mediumExpensesTotal = mediumConfidenceExpenses.reduce((s, e) => s + e.typicalAmount, 0);

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
    calculationAudit: {
      latestStatementBalance: currentBalance,
      highConfidenceIncome: remainingIncome,
      highConfidenceExpenses: remainingExpenses,
      mediumConfidenceIncome: mediumIncomeTotal,
      mediumConfidenceExpenses: mediumExpensesTotal,
      predictedRangeLow: currentBalance + remainingIncome - remainingExpenses,
      predictedRangeHigh: currentBalance + remainingIncome + mediumIncomeTotal - remainingExpenses - mediumExpensesTotal,
    },
    catchUpEstimate: null, // populated by the aggregate route, not here
  };
}

function getMonthEnd(today: string): string {
  const d = new Date(today);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().split("T")[0];
}

export type { DailyForecast, ExpectedTransaction, ForecastStatus, RiskItem };
