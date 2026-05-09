// Forecast accuracy tracking.
// Compares predicted values against actuals when new statement data arrives,
// so the system can learn from its forecasting errors over time.

export interface ForecastAccuracy {
  month: string;
  predictedIncome: number;
  actualIncome: number;
  predictedExpenses: number;
  actualExpenses: number;
  predictedMonthEnd: number;
  actualMonthEnd: number;
  incomeError: number;      // signed: positive = under-predicted
  expenseError: number;     // signed: positive = under-predicted
  balanceError: number;     // signed: positive = under-predicted
  incomeMAPE: number;       // Mean Absolute Percentage Error
  expenseMAPE: number;
  balanceMAPE: number;
  confidenceScore: number;  // 0-1, higher = better
  comparedAt: string;
}

export interface AccuracySummary {
  overall: {
    avgIncomeMAPE: number;
    avgExpenseMAPE: number;
    avgBalanceError: number;
    avgConfidence: number;
    totalMonthsCompared: number;
  };
  months: ForecastAccuracy[];
  trend: "improving" | "stable" | "degrading" | "insufficient-data";
}

export interface ForecastSnapshot {
  month: string;
  predictedIncome: number;
  predictedExpenses: number;
  predictedMonthEnd: number;
  confidence: number;
}

export interface MonthActuals {
  totalIncome: number;
  totalExpenses: number;
  closingBalance: number;
}

function toMonth(date: string): string {
  return date.slice(0, 7);
}

export function compareForecastVsActuals(
  forecasts: ForecastSnapshot[],
  actuals: Record<string, MonthActuals> // month → actuals
): ForecastAccuracy[] {
  const results: ForecastAccuracy[] = [];

  for (const forecast of forecasts) {
    const actual = actuals[forecast.month];
    if (!actual) continue;

    const incomeError = forecast.predictedIncome - actual.totalIncome;
    const expenseError = forecast.predictedExpenses - actual.totalExpenses;
    const balanceError = forecast.predictedMonthEnd - actual.closingBalance;

    const incomeMAPE = actual.totalIncome > 0
      ? Math.abs(incomeError) / Math.max(actual.totalIncome, 1) * 100
      : 0;
    const expenseMAPE = actual.totalExpenses > 0
      ? Math.abs(expenseError) / Math.max(actual.totalExpenses, 1) * 100
      : 0;
    const balanceMAPE = Math.abs(actual.closingBalance) > 0
      ? Math.abs(balanceError) / Math.max(Math.abs(actual.closingBalance), 1) * 100
      : 0;

    // Confidence score: higher is better (100 - avg error pct, clamped)
    const avgError = (incomeMAPE + expenseMAPE) / 2;
    const confidence = Math.max(0, Math.min(1, (100 - Math.min(100, avgError)) / 100));

    results.push({
      month: forecast.month,
      predictedIncome: forecast.predictedIncome,
      actualIncome: actual.totalIncome,
      predictedExpenses: forecast.predictedExpenses,
      actualExpenses: actual.totalExpenses,
      predictedMonthEnd: forecast.predictedMonthEnd,
      actualMonthEnd: actual.closingBalance,
      incomeError,
      expenseError,
      balanceError,
      incomeMAPE,
      expenseMAPE,
      balanceMAPE,
      confidenceScore: confidence,
      comparedAt: new Date().toISOString(),
    });
  }

  return results;
}

export function summarizeAccuracy(results: ForecastAccuracy[]): AccuracySummary {
  if (results.length === 0) {
    return {
      overall: {
        avgIncomeMAPE: 0,
        avgExpenseMAPE: 0,
        avgBalanceError: 0,
        avgConfidence: 0,
        totalMonthsCompared: 0,
      },
      months: [],
      trend: "insufficient-data",
    };
  }

  const avgIncomeMAPE = results.reduce((s, r) => s + r.incomeMAPE, 0) / results.length;
  const avgExpenseMAPE = results.reduce((s, r) => s + r.expenseMAPE, 0) / results.length;
  const avgBalanceError = results.reduce((s, r) => s + r.balanceError, 0) / results.length;
  const avgConfidence = results.reduce((s, r) => s + r.confidenceScore, 0) / results.length;

  // Trend: compare first half vs second half
  let trend: AccuracySummary["trend"] = "insufficient-data";
  if (results.length >= 2) {
    const mid = Math.floor(results.length / 2);
    const firstHalf = results.slice(0, mid);
    const secondHalf = results.slice(mid);
    const firstAvg = (firstHalf.reduce((s, r) => s + r.confidenceScore, 0) / firstHalf.length);
    const secondAvg = (secondHalf.reduce((s, r) => s + r.confidenceScore, 0) / secondHalf.length);
    if (secondAvg > firstAvg + 0.05) trend = "improving";
    else if (secondAvg < firstAvg - 0.05) trend = "degrading";
    else trend = "stable";
  }

  return {
    overall: {
      avgIncomeMAPE,
      avgExpenseMAPE,
      avgBalanceError,
      avgConfidence,
      totalMonthsCompared: results.length,
    },
    months: results.sort((a, b) => b.month.localeCompare(a.month)),
    trend,
  };
}

// Build forecast snapshots from the existing aggregate data structure
export function buildForecastSnapshots(
  monthlySummaries: Array<{ month: string; totalIncome: number; totalExpenses: number }>,
  forecasts: Record<string, { predictedMonthEnd: number }>
): ForecastSnapshot[] {
  return monthlySummaries.map((m) => ({
    month: m.month,
    predictedIncome: m.totalIncome,
    predictedExpenses: m.totalExpenses,
    predictedMonthEnd: forecasts[m.month]?.predictedMonthEnd ?? 0,
    confidence: 0.5,
  }));
}
