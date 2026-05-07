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
